"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import RoleAccessOverview from "@/components/owner/RoleAccessOverview";
import { useAuth } from "@/hooks/useAuth";
import { resolveDashboardRole } from "@/lib/auth";
import { rolesService, type RoleSummary } from "@/services/roles";

const getErrorMessage = (error: unknown, fallback: string): string => {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: { data?: { message?: string } } }).response
			?.data?.message === "string"
	) {
		return (
			(error as { response?: { data?: { message?: string } } }).response?.data
				?.message ?? fallback
		);
	}

	return fallback;
};

export default function RolesPage() {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const canAccess =
		dashboardRole === "owner" ||
		dashboardRole === "admin" ||
		dashboardRole === "superowner";

	const [roles, setRoles] = useState<RoleSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const result = await rolesService.list();
			setRoles(result.items);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Gagal memuat data role."));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const roleStats = useMemo(() => {
		const assignableCount = roles.filter((role) => role.assignable !== false).length;
		const activeUserCount = roles.reduce((total, role) => total + (role.userCount ?? 0), 0);
		return { assignableCount, activeUserCount };
	}, [roles]);

	if (!canAccess) {
		return (
			<FeaturePage
				title="Daftar Role"
				description="Referensi role dan akses aplikasi."
			>
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					Akses ditolak. Hanya owner dan admin yang dapat mengakses halaman ini.
				</div>
			</FeaturePage>
		);
	}

	return (
		<FeaturePage
			title="Daftar Role"
			description={`Referensi ${roles.length} role, ${roleStats.assignableCount} bisa diundang, ${roleStats.activeUserCount} akses aktif.`}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<RoleAccessOverview roles={roles} loading={loading} />
		</FeaturePage>
	);
}
