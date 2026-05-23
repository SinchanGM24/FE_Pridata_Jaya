"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	notificationsService,
	type NotificationItem,
	type NotificationListParams,
} from "@/services/notifications";
import { getRealtimeClient } from "@/services/realtime";

function formatDateTime(dateString: string): string {
	const date = new Date(dateString);
	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const loadNotifications = useCallback(async () => {
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
	}, [page, filter]);

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
		Promise.resolve().then(loadNotifications);
	}, [loadNotifications]);

	useEffect(() => {
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
	}, [loadNotifications]);

	const unreadCount = notifications.filter((n) => !n.isRead).length;

	return (
		<FeaturePage title="Notifikasi" description="Kelola semua notifikasi Anda.">
			<section className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setFilter("all")}
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
						onClick={() => setFilter("unread")}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
							filter === "unread"
								? "bg-slate-900 text-white"
								: "bg-white text-slate-600 hover:bg-slate-100"
						}`}
					>
						Belum Dibaca {unreadCount > 0 && `(${unreadCount})`}
					</button>
				</div>

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
				) : (
					<div className="divide-y divide-slate-100">
						{notifications.map((notification) => (
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
											<p className="mt-1 text-xs text-slate-400">
												{formatDateTime(notification.createdAt)}
											</p>
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
