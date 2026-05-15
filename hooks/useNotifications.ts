"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsService } from "@/services/notifications";
import { useRealtime } from "@/providers/RealtimeProvider";
import type { Notification } from "@/types/notification";

/**
 * useNotifications — orchestration hook.
 *
 * The single place where REST and SSE are merged. UI components depend
 * only on the shape returned here, never on transport.
 *
 * Responsibilities:
 * 1. Fetch initial unread count and reconcile every 60s when tab is visible.
 * 2. Listen to SSE notification events; bump count optimistically.
 * 3. Provide list-fetch on demand (used by dropdown when opened).
 * 4. Provide markRead / markAllRead with optimistic update + revert on error.
 *
 * Visibility-aware: pauses polling while the tab is hidden, runs an
 * immediate reconcile on refocus.
 */

const POLL_INTERVAL_MS = 60_000;
const DROPDOWN_PAGE_SIZE = 10;

export interface UseNotificationsResult {
	unreadCount: number;
	list: Notification[];
	loading: boolean;
	connected: boolean;
	givenUp: boolean;
	fetchList: () => Promise<void>;
	markRead: (id: string) => Promise<void>;
	markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
	const { subscribe, connected, givenUp } = useRealtime();
	const [unreadCount, setUnreadCount] = useState(0);
	const [list, setList] = useState<Notification[]>([]);
	const [loading, setLoading] = useState(false);

	// Visibility flag survives renders without triggering re-renders itself.
	const pollingPaused = useRef(false);

	const reconcile = useCallback(async () => {
		try {
			const c = await notificationsService.unreadCount();
			setUnreadCount(c);
		} catch {
			/* transient — next tick will retry */
		}
	}, []);

	const fetchList = useCallback(async () => {
		setLoading(true);
		try {
			const res = await notificationsService.list({
				page: 1,
				limit: DROPDOWN_PAGE_SIZE,
			});
			setList(res.data ?? []);
		} catch {
			// Don't crash UI; keep last known list.
		} finally {
			setLoading(false);
		}
	}, []);

	// Initial reconcile + polling + visibility wiring (browser only).
	useEffect(() => {
		if (typeof document === "undefined") return;
		pollingPaused.current = document.visibilityState === "hidden";
		reconcile();

		const interval = setInterval(() => {
			if (!pollingPaused.current) reconcile();
		}, POLL_INTERVAL_MS);

		const onVisibility = () => {
			pollingPaused.current = document.visibilityState === "hidden";
			if (!pollingPaused.current) reconcile();
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [reconcile]);

	// SSE listener: bump count + invalidate list when an event arrives.
	useEffect(() => {
		const unsub = subscribe((e) => {
			if (
				e.event === "notification.created" ||
				e.event === "message"
			) {
				setUnreadCount((c) => c + 1);
				// Refetch list only if dropdown was opened previously
				// (list non-empty). Fresh open will refetch anyway.
				if (list.length > 0) fetchList();
			}
		});
		return unsub;
		// `list.length` intentionally read fresh inside callback via state
		// closure; we don't want to resubscribe every time list changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [subscribe, fetchList]);

	const markRead = useCallback(
		async (id: string) => {
			const prevList = list;
			const prevCount = unreadCount;
			setList(
				prevList.map((n) =>
					n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
				)
			);
			setUnreadCount(Math.max(0, prevCount - 1));
			try {
				await notificationsService.markRead(id);
			} catch (err) {
				setList(prevList);
				setUnreadCount(prevCount);
				throw err instanceof Error
					? err
					: new Error("Gagal menandai notifikasi sebagai dibaca");
			}
		},
		[list, unreadCount]
	);

	const markAllRead = useCallback(async () => {
		const prevList = list;
		const prevCount = unreadCount;
		const now = new Date().toISOString();
		setList(prevList.map((n) => ({ ...n, isRead: true, readAt: now })));
		setUnreadCount(0);
		try {
			await notificationsService.markAllRead();
		} catch (err) {
			setList(prevList);
			setUnreadCount(prevCount);
			throw err instanceof Error
				? err
				: new Error("Gagal menandai semua notifikasi sebagai dibaca");
		}
	}, [list, unreadCount]);

	return {
		unreadCount,
		list,
		loading,
		connected,
		givenUp,
		fetchList,
		markRead,
		markAllRead,
	};
}
