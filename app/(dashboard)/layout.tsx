"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_ALLOWED_PREFIXES } from "@/constants";
import { resolveDashboardRole } from "@/lib/auth";
import { authService } from "@/services/auth";
import { RealtimeProvider } from "@/providers/RealtimeProvider";
import { NotificationToastHost } from "@/components/notifications/NotificationToastHost";

/**
 * Roles that should establish an SSE connection. Mirrors BE
 * NOTIFICATION_READ_ROLES so we don't burn a handshake for roles that
 * the BE will reject anyway.
 */
const REALTIME_ELIGIBLE_ROLES = new Set(["owner", "accountant"]);

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const { user, loading } = useAuth();
	const [sidebarOpen, setSidebarOpen] = useState(true);

	useEffect(() => {
		if (loading) return;
		if (!user) {
			router.push("/login");
			return;
		}

		const effectiveRole = resolveDashboardRole(user);
		const allowedPrefixes =
			(effectiveRole && ROLE_ALLOWED_PREFIXES[effectiveRole]) ?? ["/dashboard"];
		const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
		if (!isAllowed) {
			router.push(authService.getHomeRoute(user));
		}
	}, [loading, pathname, router, user]);

	const externalPortal = pathname.startsWith("/toko") || pathname.startsWith("/sales");
	if (externalPortal) {
		return <>{children}</>;
	}

	const hideSidebarNavigation = pathname.startsWith("/fakturis/pembuatan-invoice");
	const role = resolveDashboardRole(user);
	const realtimeEligible = !!role && REALTIME_ELIGIBLE_ROLES.has(role);

	const shell = (
		<div className="min-h-screen md:flex">
			<Sidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				hideNavigation={hideSidebarNavigation}
			/>
			<div className="flex min-h-screen flex-1 flex-col">
				<Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
				<main className="flex-1 p-4 md:p-6">{children}</main>
			</div>
		</div>
	);

	return (
		<>
			<Toaster position="top-right" richColors />
			{realtimeEligible ? (
				<RealtimeProvider>
					<NotificationToastHost />
					{shell}
				</RealtimeProvider>
			) : (
				shell
			)}
		</>
	);
}
