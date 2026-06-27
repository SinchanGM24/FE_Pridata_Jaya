"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import type { UserRole } from "@/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/constants";
import { useAuth } from "@/hooks/useAuth";
import { resolveDashboardRole } from "@/lib/auth";
import {
	membersService,
	type OrganizationMember,
} from "@/services/members";
import { rolesService, type RoleSummary } from "@/services/roles";
import RoleAccessOverview from "@/components/owner/RoleAccessOverview";

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

interface AccessFormState {
	email: string;
	role: UserRole;
}

const emptyAccessForm = (): AccessFormState => ({
	email: "",
	role: "sales",
});

export default function MembersPage() {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const canManage =
		dashboardRole === "owner" ||
		dashboardRole === "admin" ||
		dashboardRole === "superowner";

	const [members, setMembers] = useState<OrganizationMember[]>([]);
	const [roles, setRoles] = useState<RoleSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [feedback, setFeedback] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const [accessModalOpen, setAccessModalOpen] = useState(false);
	const [accessForm, setAccessForm] = useState<AccessFormState>(emptyAccessForm);
	const [accessError, setAccessError] = useState("");
	const [grantingAccess, setGrantingAccess] = useState(false);

	const [editModalOpen, setEditModalOpen] = useState(false);
	const [memberToEdit, setMemberToEdit] = useState<OrganizationMember | null>(null);
	const [editRole, setEditRole] = useState<UserRole>("sales");
	const [editError, setEditError] = useState("");
	const [savingEdit, setSavingEdit] = useState(false);
	const [removeAccessConfirmOpen, setRemoveAccessConfirmOpen] = useState(false);
	const [removingAccess, setRemovingAccess] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [membersResult, rolesResult] = await Promise.all([
				membersService.list(),
				rolesService.list(),
			]);
			setMembers(membersResult.items);
			setRoles(rolesResult.items);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Gagal memuat data anggota."));
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

	const handleGrantAccess = async () => {
		setAccessError("");
		setGrantingAccess(true);
		try {
			if (!accessForm.email.trim()) {
				throw new Error("Email wajib diisi.");
			}

			await membersService.invite({
				email: accessForm.email.trim(),
				role: accessForm.role,
			});
			setAccessForm(emptyAccessForm);
			setAccessModalOpen(false);
			await load();
			setFeedback({ type: "success", message: "Undangan akses berhasil dikirim." });
		} catch (err: unknown) {
			setAccessError(getErrorMessage(err, "Gagal mengirim undangan akses."));
		} finally {
			setGrantingAccess(false);
		}
	};

	const openEditModal = (member: OrganizationMember) => {
		setMemberToEdit(member);
		setEditRole(member.role);
		setEditError("");
		setEditModalOpen(true);
	};

	const handleSaveMemberAccess = async () => {
		if (!memberToEdit) return;

		setEditError("");
		setSavingEdit(true);
		try {
			if (editRole !== memberToEdit.role) {
				await membersService.updateRole(memberToEdit.id, editRole);
			}
			setMembers((prev) =>
				prev.map((m) => (m.id === memberToEdit.id ? { ...m, role: editRole } : m)),
			);
			setEditModalOpen(false);
			setMemberToEdit(null);
			setFeedback({ type: "success", message: "Akses anggota berhasil diperbarui." });
		} catch (err: unknown) {
			setEditError(getErrorMessage(err, "Gagal memperbarui akses anggota."));
		} finally {
			setSavingEdit(false);
		}
	};

	const handleRemoveMemberAccess = async () => {
		if (!memberToEdit) return;
		setRemovingAccess(true);
		try {
			await membersService.remove(memberToEdit.id);
			setRemoveAccessConfirmOpen(false);
			setEditModalOpen(false);
			setMemberToEdit(null);
			await load();
			setFeedback({ type: "success", message: "Akses anggota berhasil dihapus. Akun user tetap tersimpan." });
		} catch (err: unknown) {
			setFeedback({
				type: "error",
				message: getErrorMessage(err, "Gagal menghapus akses anggota."),
			});
		} finally {
			setRemovingAccess(false);
		}
	};

	const formatDate = (dateStr: string): string => {
		try {
			return new Date(dateStr).toLocaleDateString("id-ID", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
		} catch {
			return dateStr;
		}
	};

	const availableRoles = useMemo(() => {
		return roles.filter((role) => role.assignable !== false).map((r) => ({
			value: r.name as UserRole,
			label: r.label || ROLE_LABELS[r.name as UserRole] || r.name,
		}));
	}, [roles]);

	const defaultAccessRole =
		availableRoles.find((role) => role.value === "sales")?.value ??
		availableRoles[0]?.value ??
		"sales";

	if (!canManage) {
		return (
			<FeaturePage
				title="Anggota Organisasi"
				description="Manajemen anggota organisasi internal."
			>
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					Akses ditolak. Hanya owner dan admin yang dapat mengakses halaman ini.
				</div>
			</FeaturePage>
		);
	}

	return (
		<FeaturePage
			title="Anggota Organisasi"
			description="Kelola anggota aktif organisasi internal. Undangan dikirim lewat email, sementara perubahan role dan penghapusan akses dilakukan melalui modal edit."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{feedback ? (
				<div
					className={`rounded-xl px-4 py-3 text-sm ${
						feedback.type === "success"
							? "border border-green-200 bg-green-50 text-green-700"
							: "border border-red-200 bg-red-50 text-red-700"
					}`}
				>
					{feedback.message}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
					<h2 className="font-semibold text-slate-900">
						Anggota Aktif ({members.length})
					</h2>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => {
								setAccessError("");
								setAccessForm({
									email: "",
									role: defaultAccessRole,
								});
								setAccessModalOpen(true);
							}}
							className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
						>
							Undang Anggota
						</button>
					</div>
				</div>

				{loading ? (
					<div className="px-4 py-8 text-sm text-slate-600">Memuat...</div>
				) : members.length === 0 ? (
					<div className="px-4 py-8 text-sm text-slate-600">
						Belum ada anggota.
					</div>
				) : (
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Nama</th>
								<th className="px-4 py-3">Email</th>
								<th className="px-4 py-3">Role</th>
								<th className="px-4 py-3">Bergabung</th>
								<th className="px-4 py-3">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{members.map((member) => (
								<tr key={member.id}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{member.name}
									</td>
									<td className="px-4 py-3 text-slate-700">{member.email}</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
												ROLE_COLORS[member.role] ?? "border border-slate-200 bg-slate-50 text-slate-700"
											}`}
										>
											{ROLE_LABELS[member.role] ?? member.role}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{formatDate(member.createdAt)}
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => openEditModal(member)}
											className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
										>
											Edit
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>

			<RoleAccessOverview roles={roles} loading={loading} />

			<Modal
				isOpen={accessModalOpen}
				onClose={() => {
					if (grantingAccess) return;
					setAccessModalOpen(false);
					setAccessError("");
				}}
				title="Undang Anggota"
			>
				<div className="space-y-4">
					{accessError ? (
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{accessError}
						</div>
					) : null}

					<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
						Masukkan email akun yang akan diberi akses organisasi internal. Daftar undangan tertunda tidak ditampilkan di halaman ini.
					</div>

					<label className="space-y-2 text-sm text-slate-700">
						<span>Email</span>
						<input
							type="email"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={accessForm.email}
							onChange={(e) =>
								setAccessForm((prev) => ({ ...prev, email: e.target.value }))
							}
							disabled={grantingAccess}
							placeholder="email@contoh.com"
						/>
					</label>

					<label className="space-y-2 text-sm text-slate-700">
						<span>Role Internal</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={accessForm.role}
							onChange={(e) =>
								setAccessForm((prev) => ({
									...prev,
									role: e.target.value as UserRole,
								}))
							}
							disabled={grantingAccess}
						>
							{availableRoles.length > 0 ? (
								availableRoles.map((r) => (
									<option key={r.value} value={r.value}>
										{r.label}
									</option>
								))
							) : (
								<option value="sales">Sales</option>
							)}
						</select>
					</label>

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setAccessModalOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={grantingAccess}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleGrantAccess}
							className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
							disabled={grantingAccess || !accessForm.email.trim()}
						>
							{grantingAccess ? "Mengirim..." : "Kirim Undangan"}
						</button>
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={editModalOpen}
				onClose={() => {
					if (savingEdit || removingAccess) return;
					setEditModalOpen(false);
					setMemberToEdit(null);
					setEditError("");
				}}
				title="Edit Akses Anggota"
			>
				<div className="space-y-4">
					{editError ? (
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{editError}
						</div>
					) : null}

					<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
						<p className="font-semibold text-slate-900">{memberToEdit?.name}</p>
						<p className="mt-1 text-slate-600">{memberToEdit?.email}</p>
						<p className="mt-2 text-xs text-slate-500">
							Perubahan di modal ini hanya mengatur akses organisasi internal, bukan menghapus akun login.
						</p>
					</div>

					<label className="space-y-2 text-sm text-slate-700">
						<span>Role Internal</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={editRole}
							onChange={(e) => setEditRole(e.target.value as UserRole)}
							disabled={savingEdit || removingAccess}
						>
							{availableRoles.length > 0 ? (
								availableRoles.map((role) => (
									<option key={role.value} value={role.value}>
										{role.label}
									</option>
								))
							) : (
								<option value={editRole}>{ROLE_LABELS[editRole] ?? editRole}</option>
							)}
						</select>
					</label>

					<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
						Gunakan “Hapus Akses” jika user tidak lagi boleh mengakses organisasi internal. Akun user tetap tersimpan di sistem.
					</div>

					<div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
						<button
							type="button"
							onClick={() => setRemoveAccessConfirmOpen(true)}
							className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
							disabled={savingEdit || removingAccess || !memberToEdit}
						>
							Hapus Akses
						</button>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setEditModalOpen(false);
									setMemberToEdit(null);
									setEditError("");
								}}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
								disabled={savingEdit || removingAccess}
							>
								Batal
							</button>
							<button
								type="button"
								onClick={handleSaveMemberAccess}
								className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
								disabled={savingEdit || removingAccess || !memberToEdit}
							>
								{savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
							</button>
						</div>
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={removeAccessConfirmOpen}
				onClose={() => {
					if (removingAccess) return;
					setRemoveAccessConfirmOpen(false);
				}}
				title="Hapus Akses Anggota"
			>
				<div className="space-y-4">
					<p className="text-sm text-slate-700">
						Hapus akses organisasi internal untuk <strong>{memberToEdit?.name}</strong>?
						Akun login tidak dihapus, tetapi user tidak lagi memiliki role internal.
					</p>

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setRemoveAccessConfirmOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={removingAccess}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleRemoveMemberAccess}
							className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
							disabled={removingAccess}
						>
							{removingAccess ? "Menghapus..." : "Hapus Akses"}
						</button>
					</div>
				</div>
			</Modal>
		</FeaturePage>
	);
}
