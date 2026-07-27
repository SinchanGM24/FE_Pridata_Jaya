"use client";

import { useState } from "react";
import {
	rolesService,
	type AppRoleAccess,
	type RoleDetail,
	type RoleSummary,
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

function RoleAccessDetail({
	role,
	detail,
	loading,
	error,
	onClose,
}: {
	role: RoleSummary;
	detail: RoleDetail | null;
	loading: boolean;
	error: string;
	onClose: () => void;
}) {
	const rows: AppRoleAccess[] = detail?.appAccess ?? role.appAccess ?? [];

	return (
		<div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold text-slate-900">
						Akses role {detail?.label ?? role.label ?? role.name}
					</h3>
					<p className="mt-1 text-xs text-slate-500">
						Daftar fitur aplikasi yang dapat digunakan oleh role ini.
					</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
				>
					Tutup
				</button>
			</div>

			{loading ? (
				<p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
					Memuat akses role...
				</p>
			) : error ? (
				<p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</p>
			) : rows.length === 0 ? (
				<p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
					Belum ada akses fitur aplikasi yang didokumentasikan untuk role ini.
				</p>
			) : (
				<div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Area Fitur</th>
								<th className="px-4 py-3">Akses yang Bisa Dilakukan</th>
								<th className="px-4 py-3">Cakupan Data</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{rows.map((item) => (
								<tr key={`${item.area}-${item.access}`}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{item.area}
									</td>
									<td className="px-4 py-3 text-slate-700">{item.access}</td>
									<td className="px-4 py-3 text-slate-600">{item.scope}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

export default function RoleAccessOverview({
	roles,
	loading,
}: {
	roles: RoleSummary[];
	loading: boolean;
}) {
	const [expandedRole, setExpandedRole] = useState<string | null>(null);
	const [roleDetail, setRoleDetail] = useState<RoleDetail | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [detailError, setDetailError] = useState("");

	const selectedRole = roles.find((role) => role.name === expandedRole) ?? null;

	const openRole = async (role: RoleSummary) => {
		if (expandedRole === role.name) {
			setExpandedRole(null);
			setRoleDetail(null);
			setDetailError("");
			return;
		}

		setExpandedRole(role.name);
		setRoleDetail(null);
		setDetailError("");
		setLoadingDetail(true);
		try {
			const detail = await rolesService.getDetail(role.name);
			setRoleDetail(detail);
		} catch (error: unknown) {
			setDetailError(getErrorMessage(error, "Gagal memuat detail akses role."));
		} finally {
			setLoadingDetail(false);
		}
	};

	return (
		<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="font-semibold text-slate-900">Referensi Role & Akses</h2>
					<p className="mt-1 text-sm text-slate-600">
						Gunakan tabel ini untuk menentukan role yang tepat saat mengundang atau mengubah akses anggota.
					</p>
				</div>
			</div>

			{loading ? (
				<div className="px-4 py-8 text-sm text-slate-600">Memuat role...</div>
			) : roles.length === 0 ? (
				<div className="px-4 py-8 text-sm text-slate-600">Tidak ada role yang tersedia.</div>
			) : (
				<div className="divide-y divide-slate-100">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
								<tr>
									<th className="px-4 py-3">Role</th>
									<th className="px-4 py-3">Kegunaan</th>
									<th className="px-4 py-3">Pengguna</th>
									<th className="px-4 py-3">Sumber Akses</th>
									<th className="px-4 py-3">Detail</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{roles.map((role) => {
									const expanded = expandedRole === role.name;

									return (
										<tr key={role.name} className={expanded ? "bg-slate-50" : undefined}>
											<td className="px-4 py-3 align-top">
												<div className="font-semibold text-slate-900">
													{role.label ?? role.name}
												</div>
												<div className="mt-1 text-xs text-slate-500">{role.name}</div>
											</td>
											<td className="max-w-xl px-4 py-3 align-top text-slate-700">
												{role.description || "Tidak ada deskripsi."}
											</td>
											<td className="px-4 py-3 align-top">
												<span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
													{role.userCount ?? 0} user
												</span>
											</td>
											<td className="px-4 py-3 align-top text-slate-700">
												{role.sourceAccess ?? (role.assignable === false ? "Konfigurasi sistem" : "Undangan anggota internal")}
											</td>
											<td className="px-4 py-3 align-top">
												<button
													type="button"
													onClick={() => {
														void openRole(role);
													}}
													className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
												>
													{expanded ? "Tutup" : "Lihat"}
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{selectedRole ? (
						<RoleAccessDetail
							role={selectedRole}
							detail={roleDetail}
							loading={loadingDetail}
							error={detailError}
							onClose={() => {
								setExpandedRole(null);
								setRoleDetail(null);
								setDetailError("");
							}}
						/>
					) : null}
				</div>
			)}
		</section>
	);
}
