"use client";

import type { Notification } from "@/types/notification";

/**
 * NotificationItem — single row in the dropdown list.
 *
 * Dumb component: no state, no side effects, props only. Parent
 * (NotificationDropdown) owns the click handler and passes it down.
 *
 * Visual: unread items have a light background; read items are dimmed.
 */
export interface NotificationItemProps {
	notification: Notification;
	onClick: (n: Notification) => void;
}

export function NotificationItem({
	notification: n,
	onClick,
}: NotificationItemProps) {
	return (
		<button
			type="button"
			onClick={() => onClick(n)}
			className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 ${
				n.isRead ? "opacity-60" : "bg-blue-50"
			}`}
		>
			<span className="font-medium text-slate-900">{n.title}</span>
			<span className="text-xs text-slate-600">{n.message}</span>
			<span className="text-[10px] text-slate-400">
				{new Date(n.createdAt).toLocaleString("id-ID", {
					dateStyle: "short",
					timeStyle: "short",
				})}
			</span>
		</button>
	);
}
