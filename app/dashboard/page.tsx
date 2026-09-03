"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { resolveDashboardRole, resolveEffectiveRole } from "@/lib/auth";

export default function DashboardRedirectPage() {
	const router = useRouter();
	const { user, loading } = useAuth();

	// Peran yang ada di backend tapi belum dipetakan di sini membuat
	// resolveDashboardRole mengembalikan null. Tanpa penjagaan, layout dashboard
	// mengarahkan ke getHomeRoute() -> "/dashboard", halaman ini mengarahkan
	// balik ke getHomeRoute() -> "/dashboard", dan akunnya terkunci di spinner.
	// Peran berikutnya yang lupa dipetakan harus gagal dengan pesan, bukan loop.
	const dashboardRole = user ? resolveDashboardRole(user) : null;
	const isUnmappedRole = Boolean(user) && dashboardRole === null;

	useEffect(() => {
		if (loading) return;

		if (!user) {
			router.push("/login");
			return;
		}

		if (isUnmappedRole) return;

		router.push(authService.getHomeRoute(user));
	}, [user, loading, router, isUnmappedRole]);

	if (isUnmappedRole && user) {
		// rawOrganizationRole adalah nilai apa adanya dari backend. resolveEffectiveRole
		// jatuh ke system role ("user") ketika peran organisasinya tidak dikenal, yang
		// justru menyembunyikan peran mana yang sebenarnya belum dipetakan.
		const effectiveRole =
			user.rawOrganizationRole ?? resolveEffectiveRole(user) ?? user.role ?? "tidak diketahui";

		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
				<div className="w-full max-w-md rounded-lg border border-amber-200 bg-white p-6 text-center shadow-sm">
					<h1 className="text-lg font-semibold text-slate-900">
						Peran belum didukung di antarmuka ini
					</h1>
					<p className="mt-2 text-sm text-slate-600">
						Akun{" "}
						<span className="font-medium text-slate-900">{user.email}</span> memakai peran{" "}
						<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
							{effectiveRole}
						</code>
						, yang belum punya halaman di aplikasi ini. Hubungi owner untuk mengubah peran
						akun Anda.
					</p>
					<button
						type="button"
						onClick={() => void authService.logout()}
						className="mt-5 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
					>
						Keluar
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
				<p className="text-gray-600">Loading dashboard...</p>
			</div>
		</div>
	);
}
