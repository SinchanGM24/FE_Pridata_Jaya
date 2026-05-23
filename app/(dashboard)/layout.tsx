"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_ALLOWED_PREFIXES } from "@/constants";
import { resolveDashboardRole } from "@/lib/auth";
import { authService } from "@/services/auth";

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

	return (
		<div className="min-h-screen bg-[linear-gradient(180deg,rgba(246,248,251,0.98),rgba(239,243,248,0.98))] md:flex">
			<Sidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				hideNavigation={false}
			/>
			<div className="flex min-h-screen flex-1 flex-col">
				<Navbar
					isSidebarOpen={sidebarOpen}
					onOpenSidebar={() => setSidebarOpen(true)}
					onCloseSidebar={() => setSidebarOpen(false)}
				/>
				<main className="flex-1 p-4 md:p-6">{children}</main>
			</div>
		</div>
	);
}
