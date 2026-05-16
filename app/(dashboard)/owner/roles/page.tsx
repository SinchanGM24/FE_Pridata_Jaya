"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { useAuth } from "@/hooks/useAuth";
import { resolveDashboardRole } from "@/lib/auth";
import {
	rolesService,
	type RoleSummary,
	type RoleDetail,
	type Permission,
} from "@/services/roles";

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

function PermissionConditions({ conditions }: { conditions?: Record<string, unknown> }) {
	if (!conditions || Object.keys(conditions).length === 0) {
		return <span className="text-slate-400">-</span>;
	}

	return (
		<div className="space-y-1">
			{Object.entries(conditions).map(([key, value]) => (
				<div key={key} className="text-xs">
					<span className="font-medium text-slate-600">{key}:</span>{" "}
					<span className="text-slate-500">
						{typeof value === "object" ? JSON.stringify(value) : String(value)}
					</span>
				</div>
			))}
		</div>
	);
}

function PermissionsTable({ permissions }: { permissions: Permission[] }) {
	if (permissions.length === 0) {
		return <p className="px-4 py-3 text-sm text-slate-500">Tidak ada permission.</p>;
	}

	return (
		<table className="min-w-full divide-y divide-slate-200 text-sm">
			<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
				<tr>
					<th className="px-4 py-3">Resource</th>
					<th className="px-4 py-3">Action</th>
					<th className="px-4 py-3">Conditions</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-slate-100">
				{permissions.map((permission, index) => (
					<tr key={`${permission.resource}-${permission.action}-${index}`}>
						<td className="px-4 py-3 font-medium text-slate-900">
							{permission.resource}
						</td>
						<td className="px-4 py-3 text-slate-700">{permission.action}</td>
						<td className="px-4 py-3">
							<PermissionConditions conditions={permission.conditions} />
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function RoleDetailPanel({
	role,
	detail,
	loading,
	onClose,
}: {
	role: string;
	detail: RoleDetail | null;
	loading: boolean;
	onClose: () => void;
}) {
	return (
		<div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
			<div className="mb-4 flex items-center justify-between">
				<h3 className="font-semibold text-slate-900">
					Permission untuk role: {role}
				</h3>
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
				>
					Tutup
				</button>
			</div>
			{loading ? (
				<p className="px-4 py-3 text-sm text-slate-600">Memuat detail...</p>
			) : detail ? (
				<div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
					<PermissionsTable permissions={detail.permissions} />
				</div>
			) : (
				<p className="px-4 py-3 text-sm text-red-600">Gagal memuat detail role.</p>
			)}
		</div>
	);
}

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
	const [expandedRole, setExpandedRole] = useState<string | null>(null);
	const [roleDetail, setRoleDetail] = useState<RoleDetail | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);

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

	const handleRoleClick = async (roleName: string) => {
		if (expandedRole === roleName) {
			setExpandedRole(null);
			setRoleDetail(null);
			return;
		}

		setExpandedRole(roleName);
		setRoleDetail(null);
		setLoadingDetail(true);
		try {
			const detail = await rolesService.getDetail(roleName);
			setRoleDetail(detail);
		} catch {
			setRoleDetail(null);
		} finally {
			setLoadingDetail(false);
		}
	};

	if (!canAccess) {
		return (
			<FeaturePage
				title="Daftar Role"
				description="Lihat semua role dan permission yang tersedia."
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
			description="Lihat semua role yang tersedia di sistem beserta permission masing-masing role."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
					<h2 className="font-semibold text-slate-900">
						Semua Role ({roles.length})
					</h2>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>

				{loading ? (
					<div className="px-4 py-8 text-sm text-slate-600">Memuat...</div>
				) : roles.length === 0 ? (
					<div className="px-4 py-8 text-sm text-slate-600">
						Tidak ada role yang tersedia.
					</div>
				) : (
					<div className="divide-y divide-slate-200">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-4 py-3">Nama Role</th>
									<th className="px-4 py-3">Deskripsi</th>
									<th className="px-4 py-3">Jumlah User</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{roles.map((role) => (
									<tr
										key={role.name}
										onClick={() => handleRoleClick(role.name)}
										className="cursor-pointer hover:bg-slate-50 transition-colors"
									>
										<td className="px-4 py-3 font-medium text-slate-900">
											{role.name}
										</td>
										<td className="px-4 py-3 text-slate-700">
											{role.description || "-"}
										</td>
										<td className="px-4 py-3 text-slate-700">
											{role.userCount ?? 0}
										</td>
									</tr>
								))}
							</tbody>
						</table>

						{expandedRole ? (
							<RoleDetailPanel
								role={expandedRole}
								detail={roleDetail}
								loading={loadingDetail}
								onClose={() => {
									setExpandedRole(null);
									setRoleDetail(null);
								}}
							/>
						) : null}
					</div>
				)}
			</section>
		</FeaturePage>
	);
}
