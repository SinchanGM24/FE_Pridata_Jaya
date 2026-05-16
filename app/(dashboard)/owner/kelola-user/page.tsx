"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import type { User, UserRole } from "@/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/constants";
import { useAuth } from "@/hooks/useAuth";
import { resolveDashboardRole } from "@/lib/auth";
import { usersService, type AdminUpdateUserPayload } from "@/services/users";
import { ownerService, type OwnerSalesDirectoryItem } from "@/services/owner";
import OwnerUserFormModal, {
	type OwnerUserFormState,
} from "@/components/owner/OwnerUserFormModal";

type UserFormRole = "owner" | "invoicist" | "warehouse_staff" | "accountant" | "sales" | "store_customer";

type AccountStatus = "Aktif" | "Nonaktif";

const resolveDisplayRole = (user: User): UserRole =>
	(user.organizationRole as UserRole | null) ?? user.role;

const resolveAccountStatus = (user: User): AccountStatus =>
	user.banned ? "Nonaktif" : "Aktif";

const toCreateRolePayload = (role: UserFormRole): {
	systemRole: UserRole;
	organizationRole?: string;
} => {
	if (role === "owner") {
		return {
			systemRole: "owner",
			organizationRole: "owner",
		};
	}

	return {
		systemRole: "user",
		organizationRole: role,
	};
};

const emptyUserForm = (): OwnerUserFormState => ({
	email: "",
	name: "",
	password: "",
	role: "owner",
});

const getErrorMessage = (error: unknown, fallback: string) => {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
		? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
		: fallback;
};

export default function KelolaUserPage() {
	const { user } = useAuth();
	const dashboardRole = resolveDashboardRole(user);
	const isAdminOperator = dashboardRole === "admin";
	const [users, setUsers] = useState<User[]>([]);
	const [salesDirectory, setSalesDirectory] = useState<OwnerSalesDirectoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [modalError, setModalError] = useState("");
	const [createFormOpen, setCreateFormOpen] = useState(false);
	const [createForm, setCreateForm] = useState<OwnerUserFormState>(emptyUserForm);
	const [creating, setCreating] = useState(false);
	const [editFormOpen, setEditFormOpen] = useState(false);
	const [editForm, setEditForm] = useState<OwnerUserFormState>(emptyUserForm);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [editing, setEditing] = useState(false);
	const [deleteFormOpen, setDeleteFormOpen] = useState(false);
	const [deletingUser, setDeletingUser] = useState<User | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [detailFormOpen, setDetailFormOpen] = useState(false);
	const [detailUser, setDetailUser] = useState<User | null>(null);
	const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
	const [statusFilter, setStatusFilter] = useState<"ALL" | AccountStatus>("ALL");
	const [page, setPage] = useState(1);
	const [feedback, setFeedback] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [userResult, salesResult] = await Promise.all([
				usersService.listAll(),
				ownerService.getSalesDirectory(),
			]);
			setUsers(
				userResult.filter(
					(user) =>
						(user.organizationRole || user.role === "owner" || user.role === "admin") &&
						(!isAdminOperator ||
							(user.role !== "owner" &&
								user.role !== "admin" &&
								user.role !== "superowner" &&
								user.organizationRole !== "owner" &&
								user.organizationRole !== "admin")),
				),
			);
			setSalesDirectory(salesResult);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat data user."));
		} finally {
			setLoading(false);
		}
	}, [isAdminOperator]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const filteredUsers = useMemo(() => {
		return users.filter((item) => {
			const query = search.trim().toLowerCase();
			const matchSearch =
				!query ||
				item.name.toLowerCase().includes(query) ||
				item.email.toLowerCase().includes(query);
			const displayRole = resolveDisplayRole(item);
			const matchRole = roleFilter === "ALL" || displayRole === roleFilter;
			const status = resolveAccountStatus(item);
			const matchStatus = statusFilter === "ALL" || status === statusFilter;
			return matchSearch && matchRole && matchStatus;
		});
	}, [users, search, roleFilter, statusFilter]);

	const pageSize = 10;
	const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
	const currentPage = Math.min(page, totalPages);
	const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

	const summary = useMemo(() => {
		const byRole: Record<string, number> = {};
		for (const u of users) {
			const effectiveRole = resolveDisplayRole(u);
			byRole[effectiveRole] = (byRole[effectiveRole] ?? 0) + 1;
		}
		return { total: users.length, byRole };
	}, [users]);

	const handleCreate = async () => {
		setModalError("");
		setCreating(true);
		try {
			if (
				!createForm.name.trim() ||
				!createForm.email.trim() ||
				!createForm.password.trim()
			) {
				throw new Error("Nama, email, dan password wajib diisi.");
			}
			if (isAdminOperator && createForm.role === "owner") {
				throw new Error("Admin tidak dapat membuat akun owner atau admin.");
			}

			const payload = toCreateRolePayload(createForm.role);
			await usersService.create({
				email: createForm.email.trim(),
				name: createForm.name.trim(),
				password: createForm.password.trim(),
				systemRole: payload.systemRole,
				organizationRole: payload.organizationRole,
			});
			setCreateForm(emptyUserForm);
			setCreateFormOpen(false);
			await load();
			setFeedback({
				type: "success",
				message: "User berhasil ditambahkan.",
			});
		} catch (error: unknown) {
			setModalError(getErrorMessage(error, "Gagal membuat user."));
		} finally {
			setCreating(false);
		}
	};

	const openEditForm = (user: User) => {
		setEditingUser(user);
		setEditForm({
			email: user.email,
			name: user.name,
			password: "",
			role: (user.organizationRole as UserFormRole) || "owner",
		});
		setEditFormOpen(true);
	};

	const handleUpdate = async () => {
		setModalError("");
		setEditing(true);
		try {
			if (!editingUser) return;

			if (!editForm.name.trim() || !editForm.email.trim()) {
				throw new Error("Nama dan email wajib diisi.");
			}
			if (isAdminOperator && editForm.role === "owner") {
				throw new Error("Admin tidak dapat mengubah akun menjadi owner atau admin.");
			}

			const payload = toCreateRolePayload(editForm.role);
			const updatePayload: AdminUpdateUserPayload = {
				email: editForm.email.trim(),
				name: editForm.name.trim(),
				systemRole: payload.systemRole,
				organizationRole: payload.organizationRole,
			};

			if (editForm.password.trim()) {
				updatePayload.password = editForm.password.trim();
			}

			await usersService.update(editingUser.id, updatePayload);
			setEditForm(emptyUserForm);
			setEditFormOpen(false);
			setEditingUser(null);
			await load();
			setFeedback({
				type: "success",
				message: "User berhasil diperbarui.",
			});
		} catch (error: unknown) {
			setModalError(getErrorMessage(error, "Gagal memperbarui user."));
		} finally {
			setEditing(false);
		}
	};

	const openDeleteForm = (user: User) => {
		if (
			isAdminOperator &&
			(user.role === "owner" ||
				user.role === "admin" ||
				user.role === "superowner" ||
				user.organizationRole === "owner" ||
				user.organizationRole === "admin")
		) {
			setFeedback({
				type: "error",
				message: "Admin tidak dapat menghapus akun owner atau admin.",
			});
			return;
		}
		setDeletingUser(user);
		setDeleteFormOpen(true);
	};

	const handleDelete = async () => {
		setDeleting(true);
		try {
			if (!deletingUser) return;

			if (deletingUser.banned) {
				await usersService.delete(deletingUser.id);
				setUsers((prev) => prev.filter((item) => item.id !== deletingUser.id));
				setFeedback({
					type: "success",
					message: "User berhasil dihapus permanen.",
				});
			} else {
				await usersService.banUser(deletingUser.id, true, "Dinonaktifkan oleh owner");
				setUsers((prev) =>
					prev.map((item) =>
						item.id === deletingUser.id ? { ...item, banned: true } : item,
					),
				);
				setFeedback({
					type: "success",
					message: "User berhasil dinonaktifkan. Tekan hapus lagi untuk menghapus permanen.",
				});
			}
			setDeleteFormOpen(false);
			setDeletingUser(null);
		} catch (error: unknown) {
			setFeedback({
				type: "error",
				message: getErrorMessage(error, "Gagal memproses aksi user."),
			});
		} finally {
			setDeleting(false);
		}
	};

	const openDetailForm = (user: User) => {
		setDetailUser(user);
		setDetailFormOpen(true);
	};

	return (
		<FeaturePage
			title="Kelola User"
			description="Manajemen akun user organisasi. Buat user baru, lihat seluruh daftar user, dan pantau directory sales aktif."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Total User", value: summary.total },
					{ label: "Sales", value: summary.byRole["sales"] ?? 0 },
					{ label: "Gudang", value: summary.byRole["warehouse_staff"] ?? 0 },
					{ label: "Toko", value: summary.byRole["store_customer"] ?? 0 },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
					<h2 className="font-semibold text-slate-900">Daftar User ({users.length})</h2>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => {
								setModalError("");
								setCreateForm(emptyUserForm);
								setCreateFormOpen(true);
							}}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
						>
							Tambah User
						</button>
						<input
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm w-56"
							placeholder="Cari nama / email..."
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(1);
							}}
						/>
						<select
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={roleFilter}
							onChange={(e) => {
								setRoleFilter(e.target.value as "ALL" | UserRole);
								setPage(1);
							}}
						>
							<option value="ALL">Semua Role</option>
							{Object.keys(ROLE_LABELS).map((role) => (
								<option key={role} value={role}>{ROLE_LABELS[role as UserRole]}</option>
							))}
						</select>
						<select
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={statusFilter}
							onChange={(e) => {
								setStatusFilter(e.target.value as "ALL" | AccountStatus);
								setPage(1);
							}}
						>
							<option value="ALL">Semua Status</option>
							<option value="Aktif">Aktif</option>
							<option value="Nonaktif">Nonaktif</option>
						</select>
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
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Nama</th>
							<th className="px-4 py-3">Email</th>
							<th className="px-4 py-3">Role</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Verified</th>
							<th className="px-4 py-3">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
						) : filteredUsers.length === 0 ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Tidak ada user.</td></tr>
						) : (
							pagedUsers.map((u) => {
								const displayRole = resolveDisplayRole(u);
								const status = resolveAccountStatus(u);

								return (
									<tr key={u.id}>
										<td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
										<td className="px-4 py-3 text-slate-700">{u.email}</td>
										<td className="px-4 py-3">
											<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[displayRole] ?? "bg-slate-100 text-slate-700"}`}>
												{ROLE_LABELS[displayRole] ?? displayRole}
											</span>
										</td>
										<td className="px-4 py-3">
											<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${status === "Aktif" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
												{status}
											</span>
										</td>
										<td className="px-4 py-3 text-slate-700">{u.emailVerified ? "Ya" : "Tidak"}</td>
										<td className="px-4 py-3">
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => openDetailForm(u)}
													className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
												>
													Detail
												</button>
												<button
													type="button"
													onClick={() => openEditForm(u)}
													className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
												>
													Edit
												</button>
												<button
													type="button"
													onClick={() => openDeleteForm(u)}
													className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
												>
													{u.banned ? "Hapus" : "Nonaktif"}
												</button>
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
				<div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
					<p className="text-sm text-slate-600">
						Halaman {currentPage} dari {totalPages} ({filteredUsers.length} user)
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
							disabled={currentPage === 1}
							className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Sebelumnya
						</button>
						<button
							type="button"
							onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
							disabled={currentPage === totalPages}
							className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Selanjutnya
						</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="font-semibold text-slate-900">Directory Sales ({salesDirectory.length})</h2>
					<p className="mt-1 text-sm text-slate-600">
						Sales aktif beserta jumlah toko kelolaan. Untuk assignment toko, gunakan halaman Kelola Toko.
					</p>
				</div>
				<div className="divide-y divide-slate-100">
					{loading ? (
						<div className="px-4 py-4 text-sm text-slate-600">Memuat sales...</div>
					) : salesDirectory.length === 0 ? (
						<div className="px-4 py-4 text-sm text-slate-600">Belum ada user dengan role sales.</div>
					) : (
						salesDirectory.map((sales) => (
							<div key={sales.userId} className="flex items-center justify-between gap-4 px-4 py-4">
								<div>
									<div className="font-medium text-slate-900">{sales.name}</div>
									<div className="text-sm text-slate-600">{sales.email}</div>
								</div>
								<div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
									{sales.managedStoreCount} toko
								</div>
							</div>
						))
					)}
				</div>
			</section>

			<OwnerUserFormModal
				open={createFormOpen}
				form={createForm}
				saving={creating}
				error={modalError}
				onClose={() => setCreateFormOpen(false)}
				onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
				onSubmit={() => {
					void handleCreate();
				}}
			/>

			<OwnerUserFormModal
				open={editFormOpen}
				form={editForm}
				saving={editing}
				error={modalError}
				onClose={() => {
					setEditFormOpen(false);
					setEditingUser(null);
					setEditForm(emptyUserForm);
				}}
				onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
				onSubmit={() => {
					void handleUpdate();
				}}
			/>

			{deleteFormOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div className="rounded-2xl bg-white p-6 shadow-lg max-w-md w-full">
						<h3 className="text-lg font-semibold text-slate-900 mb-4">
							{deletingUser?.banned ? "Hapus User Permanen" : "Nonaktifkan User"}
						</h3>
						<p className="text-sm text-slate-600 mb-6">
							{deletingUser?.banned
								? `Apakah Anda yakin ingin menghapus user ${deletingUser?.name} secara permanen? Tindakan ini tidak dapat dibatalkan.`
								: `Apakah Anda yakin ingin menonaktifkan user ${deletingUser?.name}? User dapat dihapus permanen setelah dinonaktifkan.`}
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setDeleteFormOpen(false);
									setDeletingUser(null);
								}}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => {
									void handleDelete();
								}}
								disabled={deleting}
								className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
							>
								{deleting ? "Memproses..." : deletingUser?.banned ? "Hapus Permanen" : "Nonaktifkan"}
							</button>
						</div>
					</div>
				</div>
			)}

			{detailFormOpen && detailUser && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div className="rounded-2xl bg-white p-6 shadow-lg max-w-md w-full">
						<h3 className="text-lg font-semibold text-slate-900 mb-4">Detail User</h3>
						<div className="space-y-3 text-sm">
							<div>
								<p className="text-slate-500">Nama</p>
								<p className="font-medium text-slate-900">{detailUser.name}</p>
							</div>
							<div>
								<p className="text-slate-500">Email</p>
								<p className="font-medium text-slate-900">{detailUser.email}</p>
							</div>
							<div>
								<p className="text-slate-500">Role</p>
								<p className="font-medium text-slate-900">{ROLE_LABELS[resolveDisplayRole(detailUser)] ?? resolveDisplayRole(detailUser)}</p>
							</div>
							<div>
								<p className="text-slate-500">Status</p>
								<p className={`font-medium ${detailUser.banned ? "text-red-700" : "text-green-700"}`}>
									{detailUser.banned ? "Nonaktif" : "Aktif"}
								</p>
							</div>
							<div>
								<p className="text-slate-500">Email Verified</p>
								<p className="font-medium text-slate-900">{detailUser.emailVerified ? "Ya" : "Tidak"}</p>
							</div>
						</div>
						<div className="flex justify-end mt-6">
							<button
								type="button"
								onClick={() => {
									setDetailFormOpen(false);
									setDetailUser(null);
								}}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</FeaturePage>
	);
}
