"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import OwnerStoreFormModal, {
	type OwnerStoreFormState,
} from "@/components/owner/OwnerStoreFormModal";
import { citiesService, type City } from "@/services/cities";
import {
	ownerService,
	type OwnerSalesDirectoryItem,
	type OwnerStoreAssignmentItem,
} from "@/services/owner";
import { storesService, type VerificationStatus } from "@/services/stores";
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

	return (
		<FeaturePage
			title="Kelola Toko"
			description="Workspace owner untuk menyatukan verifikasi pelanggan toko dan penugasan sales. Halaman ini menjadi simpul operasional antara onboarding toko, assignment sales, dan dashboard scoped milik sales."
		>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				{[
					{ label: "Total Toko", value: summary.total },
					{ label: "Pending", value: summary.pending },
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
											<button
												type="button"
												onClick={() => handleSave(store)}
												disabled={savingStoreId === store.storeId}
												className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
											>
												{savingStoreId === store.storeId ? "Menyimpan..." : "Simpan"}
											</button>
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
				onClose={() => setCreateModalOpen(false)}
				onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
				onSubmit={() => {
					void handleCreateStore();
				}}
			/>
		</FeaturePage>
	);
}
