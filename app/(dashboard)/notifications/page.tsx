"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	notificationsService,
	type NotificationItem,
	type NotificationListParams,
} from "@/services/notifications";
import { getRealtimeClient } from "@/services/realtime";
import { useAuth } from "@/hooks/useAuth";
import { resolveDashboardRole } from "@/lib/auth";

function formatDateTime(dateString: string): string {
	const date = new Date(dateString);
	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export default function NotificationsPage() {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const canReadNotifications =
		dashboardRole === "owner" ||
		dashboardRole === "superowner" ||
		dashboardRole === "admin";
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const loadNotifications = useCallback(async () => {
		if (!canReadNotifications) return;
		setLoading(true);
		setError(null);
		try {
			const params: NotificationListParams = {
				page,
				limit: 20,
			};
			if (filter === "unread") {
				params.isRead = false;
			}

			const result = await notificationsService.list(params);
			setNotifications(result.items);
			setTotalPages(result.meta.totalPages);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memuat notifikasi");
		} finally {
			setLoading(false);
		}
	}, [canReadNotifications, page, filter]);

	const handleMarkAsRead = useCallback(async (id: string) => {
		try {
			await notificationsService.markAsRead(id);
			setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
		} catch (err) {
			console.error("Failed to mark as read:", err);
		}
	}, []);

	const handleMarkAllAsRead = useCallback(async () => {
		try {
			await notificationsService.markAllAsRead();
			setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
		} catch (err) {
			console.error("Failed to mark all as read:", err);
		}
	}, []);

	const handleDelete = useCallback(async (id: string) => {
		try {
			await notificationsService.delete(id);
			setNotifications((prev) => prev.filter((n) => n.id !== id));
		} catch (err) {
			console.error("Failed to delete notification:", err);
		}
	}, []);

	useEffect(() => {
		if (!canReadNotifications) return;
		Promise.resolve().then(loadNotifications);
	}, [canReadNotifications, loadNotifications]);

	useEffect(() => {
		if (!canReadNotifications) return;
		// SSE connection for realtime updates
		const client = getRealtimeClient();
		client.connect();

		const unsubscribe = client.subscribe((event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "notification" || data.event === "notification") {
					void loadNotifications();
				}
			} catch {
				// Ignore parse errors
			}
		});

		return () => {
			unsubscribe();
		};
	}, [canReadNotifications, loadNotifications]);

	const unreadCount = notifications.filter((n) => !n.isRead).length;
	const normalizedSearch = search.trim().toLowerCase();
	const visibleNotifications = normalizedSearch
		? notifications.filter((notification) =>
				[
					notification.title,
					notification.message,
					notification.type,
					notification.entityType ?? "",
				]
					.join(" ")
					.toLowerCase()
					.includes(normalizedSearch),
			)
		: notifications;

	if (!canReadNotifications) {
		return (
			<FeaturePage title="Notifikasi" description="Fitur notifikasi saat ini hanya tersedia untuk owner.">
				<section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-600 shadow-sm">
					Halaman notifikasi belum tersedia untuk role ini.
				</section>
			</FeaturePage>
		);
	}

	return (
		<FeaturePage title="Notifikasi" description="Kelola semua notifikasi Anda.">
			<section className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => {
							setFilter("all");
							setPage(1);
						}}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
							filter === "all"
								? "bg-slate-900 text-white"
								: "bg-white text-slate-600 hover:bg-slate-100"
						}`}
					>
						Semua
					</button>
					<button
						type="button"
						onClick={() => {
							setFilter("unread");
							setPage(1);
						}}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
							filter === "unread"
								? "bg-slate-900 text-white"
								: "bg-white text-slate-600 hover:bg-slate-100"
						}`}
					>
						Belum Dibaca {unreadCount > 0 && `(${unreadCount})`}
					</button>
				</div>

				<label className="min-w-[240px] flex-1 md:max-w-md">
					<span className="sr-only">Cari notifikasi</span>
					<input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Cari judul, pesan, atau tipe..."
						className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
					/>
				</label>

				{unreadCount > 0 && (
					<button
						type="button"
						onClick={handleMarkAllAsRead}
						className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
					>
						Tandai Semua Dibaca
					</button>
				)}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
				{loading ? (
					<div className="px-6 py-12 text-center text-sm text-slate-500">
						Memuat notifikasi...
					</div>
				) : error ? (
					<div className="px-6 py-12 text-center text-sm text-red-600">{error}</div>
				) : notifications.length === 0 ? (
					<div className="px-6 py-12 text-center text-sm text-slate-500">
						Tidak ada notifikasi.
					</div>
				) : visibleNotifications.length === 0 ? (
					<div className="px-6 py-12 text-center text-sm text-slate-500">
						Tidak ada notifikasi yang cocok dengan pencarian.
					</div>
				) : (
					<div className="divide-y divide-slate-100">
						{visibleNotifications.map((notification) => (
							<div
								key={notification.id}
								className={`flex items-start gap-4 px-6 py-4 ${
									!notification.isRead ? "bg-slate-50" : ""
								}`}
							>
								<div className="flex-1">
									<div className="flex items-start justify-between gap-4">
										<div>
											<div className="flex items-center gap-2">
												{!notification.isRead && (
													<span className="h-2 w-2 rounded-full bg-blue-500" />
												)}
												<h4 className="text-sm font-medium text-slate-900">
													{notification.title}
												</h4>
											</div>
											<p className="mt-1 text-sm text-slate-600">{notification.message}</p>
											<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
												<span>{formatDateTime(notification.createdAt)}</span>
												<span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
													{notification.type}
												</span>
											</div>
										</div>

										<div className="flex items-center gap-2">
											{!notification.isRead && (
												<button
													type="button"
													onClick={() => handleMarkAsRead(notification.id)}
													className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
												>
													Tandai Dibaca
												</button>
											)}
											<button
												type="button"
												onClick={() => handleDelete(notification.id)}
												className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
											>
												Hapus
											</button>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{totalPages > 1 && (
					<div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
						<button
							type="button"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
							className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<span className="text-sm text-slate-500">
							Halaman {page} dari {totalPages}
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page === totalPages}
							className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Selanjutnya
						</button>
					</div>
				)}
			</section>
		</FeaturePage>
	);
}
