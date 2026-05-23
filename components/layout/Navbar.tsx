"use client";

import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getRoleUi } from "@/constants";
import { resolveDashboardRole } from "@/lib/auth";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface NavbarProps {
	isSidebarOpen: boolean;
	onOpenSidebar: () => void;
	onCloseSidebar: () => void;
}

export function Navbar({ isSidebarOpen, onOpenSidebar, onCloseSidebar }: NavbarProps) {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const roleUi = getRoleUi(dashboardRole, user?.name);

	return (
		<header className="sticky top-0 z-40 flex h-16 items-center border-b border-white/70 bg-white/72 px-4 backdrop-blur-xl">
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => {
						if (isSidebarOpen) {
							onCloseSidebar();
							return;
						}
						onOpenSidebar();
					}}
					className={`rounded-2xl border border-white/90 bg-white/90 px-3 py-2 transition hover:bg-white ${roleUi.accentSoftClass} ${roleUi.accentTextClass}`}
					aria-label={isSidebarOpen ? "Sembunyikan sidebar" : "Buka sidebar"}
					aria-expanded={isSidebarOpen}
				>
					<Menu className="h-4 w-4" />
				</button>
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
						Panel Kerja
					</p>
					<h1 className={`text-base font-semibold md:text-lg ${roleUi.accentTextClass}`}>
					{roleUi.appTitle}
					</h1>
				</div>
			</div>
			<div className="ml-auto flex items-center gap-2">
				<NotificationBell />
			</div>
		</header>
	);
}
