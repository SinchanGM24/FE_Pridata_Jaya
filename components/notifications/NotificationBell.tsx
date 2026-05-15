"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDropdown } from "./NotificationDropdown";

/**
 * NotificationBell — bell icon + unread badge in the navbar.
 *
 * Role gate: only `owner` and `accountant` see the bell. This matches BE
 * `NOTIFICATION_READ_ROLES`. Other roles see nothing (component returns
 * null) so we don't make wasted REST calls.
 *
 * Click toggles dropdown. Outside-click closes dropdown.
 */
export interface NotificationBellProps {
	role: string | undefined | null;
}

const ELIGIBLE_ROLES = new Set(["owner", "accountant"]);

export function NotificationBell({ role }: NotificationBellProps) {
	const eligible = !!role && ELIGIBLE_ROLES.has(role);

	// Hook is only called when eligible; we keep a stable wrapper to avoid
	// conditional hook call (React rule). Hook itself is cheap when not used.
	if (!eligible) return null;
	return <EligibleBell />;
}

function EligibleBell() {
	const [open, setOpen] = useState(false);
	const { unreadCount } = useNotifications();
	const ref = useRef<HTMLDivElement>(null);

	// Outside click closes dropdown.
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		window.addEventListener("mousedown", handler);
		return () => window.removeEventListener("mousedown", handler);
	}, [open]);

	const display = unreadCount > 99 ? "99+" : String(unreadCount);

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
				aria-label="Notifikasi"
				aria-haspopup="menu"
				aria-expanded={open}
			>
				<Bell className="h-4 w-4" />
				{unreadCount > 0 && (
					<span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-tight text-white">
						{display}
					</span>
				)}
			</button>
			<NotificationDropdown open={open} onClose={() => setOpen(false)} />
		</div>
	);
}
