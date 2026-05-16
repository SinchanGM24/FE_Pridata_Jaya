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
	type OrganizationInvitation,
} from "@/services/members";
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

interface InviteFormState {
	email: string;
	role: UserRole;
}

const emptyInviteForm = (): InviteFormState => ({
	email: "",
	role: "user",
});

export default function MembersPage() {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const canManage =
		dashboardRole === "owner" ||
		dashboardRole === "admin" ||
		dashboardRole === "superowner";

	const [members, setMembers] = useState<OrganizationMember[]>([]);
	const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
	const [roles, setRoles] = useState<RoleSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [feedback, setFeedback] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const [inviteModalOpen, setInviteModalOpen] = useState(false);
	const [inviteForm, setInviteForm] = useState<InviteFormState>(emptyInviteForm);
	const [inviteError, setInviteError] = useState("");
	const [inviting, setInviting] = useState(false);

	const [removeModalOpen, setRemoveModalOpen] = useState(false);
	const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(
		null,
	);
	const [removing, setRemoving] = useState(false);

	const [cancelModalOpen, setCancelModalOpen] = useState(false);
	const [invitationToCancel, setInvitationToCancel] =
		useState<OrganizationInvitation | null>(null);
	const [canceling, setCanceling] = useState(false);

	const [roleUpdateMember, setRoleUpdateMember] =
		useState<OrganizationMember | null>(null);
	const [updatingRole, setUpdatingRole] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [membersResult, invitationsResult, rolesResult] = await Promise.all(
				[
					membersService.list(),
					membersService.listInvitations(),
					rolesService.list(),
				],
			);
			setMembers(membersResult.items);
			setInvitations(invitationsResult.items);
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

	const handleInvite = async () => {
		setInviteError("");
		setInviting(true);
		try {
			if (!inviteForm.email.trim()) {
				throw new Error("Email wajib diisi.");
			}

			await membersService.invite({
				email: inviteForm.email.trim(),
				role: inviteForm.role,
			});
			setInviteForm(emptyInviteForm);
			setInviteModalOpen(false);
			await load();
			setFeedback({ type: "success", message: "Undangan berhasil dikirim." });
		} catch (err: unknown) {
			setInviteError(getErrorMessage(err, "Gagal mengirim undangan."));
		} finally {
			setInviting(false);
		}
	};

	const handleCancelInvitation = async () => {
		if (!invitationToCancel) return;
		setCanceling(true);
		try {
			await membersService.cancelInvitation(invitationToCancel.id);
			setCancelModalOpen(false);
			setInvitationToCancel(null);
			await load();
			setFeedback({ type: "success", message: "Undangan berhasil dibatalkan." });
		} catch (err: unknown) {
			setFeedback({
				type: "error",
				message: getErrorMessage(err, "Gagal membatalkan undangan."),
			});
		} finally {
			setCanceling(false);
		}
	};

	const handleUpdateRole = async (memberId: string, newRole: UserRole) => {
		const member = members.find((m) => m.id === memberId);
		if (!member) return;

		setRoleUpdateMember(member);
		setUpdatingRole(true);
		try {
			await membersService.updateRole(memberId, newRole);
			setMembers((prev) =>
				prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
			);
			setFeedback({ type: "success", message: "Role berhasil diperbarui." });
		} catch (err: unknown) {
			setFeedback({
				type: "error",
				message: getErrorMessage(err, "Gagal memperbarui role."),
			});
		} finally {
			setUpdatingRole(false);
			setRoleUpdateMember(null);
		}
	};

	const handleRemoveMember = async () => {
		if (!memberToRemove) return;
		setRemoving(true);
		try {
			await membersService.remove(memberToRemove.id);
			setRemoveModalOpen(false);
			setMemberToRemove(null);
			await load();
			setFeedback({ type: "success", message: "Anggota berhasil dihapus." });
		} catch (err: unknown) {
			setFeedback({
				type: "error",
				message: getErrorMessage(err, "Gagal menghapus anggota."),
			});
		} finally {
			setRemoving(false);
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
		return roles.map((r) => ({
			value: r.name as UserRole,
			label: r.description || r.name,
		}));
	}, [roles]);

	if (!canManage) {
		return (
			<FeaturePage
				title="Anggota Organisasi"
				description="Manajemen anggota dan undangan."
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
			description="Kelola anggota aktif dan undangan tertunda. Undang anggota baru, ubah role, atau hapus anggota dari organisasi."
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
								setInviteError("");
								setInviteForm(emptyInviteForm);
								setInviteModalOpen(true);
							}}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
						>
							Undang Anggota
						</button>
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Refresh
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
										<select
											className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
											value={member.role}
											onChange={(e) =>
												handleUpdateRole(member.id, e.target.value as UserRole)
											}
											disabled={
												updatingRole && roleUpdateMember?.id === member.id
											}
										>
											{availableRoles.length > 0 ? (
												availableRoles.map((r) => (
													<option key={r.value} value={r.value}>
														{r.label}
													</option>
												))
											) : (
												<option value={member.role}>
													{ROLE_LABELS[member.role] ?? member.role}
												</option>
											)}
										</select>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{formatDate(member.createdAt)}
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => {
												setMemberToRemove(member);
												setRemoveModalOpen(true);
											}}
											className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
										>
											Hapus
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="font-semibold text-slate-900">
						Undangan Tertunda ({invitations.length})
					</h2>
					<p className="mt-1 text-sm text-slate-600">
						Daftar undangan yang belum dikonfirmasi oleh penerima.
					</p>
				</div>

				{loading ? (
					<div className="px-4 py-8 text-sm text-slate-600">Memuat...</div>
				) : invitations.length === 0 ? (
					<div className="px-4 py-8 text-sm text-slate-600">
						Tidak ada undangan tertunda.
					</div>
				) : (
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Email</th>
								<th className="px-4 py-3">Role</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">Dikirim</th>
								<th className="px-4 py-3">Kedaluwarsa</th>
								<th className="px-4 py-3">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{invitations.map((invitation) => (
								<tr key={invitation.id}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{invitation.email}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
												ROLE_COLORS[invitation.role] ??
												"bg-slate-100 text-slate-700"
											}`}
										>
											{ROLE_LABELS[invitation.role] ?? invitation.role}
										</span>
									</td>
									<td className="px-4 py-3">
										<span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
											{invitation.status}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{formatDate(invitation.createdAt)}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{formatDate(invitation.expiresAt)}
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => {
												setInvitationToCancel(invitation);
												setCancelModalOpen(true);
											}}
											className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
										>
											Batalkan
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>

			<Modal
				isOpen={inviteModalOpen}
				onClose={() => setInviteModalOpen(false)}
				title="Undang Anggota Baru"
			>
				<div className="space-y-4">
					{inviteError ? (
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{inviteError}
						</div>
					) : null}

					<label className="space-y-2 text-sm text-slate-700">
						<span>Email</span>
						<input
							type="email"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={inviteForm.email}
							onChange={(e) =>
								setInviteForm((prev) => ({ ...prev, email: e.target.value }))
							}
							disabled={inviting}
							placeholder="email@contoh.com"
						/>
					</label>

					<label className="space-y-2 text-sm text-slate-700">
						<span>Role</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={inviteForm.role}
							onChange={(e) =>
								setInviteForm((prev) => ({
									...prev,
									role: e.target.value as UserRole,
								}))
							}
							disabled={inviting}
						>
							{availableRoles.length > 0 ? (
								availableRoles.map((r) => (
									<option key={r.value} value={r.value}>
										{r.label}
									</option>
								))
							) : (
								<option value="user">Internal</option>
							)}
						</select>
					</label>

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setInviteModalOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={inviting}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleInvite}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
							disabled={inviting}
						>
							{inviting ? "Mengirim..." : "Kirim Undangan"}
						</button>
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={removeModalOpen}
				onClose={() => setRemoveModalOpen(false)}
				title="Hapus Anggota"
			>
				<div className="space-y-4">
					<p className="text-sm text-slate-700">
						Apakah Anda yakin ingin menghapus{" "}
						<strong>{memberToRemove?.name}</strong> dari organisasi? Anggota
						yang dihapus tidak dapat mengakses sistem.
					</p>

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setRemoveModalOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={removing}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleRemoveMember}
							className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
							disabled={removing}
						>
							{removing ? "Menghapus..." : "Hapus Anggota"}
						</button>
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={cancelModalOpen}
				onClose={() => setCancelModalOpen(false)}
				title="Batalkan Undangan"
			>
				<div className="space-y-4">
					<p className="text-sm text-slate-700">
						Apakah Anda yakin ingin membatalkan undangan untuk{" "}
						<strong>{invitationToCancel?.email}</strong>?
					</p>

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setCancelModalOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={canceling}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleCancelInvitation}
							className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
							disabled={canceling}
						>
							{canceling ? "Membatalkan..." : "Batalkan Undangan"}
						</button>
					</div>
				</div>
			</Modal>
		</FeaturePage>
	);
}
