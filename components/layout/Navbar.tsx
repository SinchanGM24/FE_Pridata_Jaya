"use client";

import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getRoleUi } from "@/constants";
import { resolveDashboardRole } from "@/lib/auth";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface NavbarProps {
	onToggleSidebar: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const roleUi = getRoleUi(dashboardRole, user?.name);

	return (
		<header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white px-4">
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onToggleSidebar}
					className={`rounded-md border border-slate-200 px-3 py-2 ${roleUi.accentSoftClass} ${roleUi.accentTextClass}`}
					aria-label="Buka sidebar"
				>
					<Menu className="h-4 w-4" />
				</button>
				<h1 className={`text-base font-semibold md:text-lg ${roleUi.accentTextClass}`}>
					{roleUi.appTitle}
				</h1>
			</div>
			<div className="ml-auto flex items-center gap-2">
				<NotificationBell />
			</div>
		</header>
	);
}
