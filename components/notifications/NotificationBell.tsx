"use client";

import { useCallback, useEffect, useState } from "react";
import { notificationsService, type NotificationItem } from "@/services/notifications";
import { getRealtimeClient } from "@/services/realtime";
import { useAuth } from "@/hooks/useAuth";
import { resolveDashboardRole } from "@/lib/auth";

function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "Baru saja";
	if (diffMins < 60) return `${diffMins} menit lalu`;
	if (diffHours < 24) return `${diffHours} jam lalu`;
	if (diffDays < 7) return `${diffDays} hari lalu`;
	return date.toLocaleDateString("id-ID");
}

export function NotificationBell() {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const canReadNotifications =
		dashboardRole === "owner" ||
		dashboardRole === "superowner" ||
		dashboardRole === "admin" ||
		dashboardRole === "akuntan";
	const [isOpen, setIsOpen] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [loading, setLoading] = useState(false);

	const loadUnreadCount = useCallback(async () => {
		try {
			const result = await notificationsService.getUnreadCount();
			setUnreadCount(result.count);
		} catch (err) {
			console.error("[NotificationBell] Failed to load unread count:", err);
		}
	}, []);

	const loadNotifications = useCallback(async () => {
		setLoading(true);
		try {
			const result = await notificationsService.list({ limit: 5 });
			setNotifications(result.items);
		} catch (err) {
			console.error("[NotificationBell] Failed to load notifications:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	const handleMarkAsRead = useCallback(async (id: string) => {
		try {
			await notificationsService.markAsRead(id);
			setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
			setUnreadCount((prev) => Math.max(0, prev - 1));
		} catch (err) {
			console.error("[NotificationBell] Failed to mark as read:", err);
		}
	}, []);

	useEffect(() => {
		if (!canReadNotifications) return;

		Promise.resolve().then(loadUnreadCount);
		Promise.resolve().then(loadNotifications);

		// SSE connection
		const client = getRealtimeClient();
		client.connect();

		const unsubscribe = client.subscribe((event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "notification" || data.event === "notification") {
					void loadUnreadCount();
					void loadNotifications();
				}
			} catch {
				// Ignore parse errors
			}
		});

		// Fallback polling every 60s
		const pollInterval = setInterval(() => {
			void loadUnreadCount();
		}, 60000);

		return () => {
			unsubscribe();
			clearInterval(pollInterval);
		};
	}, [canReadNotifications, loadUnreadCount, loadNotifications]);

	if (!canReadNotifications) return null;

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
				aria-label="Notifikasi"
			>
				<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					/>
				</svg>
				{unreadCount > 0 && (
					<span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{isOpen && (
				<>
					<button
						type="button"
						className="fixed inset-0 z-10"
						onClick={() => setIsOpen(false)}
						aria-label="Tutup notifikasi"
					/>
					<div className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white shadow-lg">
						<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
							<h3 className="text-sm font-semibold text-slate-900">Notifikasi</h3>
							<a
								href="/notifications"
								className="text-xs font-medium text-slate-500 hover:text-slate-700"
							>
								Lihat semua
							</a>
						</div>

						<div className="max-h-80 overflow-y-auto">
							{loading ? (
								<div className="px-4 py-6 text-center text-sm text-slate-500">Memuat...</div>
							) : notifications.length === 0 ? (
								<div className="px-4 py-6 text-center text-sm text-slate-500">
									Tidak ada notifikasi
								</div>
							) : (
								notifications.map((notification) => (
									<button
										type="button"
										key={notification.id}
										onClick={() => handleMarkAsRead(notification.id)}
										className={`w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${
											!notification.isRead ? "bg-slate-50" : ""
										}`}
									>
										<div className="flex items-start gap-3">
											{!notification.isRead && (
												<span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
											)}
											<div className={!notification.isRead ? "" : "ml-5"}>
												<p className="text-sm font-medium text-slate-900">
													{notification.title}
												</p>
												<p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
													{notification.message}
												</p>
												<p className="mt-1 text-xs text-slate-400">
													{formatRelativeTime(notification.createdAt)}
												</p>
											</div>
										</div>
									</button>
								))
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
