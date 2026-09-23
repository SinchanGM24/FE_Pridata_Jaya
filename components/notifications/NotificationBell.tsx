"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCircle2, X } from "lucide-react";
import { notificationsService, type NotificationItem } from "@/services/notifications";
import { getRealtimeClient } from "@/services/realtime";
import { useAuth } from "@/hooks/useAuth";
import { canReadNotifications } from "@/lib/role-capabilities";

type AlertNotification = Pick<NotificationItem, "id" | "title" | "message" | "priority">;
type RealtimeNotificationPayload = Partial<NotificationItem> & { notificationId?: unknown };

function formatRelativeTime(dateString: string): string {
	const diffMins = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
	if (diffMins < 1) return "Baru saja";
	if (diffMins < 60) return `${diffMins} menit lalu`;
	if (diffMins < 1440) return `${Math.floor(diffMins / 60)} jam lalu`;
	return new Date(dateString).toLocaleDateString("id-ID");
}

function priorityStyle(priority?: NotificationItem["priority"]) {
	if (priority === "CRITICAL") return "border-red-200 bg-red-50 text-red-900";
	if (priority === "HIGH") return "border-orange-200 bg-orange-50 text-orange-900";
	if (priority === "NORMAL") return "border-sky-200 bg-sky-50 text-sky-900";
	return "border-slate-200 bg-slate-50 text-slate-800";
}

export function NotificationBell() {
	const { user } = useAuth();
	const router = useRouter();
	const canUseNotifications = canReadNotifications(user);
	const canUseRealtime = user?.organizationRole !== "sales" && user?.role !== "sales";
	const [isOpen, setIsOpen] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [alerts, setAlerts] = useState<AlertNotification[]>([]);
	const [loading, setLoading] = useState(false);
	const refreshInFlight = useRef(false);
	const nextRefreshAt = useRef(0);

	const refreshBell = useCallback(async () => {
		if (refreshInFlight.current || Date.now() < nextRefreshAt.current) return;
		refreshInFlight.current = true; setLoading(true);
		try {
			const [count, list] = await Promise.all([notificationsService.getUnreadCount(), notificationsService.list({ limit: 5 })]);
			setUnreadCount(count.count); setNotifications(list.items);
			// Several UI events can arrive together (mount, opening the bell, and SSE).
			// Keep one short shared cooldown after a successful refresh as well.
			nextRefreshAt.current = Date.now() + 3_000;
		} catch (error) {
			const response = typeof error === "object" && error && "response" in error
				? (error as { response?: { status?: number; headers?: Record<string, string | undefined> } }).response
				: undefined;
			const status = response?.status;
			const retryAfterSeconds = Number(response?.headers?.["retry-after"]);
			// Do not repeatedly hit the API while the server's rate-limit window is active.
			nextRefreshAt.current = Date.now() + (status === 429
				? Math.max(5_000, (Number.isFinite(retryAfterSeconds) ? retryAfterSeconds + 1 : 60) * 1_000)
				: 5_000);
			if (status !== 429) console.error("[NotificationBell] Failed to refresh notifications:", error);
		} finally { refreshInFlight.current = false; setLoading(false); }
	}, []);
	const dismissAlert = useCallback((id: string) => setAlerts((current) => current.filter((alert) => alert.id !== id)), []);

	const openNotification = useCallback(async (notification: NotificationItem) => {
		try {
			if (!notification.isRead) await notificationsService.markAsRead(notification.id);
			setUnreadCount((current) => Math.max(0, current - (notification.isRead ? 0 : 1)));
			setIsOpen(false);
			if (notification.isDigest) { router.push(`/notifications?groupId=${notification.id}`); return; }
			if (notification.entityType === "DELIVERY_ORDER") {
				const invoiceId = typeof notification.metadata?.invoiceId === "string" ? notification.metadata.invoiceId : undefined;
				router.push(invoiceId ? `/gudang/pengiriman?invoiceId=${encodeURIComponent(invoiceId)}` : "/gudang/pengiriman");
				return;
			}
			const params = new URLSearchParams();
			if (notification.entityType) params.set("entityType", notification.entityType);
			if (notification.entityId) params.set("entityId", notification.entityId);
			router.push(`/notifications${params.size ? `?${params.toString()}` : ""}`);
		} catch (error) { console.error("[NotificationBell] Failed to open notification:", error); }
	}, [router]);

	useEffect(() => {
		if (!canUseNotifications) return;
		// Schedule the initial read after mount. Besides avoiding a synchronous state
		// update from an effect, this lets the auth state settle before the first call.
		const initialRefresh = window.setTimeout(() => { void refreshBell(); }, 0);
		const client = getRealtimeClient();
		const unsubscribe = canUseRealtime ? (() => {
			client.connect();
			return client.subscribe((topic, payload) => {
				if (topic !== "notifications") return;
				void refreshBell();
				if (!payload || typeof payload !== "object") return;
				const event = payload as RealtimeNotificationPayload;
				const id = typeof event.notificationId === "string"
					? event.notificationId
					: typeof event.id === "string"
						? event.id
						: null;
				if (!id || !event.title || !event.message || (event.priority !== "HIGH" && event.priority !== "CRITICAL")) return;
				const item: AlertNotification = { id, title: event.title, message: event.message, priority: event.priority };
				setAlerts((current) => current.some((alert) => alert.id === item.id) ? current : [...current, item]);
				if (item.priority === "HIGH") window.setTimeout(() => dismissAlert(item.id), 7000);
			});
		})() : () => undefined;
		// NORMAL/LOW are intentionally not realtime pushes. Poll both the badge and list so
		// a newly updated daily digest appears without requiring a full page reload.
		const pollInterval = window.setInterval(() => { void refreshBell(); }, 60000);
		return () => { window.clearTimeout(initialRefresh); unsubscribe(); window.clearInterval(pollInterval); };
	}, [canUseNotifications, canUseRealtime, dismissAlert, refreshBell]);

	if (!canUseNotifications) return null;
	return <div className="relative">
		{alerts.length ? <div className="fixed left-1/2 top-5 z-[70] flex w-[min(92vw,32rem)] -translate-x-1/2 flex-col gap-3">{alerts.map((alert) => <div key={alert.id} className={`flex gap-3 rounded-xl border p-4 shadow-lg ${priorityStyle(alert.priority)}`} role="alert"><span className="mt-0.5">{alert.priority === "CRITICAL" ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{alert.title}</p><p className="mt-1 text-sm opacity-90">{alert.message}</p></div><button type="button" onClick={() => dismissAlert(alert.id)} className="rounded p-1 hover:bg-white/50" aria-label="Tutup notifikasi"><X className="h-4 w-4" /></button></div>)}</div> : null}
		<button type="button" onClick={() => { setIsOpen((current) => { const willOpen = !current; if (willOpen) void refreshBell(); return willOpen; }); }} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500" aria-label="Notifikasi"><Bell className="h-6 w-6" />{unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</button>
		{isOpen ? <><button type="button" className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-label="Tutup notifikasi" /><div className="absolute right-0 z-20 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-semibold text-slate-900">Notifikasi</h3><Link href="/notifications" className="text-xs font-semibold text-sky-700 hover:underline">Lihat semua</Link></div><div className="max-h-80 overflow-y-auto">{loading ? <div className="px-4 py-6 text-center text-sm text-slate-500">Memuat...</div> : notifications.length === 0 ? <div className="px-4 py-6 text-center text-sm text-slate-500">Tidak ada notifikasi</div> : notifications.map((notification) => <button type="button" key={notification.id} onClick={() => void openNotification(notification)} className={`w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${!notification.isRead ? "bg-slate-50" : ""}`}><div className="flex items-start gap-3">{!notification.isRead ? <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${notification.priority === "CRITICAL" ? "bg-red-500" : notification.priority === "HIGH" ? "bg-orange-500" : "bg-sky-500"}`} /> : null}<div className={!notification.isRead ? "min-w-0" : "ml-5 min-w-0"}><div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-slate-900">{notification.title}</p>{notification.isDigest ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{notification.occurrenceCount ?? 0}</span> : null}</div><p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{notification.message}</p><p className="mt-1 text-xs text-slate-400">{formatRelativeTime(notification.createdAt)}</p></div></div></button>)}</div></div></> : null}
	</div>;
}
