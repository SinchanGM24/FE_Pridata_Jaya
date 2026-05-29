"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import OwnerStoreFormModal, {
	type OwnerStoreFormState,
} from "@/components/owner/OwnerStoreFormModal";
import OwnerStoreDetailModal from "@/components/owner/OwnerStoreDetailModal";
import { citiesService, type City } from "@/services/cities";
import {
	ownerService,
	type OwnerSalesDirectoryItem,
	type OwnerStoreAssignmentItem,
} from "@/services/owner";
import { storesService, type Store, type VerificationStatus } from "@/services/stores";
import { usersService } from "@/services/users";

type StatusFilter = "ALL" | VerificationStatus;

const verificationOptions: VerificationStatus[] = ["PENDING", "VERIFIED", "REJECTED"];

const emptyStoreForm = (): OwnerStoreFormState => ({
	ownerName: "",
	ownerEmail: "",
	ownerPassword: "",
	storeName: "",
	phone: "",
	address: "",
	cityId: "",
	cityName: "",
	province: "",
	storeType: "RETAILER",
	creditLimit: "0",
	assignedSalesUserId: "",
});

export default function KelolaTokoPage() {
	const [salesDirectory, setSalesDirectory] = useState<OwnerSalesDirectoryItem[]>([]);
	const [stores, setStores] = useState<OwnerStoreAssignmentItem[]>([]);
	const [cities, setCities] = useState<City[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [modalError, setModalError] = useState("");
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [createForm, setCreateForm] = useState<OwnerStoreFormState>(emptyStoreForm);
	const [creatingStore, setCreatingStore] = useState(false);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editForm, setEditForm] = useState<OwnerStoreFormState>(emptyStoreForm);
	const [editingStore, setEditingStore] = useState<Store | null>(null);
	const [editingStoreSaving, setEditingStoreSaving] = useState(false);
	const [detailModalOpen, setDetailModalOpen] = useState(false);
	const [detailStore, setDetailStore] = useState<Store | null>(null);
	const [toggleTarget, setToggleTarget] = useState<Store | null>(null);
	const [togglingStore, setTogglingStore] = useState(false);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
	const [assignmentSelection, setAssignmentSelection] = useState<Record<string, string>>({});
	const [verificationSelection, setVerificationSelection] = useState<
		Record<string, VerificationStatus>
	>({});
	const [savingStoreId, setSavingStoreId] = useState<string | null>(null);

	const loadData = async () => {
		setLoading(true);
		setError("");
		try {
			const [sales, assignments, cityRows] = await Promise.all([
				ownerService.getSalesDirectory(),
				ownerService.getStoreAssignments(),
				citiesService.listAll({ sortBy: "name", sortOrder: "asc" }),
			]);

			setSalesDirectory(sales);
			setStores(assignments);
			setCities(cityRows);
			setAssignmentSelection(
				Object.fromEntries(
					assignments.map((store) => [store.storeId, store.assignedSales?.id ?? ""]),
				),
			);
			setVerificationSelection(
				Object.fromEntries(
					assignments.map((store) => [
						store.storeId,
						store.verificationStatus as VerificationStatus,
					]),
				),
			);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat data toko owner."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadData();
		}, 0);

		return () => window.clearTimeout(timer);
	}, []);

	const visibleStores = useMemo(() => {
		if (statusFilter === "ALL") return stores;
		return stores.filter((store) => store.verificationStatus === statusFilter);
	}, [stores, statusFilter]);

	const summary = useMemo(
		() => ({
			total: stores.length,
			pending: stores.filter((store) => store.verificationStatus === "PENDING").length,
			verified: stores.filter((store) => store.verificationStatus === "VERIFIED").length,
			rejected: stores.filter((store) => store.verificationStatus === "REJECTED").length,
			assigned: stores.filter((store) => store.assignedSales).length,
		}),
		[stores],
	);

	const handleSave = async (store: OwnerStoreAssignmentItem) => {
		setSavingStoreId(store.storeId);
		setError("");
		try {
			await Promise.all([
				ownerService.assignSales(
					store.storeId,
					assignmentSelection[store.storeId] ? assignmentSelection[store.storeId] : null,
				),
				storesService.updateVerificationStatus({
					id: store.storeId,
					verificationStatus:
						verificationSelection[store.storeId] ??
						(store.verificationStatus as VerificationStatus),
				}),
			]);
			await loadData();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menyimpan perubahan toko."));
		} finally {
			setSavingStoreId(null);
		}
	};

	const handleCreateStore = async () => {
		setModalError("");
		setCreatingStore(true);
		try {
			if (
				!createForm.ownerName.trim() ||
				!createForm.ownerEmail.trim() ||
				!createForm.ownerPassword.trim() ||
				!createForm.storeName.trim() ||
				!createForm.phone.trim() ||
				!createForm.address.trim() ||
				(!createForm.cityId && (!createForm.cityName.trim() || !createForm.province.trim()))
			) {
				throw new Error("Lengkapi nama pemilik, email, password, data toko, telepon, alamat, serta kota atau kota baru.");
			}

			const resolvedCityId = createForm.cityId
				? createForm.cityId
				: (
						await citiesService.create({
							name: createForm.cityName.trim(),
							province: createForm.province.trim(),
						})
					).id;

			const ownerUser = await usersService.create({
				email: createForm.ownerEmail.trim(),
				name: createForm.ownerName.trim(),
				password: createForm.ownerPassword.trim(),
				systemRole: "user",
				organizationRole: "store_customer",
			});

			await storesService.create({
				userId: ownerUser.id,
				assignedSalesUserId: createForm.assignedSalesUserId || null,
				name: createForm.storeName.trim(),
				email: createForm.ownerEmail.trim(),
				phone: createForm.phone.trim(),
				address: createForm.address.trim(),
				cityId: resolvedCityId,
				storeType: createForm.storeType,
				creditLimit: Number(createForm.creditLimit || 0),
			});

			setCreateForm(emptyStoreForm());
			setCreateModalOpen(false);
			await loadData();
		} catch (error: unknown) {
			setModalError(getApiErrorMessage(error, "Gagal membuat toko baru."));
		} finally {
			setCreatingStore(false);
		}
	};

	const openDetailModal = async (storeId: string) => {
		setError("");
		try {
			const store = await storesService.getById(storeId);
			setDetailStore(store);
			setDetailModalOpen(true);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat detail toko."));
		}
	};

	const openEditModal = async (storeId: string) => {
		setModalError("");
		try {
			const store = await storesService.getById(storeId);
			setEditingStore(store);
			setEditForm({
				ownerName: store.user?.name ?? "",
				ownerEmail: store.user?.email ?? store.email ?? "",
				ownerPassword: "",
				storeName: store.name ?? "",
				phone: store.phone ?? "",
				address: store.address ?? "",
				cityId: store.cityId ?? "",
				cityName: "",
				province: "",
				storeType:
					store.storeType === "WHOLESALER" || store.storeType === "DISTRIBUTOR"
						? store.storeType
						: "RETAILER",
				creditLimit: String(store.creditLimit ?? 0),
				assignedSalesUserId: store.assignedSalesUserId ?? "",
			});
			setEditModalOpen(true);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat form edit toko."));
		}
	};

	const handleUpdateStore = async () => {
		if (!editingStore) return;

		setModalError("");
		setEditingStoreSaving(true);
		try {
			if (
				!editForm.storeName.trim() ||
				!editForm.phone.trim() ||
				!editForm.address.trim() ||
				!editForm.cityId
			) {
				throw new Error("Nama toko, telepon, alamat, dan kota wajib diisi.");
			}
			if (editForm.ownerPassword.trim() && editForm.ownerPassword.trim().length < 8) {
				throw new Error("Password baru minimal 8 karakter.");
			}
			const nextOwnerPassword = editForm.ownerPassword.trim();

			await storesService.update(editingStore.id, {
				assignedSalesUserId: editForm.assignedSalesUserId || null,
				name: editForm.storeName.trim(),
				phone: editForm.phone.trim(),
				address: editForm.address.trim(),
				cityId: editForm.cityId,
				storeType: editForm.storeType,
				creditLimit: Number(editForm.creditLimit || 0),
			});
			if (nextOwnerPassword) {
				await usersService.setPassword(editingStore.userId, nextOwnerPassword);
			}

			setEditModalOpen(false);
			setEditingStore(null);
			setEditForm(emptyStoreForm());
			await loadData();
		} catch (error: unknown) {
			setModalError(getApiErrorMessage(error, "Gagal memperbarui toko."));
		} finally {
			setEditingStoreSaving(false);
		}
	};

	const handleToggleStoreActive = async () => {
		if (!toggleTarget) return;

		setTogglingStore(true);
		setError("");
		try {
			await storesService.update(toggleTarget.id, {
				isActive: !(toggleTarget.isActive ?? true),
			});
			setToggleTarget(null);
			await loadData();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal mengubah status toko."));
		} finally {
			setTogglingStore(false);
		}
	};

	return (
		<FeaturePage
			title="Kelola Toko"
			description="Workspace owner untuk menyatukan verifikasi pelanggan toko dan penugasan sales. Halaman ini menjadi simpul operasional antara onboarding toko, assignment sales, dan dashboard scoped milik sales."
		>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				{[
					{ label: "Total Toko", value: summary.total },
					{ label: "Menunggu", value: summary.pending },
					{ label: "Verified", value: summary.verified },
					{ label: "Rejected", value: summary.rejected },
					{ label: "Sudah Assigned", value: summary.assigned },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Antrian Toko</h2>
						<p className="mt-1 text-sm text-slate-600">
							Pilih status verifikasi, pasangkan sales, lalu simpan per toko.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => {
								setModalError("");
								setCreateForm(emptyStoreForm());
								setCreateModalOpen(true);
							}}
							className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
						>
							Tambah Toko
						</button>
						{(["ALL", "PENDING", "VERIFIED", "REJECTED"] as const).map((status) => (
							<button
								key={status}
								type="button"
								onClick={() => setStatusFilter(status)}
								className={`rounded-full px-4 py-2 text-sm transition ${
									statusFilter === status
										? "bg-slate-900 text-white"
										: "border border-slate-300 text-slate-700 hover:bg-slate-50"
								}`}
							>
								{status === "ALL" ? "Semua" : status}
							</button>
						))}
						<button
							type="button"
							onClick={loadData}
							disabled={loading}
							className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Refresh
						</button>
					</div>
				</div>

				{error ? (
					<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				) : null}

				<div className="mt-5 overflow-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Owner</th>
								<th className="px-4 py-3">Verifikasi</th>
								<th className="px-4 py-3">Sales</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Memuat toko...
									</td>
								</tr>
							) : visibleStores.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Tidak ada toko pada filter ini.
									</td>
								</tr>
							) : (
								visibleStores.map((store) => (
									<tr key={store.storeId}>
										<td className="px-4 py-3 align-top">
											<div className="font-medium text-slate-900">{store.storeName}</div>
											<div className="text-slate-600">{store.email}</div>
											<div className="mt-1">
												<span
													className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
														store.isActive
															? "bg-green-100 text-green-700"
															: "bg-red-100 text-red-700"
													}`}
												>
													{store.isActive ? "Aktif" : "Nonaktif"}
												</span>
											</div>
											<div className="text-xs text-slate-500">
												{store.city?.name ?? "Tanpa kota"}
												{store.city?.province ? `, ${store.city.province}` : ""}
											</div>
										</td>
										<td className="px-4 py-3 align-top">
											<div className="text-slate-800">{store.ownerUser?.name ?? "-"}</div>
											<div className="text-xs text-slate-500">{store.ownerUser?.email ?? ""}</div>
										</td>
										<td className="px-4 py-3 align-top">
											<select
												className="w-full rounded-xl border border-slate-300 px-3 py-2"
												value={
													verificationSelection[store.storeId] ??
													(store.verificationStatus as VerificationStatus)
												}
												onChange={(e) =>
													setVerificationSelection((prev) => ({
														...prev,
														[store.storeId]: e.target.value as VerificationStatus,
													}))
												}
											>
												{verificationOptions.map((option) => (
													<option key={option} value={option}>
														{option}
													</option>
												))}
											</select>
											<div className="mt-2 text-xs text-slate-500">
												Limit {store.creditLimit.toLocaleString("id-ID")}
											</div>
										</td>
										<td className="px-4 py-3 align-top">
											<select
												className="w-full rounded-xl border border-slate-300 px-3 py-2"
												value={assignmentSelection[store.storeId] ?? ""}
												onChange={(e) =>
													setAssignmentSelection((prev) => ({
														...prev,
														[store.storeId]: e.target.value,
													}))
												}
											>
												<option value="">Belum ditugaskan</option>
												{salesDirectory.map((sales) => (
													<option key={sales.userId} value={sales.userId}>
														{sales.name} ({sales.managedStoreCount})
													</option>
												))}
											</select>
										</td>
										<td className="px-4 py-3 text-right align-top">
											<div className="flex flex-wrap justify-end gap-2">
												<button
													type="button"
													onClick={() => {
														void openDetailModal(store.storeId);
													}}
													className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
												>
													Detail
												</button>
												<button
													type="button"
													onClick={() => {
														void openEditModal(store.storeId);
													}}
													className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
												>
													Edit
												</button>
												<button
													type="button"
													onClick={() => {
														void handleSave(store);
													}}
													disabled={savingStoreId === store.storeId}
													className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
												>
													{savingStoreId === store.storeId ? "Menyimpan..." : "Simpan"}
												</button>
												<button
													type="button"
													onClick={() => {
														void storesService.getById(store.storeId).then(setToggleTarget).catch((error: unknown) => {
															setError(getApiErrorMessage(error, "Gagal memuat status toko."));
														});
													}}
													className={`rounded-lg px-3 py-1 text-xs ${
														store.isActive
															? "border border-red-300 text-red-700 hover:bg-red-50"
															: "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
													}`}
												>
													{store.isActive ? "Nonaktifkan" : "Aktifkan"}
												</button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>

			<OwnerStoreFormModal
				open={createModalOpen}
				form={createForm}
				cities={cities}
				salesDirectory={salesDirectory}
				saving={creatingStore}
				error={modalError}
				mode="create"
				onClose={() => setCreateModalOpen(false)}
				onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
				onSubmit={() => {
					void handleCreateStore();
				}}
			/>

			<OwnerStoreFormModal
				open={editModalOpen}
				form={editForm}
				cities={cities}
				salesDirectory={salesDirectory}
				saving={editingStoreSaving}
				error={modalError}
				mode="edit"
				onClose={() => {
					setEditModalOpen(false);
					setEditingStore(null);
					setEditForm(emptyStoreForm());
				}}
				onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
				onSubmit={() => {
					void handleUpdateStore();
				}}
			/>

			<OwnerStoreDetailModal
				open={detailModalOpen}
				store={detailStore}
				onClose={() => {
					setDetailModalOpen(false);
					setDetailStore(null);
				}}
			/>

			{toggleTarget ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
						<h3 className="mb-4 text-lg font-semibold text-slate-900">
							{toggleTarget.isActive ? "Nonaktifkan Toko" : "Aktifkan Toko"}
						</h3>
						<p className="mb-6 text-sm text-slate-600">
							{toggleTarget.isActive
								? `Apakah Anda yakin ingin menonaktifkan toko ${toggleTarget.name}?`
								: `Apakah Anda yakin ingin mengaktifkan kembali toko ${toggleTarget.name}?`}
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setToggleTarget(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => {
									void handleToggleStoreActive();
								}}
								disabled={togglingStore}
								className={`rounded-xl px-4 py-2 text-sm text-white disabled:opacity-60 ${
									toggleTarget.isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
								}`}
							>
								{togglingStore
									? "Memproses..."
									: toggleTarget.isActive
										? "Nonaktifkan"
										: "Aktifkan"}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</FeaturePage>
	);
}
