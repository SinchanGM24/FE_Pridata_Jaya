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
import OwnerUserDetailModal from "@/components/owner/OwnerUserDetailModal";

type UserFormRole = "owner" | "invoicist" | "warehouse_staff" | "accountant" | "sales" | "store_customer";

type AccountStatus = "Aktif" | "Nonaktif";

const MONTH_OPTIONS = [
	{ value: 1, label: "Januari" },
	{ value: 2, label: "Februari" },
	{ value: 3, label: "Maret" },
	{ value: 4, label: "April" },
	{ value: 5, label: "Mei" },
	{ value: 6, label: "Juni" },
	{ value: 7, label: "Juli" },
	{ value: 8, label: "Agustus" },
	{ value: 9, label: "September" },
	{ value: 10, label: "Oktober" },
	{ value: 11, label: "November" },
	{ value: 12, label: "Desember" },
];

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

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
	identityNumber: "",
	birthDate: "",
	gender: "",
	phoneNumber: "",
	address: "",
	city: "",
	province: "",
	postalCode: "",
	joinDate: "",
});

const toDateInputValue = (value?: string | null) => {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return date.toISOString().slice(0, 10);
};

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
	const [salesSearch, setSalesSearch] = useState("");
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
	const [salesTargetYear, setSalesTargetYear] = useState(new Date().getFullYear());
	const [salesTargetMonth, setSalesTargetMonth] = useState(new Date().getMonth() + 1);
	const [salesTargetModalOpen, setSalesTargetModalOpen] = useState(false);
	const [activeSalesTarget, setActiveSalesTarget] = useState<OwnerSalesDirectoryItem | null>(null);
	const [salesTargetAmountInput, setSalesTargetAmountInput] = useState("");
	const [salesTargetSaving, setSalesTargetSaving] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [userResult, salesResult] = await Promise.all([
				usersService.listAll(),
				ownerService.getSalesDirectory({
					year: salesTargetYear,
					month: salesTargetMonth,
				}),
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
	}, [isAdminOperator, salesTargetMonth, salesTargetYear]);

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
				item.email.toLowerCase().includes(query) ||
				(item.profile?.identityNumber || "").toLowerCase().includes(query) ||
				(item.profile?.phoneNumber || "").toLowerCase().includes(query);
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

	const filteredSalesDirectory = useMemo(() => {
		const query = salesSearch.trim().toLowerCase();
		if (!query) {
			return salesDirectory;
		}

		return salesDirectory.filter(
			(item) =>
				item.name.toLowerCase().includes(query) ||
				item.email.toLowerCase().includes(query),
		);
	}, [salesDirectory, salesSearch]);

	const salesTargetYears = useMemo(() => {
		const currentYear = new Date().getFullYear();
		return Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);
	}, []);

	const openSalesTargetModal = (sales: OwnerSalesDirectoryItem) => {
		setActiveSalesTarget(sales);
		setSalesTargetAmountInput(String(sales.salesTargetAmount ?? 0));
		setModalError("");
		setSalesTargetModalOpen(true);
	};

	const handleSaveSalesTarget = async () => {
		if (!activeSalesTarget) return;

		setModalError("");
		setSalesTargetSaving(true);
		try {
			const targetAmount = Number(salesTargetAmountInput);
			if (!Number.isFinite(targetAmount) || targetAmount < 0) {
				throw new Error("Target penjualan harus berupa angka 0 atau lebih.");
			}

			const updated = await ownerService.upsertSalesTarget(activeSalesTarget.userId, {
				year: salesTargetYear,
				month: salesTargetMonth,
				targetAmount,
			});

			setSalesDirectory((prev) =>
				prev.map((item) => (item.userId === updated.userId ? updated : item)),
			);
			setSalesTargetModalOpen(false);
			setActiveSalesTarget(null);
			setFeedback({
				type: "success",
				message: `Target sales ${updated.name} untuk ${MONTH_OPTIONS.find((item) => item.value === salesTargetMonth)?.label ?? salesTargetMonth}/${salesTargetYear} berhasil diperbarui.`,
			});
		} catch (error: unknown) {
			setModalError(getErrorMessage(error, "Gagal menyimpan target sales."));
		} finally {
			setSalesTargetSaving(false);
		}
	};

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
				profile: {
					identityNumber: createForm.identityNumber.trim() || null,
					birthDate: createForm.birthDate || null,
					gender: createForm.gender || null,
					phoneNumber: createForm.phoneNumber.trim() || null,
					address: createForm.address.trim() || null,
					city: createForm.city.trim() || null,
					province: createForm.province.trim() || null,
					postalCode: createForm.postalCode.trim() || null,
					joinDate: createForm.joinDate || null,
				},
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
			identityNumber: user.profile?.identityNumber || "",
			birthDate: toDateInputValue(user.profile?.birthDate),
			gender:
				user.profile?.gender === "Laki-laki" || user.profile?.gender === "Perempuan"
					? user.profile.gender
					: "",
			phoneNumber: user.profile?.phoneNumber || "",
			address: user.profile?.address || "",
			city: user.profile?.city || "",
			province: user.profile?.province || "",
			postalCode: user.profile?.postalCode || "",
			joinDate: toDateInputValue(user.profile?.joinDate),
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
			if (editForm.password.trim() && editForm.password.trim().length < 8) {
				throw new Error("Password baru minimal 8 karakter.");
			}
			const nextPassword = editForm.password.trim();

			const payload = toCreateRolePayload(editForm.role);
			const updatePayload: AdminUpdateUserPayload = {
				email: editForm.email.trim(),
				name: editForm.name.trim(),
				systemRole: payload.systemRole,
				organizationRole: payload.organizationRole,
				profile: {
					identityNumber: editForm.identityNumber.trim() || null,
					birthDate: editForm.birthDate || null,
					gender: editForm.gender || null,
					phoneNumber: editForm.phoneNumber.trim() || null,
					address: editForm.address.trim() || null,
					city: editForm.city.trim() || null,
					province: editForm.province.trim() || null,
					postalCode: editForm.postalCode.trim() || null,
					joinDate: editForm.joinDate || null,
				},
			};

			await usersService.update(editingUser.id, updatePayload);
			if (nextPassword) {
				await usersService.setPassword(editingUser.id, nextPassword);
			}
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
							placeholder="Cari NIK, nama, email, telepon..."
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
							<th className="px-4 py-3">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
						) : filteredUsers.length === 0 ? (
							<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Tidak ada user.</td></tr>
						) : (
							pagedUsers.map((u) => {
								const displayRole = resolveDisplayRole(u);
								const status = resolveAccountStatus(u);

								return (
									<tr key={u.id}>
										<td className="px-4 py-3">
											<div className="font-medium text-slate-900">{u.name}</div>
											<div className="text-xs text-slate-500">{u.profile?.identityNumber || "-"}</div>
										</td>
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
					<div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
						<div>
							<h2 className="font-semibold text-slate-900">Directory Sales ({filteredSalesDirectory.length})</h2>
							<p className="mt-1 text-sm text-slate-600">
								Sales aktif beserta jumlah toko kelolaan dan target penjualan per periode. Untuk assignment toko, gunakan halaman Kelola Toko.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<input
								className="w-56 rounded-xl border border-slate-300 px-3 py-2 text-sm"
								placeholder="Cari nama atau email sales..."
								value={salesSearch}
								onChange={(event) => setSalesSearch(event.target.value)}
							/>
							<select
								className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
								value={salesTargetMonth}
								onChange={(event) => setSalesTargetMonth(Number(event.target.value))}
							>
								{MONTH_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
							<select
								className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
								value={salesTargetYear}
								onChange={(event) => setSalesTargetYear(Number(event.target.value))}
							>
								{salesTargetYears.map((year) => (
									<option key={year} value={year}>
										{year}
									</option>
								))}
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
				</div>
				<div className="divide-y divide-slate-100">
					{loading ? (
						<div className="px-4 py-4 text-sm text-slate-600">Memuat sales...</div>
					) : filteredSalesDirectory.length === 0 ? (
						<div className="px-4 py-4 text-sm text-slate-600">Tidak ada sales yang cocok dengan pencarian/periode aktif.</div>
					) : (
						filteredSalesDirectory.map((sales) => (
							<div key={sales.userId} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
								<div className="min-w-0">
									<div className="font-medium text-slate-900">{sales.name}</div>
									<div className="text-sm text-slate-600">{sales.email}</div>
								</div>
								<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
									<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
										<div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Toko Kelolaan</div>
										<div className="mt-1 font-semibold">{sales.managedStoreCount} toko</div>
									</div>
									<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
										<div className="text-[11px] uppercase tracking-[0.18em] text-emerald-600">Target {MONTH_OPTIONS.find((item) => item.value === salesTargetMonth)?.label}</div>
										<div className="mt-1 font-semibold">{formatRupiah(sales.salesTargetAmount ?? 0)}</div>
									</div>
									<button
										type="button"
										onClick={() => openSalesTargetModal(sales)}
										className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
									>
										Atur Target
									</button>
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

			<OwnerUserDetailModal
				open={detailFormOpen}
				user={detailUser}
				onClose={() => {
					setDetailFormOpen(false);
					setDetailUser(null);
				}}
			/>

			{salesTargetModalOpen && activeSalesTarget ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
						<h3 className="text-lg font-semibold text-slate-900">Atur Target Sales</h3>
						<p className="mt-1 text-sm text-slate-600">
							Tetapkan target penjualan untuk <span className="font-medium text-slate-900">{activeSalesTarget.name}</span> pada periode{" "}
							<span className="font-medium text-slate-900">
								{MONTH_OPTIONS.find((item) => item.value === salesTargetMonth)?.label} {salesTargetYear}
							</span>.
						</p>
						<div className="mt-5 space-y-4">
							<div>
								<label className="mb-2 block text-sm font-medium text-slate-700">Target Penjualan</label>
								<input
									type="number"
									min={0}
									step={1000}
									value={salesTargetAmountInput}
									onChange={(event) => setSalesTargetAmountInput(event.target.value)}
									className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
									placeholder="Masukkan nominal target"
								/>
								<p className="mt-2 text-xs text-slate-500">
									Nilai saat ini: {formatRupiah(Number(salesTargetAmountInput || 0))}
								</p>
							</div>
							{modalError ? (
								<div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
									{modalError}
								</div>
							) : null}
						</div>
						<div className="mt-6 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setSalesTargetModalOpen(false);
									setActiveSalesTarget(null);
									setSalesTargetAmountInput("");
									setModalError("");
								}}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => {
									void handleSaveSalesTarget();
								}}
								disabled={salesTargetSaving}
								className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
							>
								{salesTargetSaving ? "Menyimpan..." : "Simpan Target"}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</FeaturePage>
	);
}
