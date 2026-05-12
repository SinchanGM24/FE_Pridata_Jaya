"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";

export default function DashboardRedirectPage() {
	const router = useRouter();
	const { user, loading } = useAuth();

	useEffect(() => {
		if (loading) return;

		if (!user) {
			router.push("/login");
			return;
		}

		const homeRoute = authService.getHomeRoute(user);
		router.push(homeRoute);
	}, [user, loading, router]);

	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
				<p className="text-gray-600">Loading dashboard...</p>
			</div>
		</div>
	);
}
