"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { resolveNotificationRoute } from "@/lib/notifications/route-resolver";
import type { Notification } from "@/types/notification";
import { NotificationItem } from "./NotificationItem";

/**
 * NotificationDropdown — panel rendered when the bell is clicked.
 *
 * Owns:
 * - Triggering list fetch on open.
 * - Mark-all-read action (with optimistic update + revert via hook).
 * - Click-to-redirect via `resolveNotificationRoute`.
 *
 * Does not own:
 * - Open/close state (parent NotificationBell controls).
 * - Polling / SSE wiring (hook + provider).
 */
export interface NotificationDropdownProps {
	open: boolean;
	onClose: () => void;
}

export function NotificationDropdown({
	open,
	onClose,
}: NotificationDropdownProps) {
	const { list, loading, fetchList, markRead, markAllRead } =
		useNotifications();
	const router = useRouter();

	useEffect(() => {
		if (open) fetchList();
	}, [open, fetchList]);

	const handleClick = async (n: Notification) => {
		try {
			if (!n.isRead) await markRead(n.id);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Gagal menandai notifikasi"
			);
			// Stop here so we don't redirect on a failed mark-read.
			return;
		}
		const url = resolveNotificationRoute(n.entityType, n.entityId);
		if (url) {
			onClose();
			router.push(url);
		}
		// No URL → stay open, item already marked read.
	};

	const handleMarkAll = async () => {
		try {
			await markAllRead();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Gagal menandai semua notifikasi"
			);
		}
	};

	if (!open) return null;

	return (
		<div className="absolute right-0 top-12 z-30 w-96 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
			<div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
				<span className="text-sm font-semibold text-slate-900">
					Notifikasi
				</span>
				<button
					type="button"
					onClick={handleMarkAll}
					className="text-xs text-blue-600 hover:underline"
				>
					Tandai semua dibaca
				</button>
			</div>
			<div className="max-h-96 overflow-y-auto">
				{loading && (
					<div className="px-4 py-6 text-center text-xs text-slate-400">
						Memuat...
					</div>
				)}
				{!loading && list.length === 0 && (
					<div className="px-4 py-8 text-center text-xs text-slate-400">
						Tidak ada notifikasi
					</div>
				)}
				{!loading &&
					list.map((n) => (
						<NotificationItem
							key={n.id}
							notification={n}
							onClick={handleClick}
						/>
					))}
			</div>
		</div>
	);
}
