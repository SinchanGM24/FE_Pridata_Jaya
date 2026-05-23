"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import { getApiErrorMessage } from "@/lib/api-errors";
import { toUiLabel, transferStatusLabel } from "@/lib/ui-labels";
import {
	type TransferStatus,
	type WarehouseTransferItem,
	warehouseTransfersService,
} from "@/services/warehouse-transfers";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";
import {
	type ProductCondition,
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";
import { citiesService, type City } from "@/services/cities";

const statusOptions: Array<"ALL" | TransferStatus> = [
	"ALL",
	"PENDING",
	"IN_TRANSIT",
	"COMPLETED",
	"CANCELLED",
];

const statusLabel: Record<TransferStatus, string> = {
	PENDING: "Menunggu",
	IN_TRANSIT: "Dalam Perjalanan",
	COMPLETED: "Selesai",
	CANCELLED: "Dibatalkan",
};

const conditionLabel: Record<ProductCondition, string> = {
	GOOD: "Bagus",
	DAMAGED: "Rusak",
};

const isTransferableCondition = (condition: ProductCondition) => condition === "GOOD";

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

type TransferDraftItem = {
	draftKey: string;
	productId: string;
	productName: string;
	condition: ProductCondition;
	quantity: number;
};

const getDraftKey = (productId: string, condition: ProductCondition) => `${productId}:${condition}`;

export default function TransferGudangPage() {
	const [transfers, setTransfers] = useState<WarehouseTransferItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [cities, setCities] = useState<City[]>([]);
	const [loading, setLoading] = useState(true);
	const [inventoryLoading, setInventoryLoading] = useState(false);
	const [citiesLoading, setCitiesLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<"ALL" | TransferStatus>("ALL");
	const [createOpen, setCreateOpen] = useState(false);
	const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
	const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
	const [warehouseForm, setWarehouseForm] = useState({
		name: "",
		address: "",
		cityId: "",
		cityName: "",
		province: "",
	});
	const [sourceWarehouseId, setSourceWarehouseId] = useState("");
	const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
	const [inventoryId, setInventoryId] = useState("");
	const [quantity, setQuantity] = useState(1);
	const [transferDetails, setTransferDetails] = useState<TransferDraftItem[]>([]);
	const [notes, setNotes] = useState("");
	const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [transferItems, warehouseItems] = await Promise.all([
				warehouseTransfersService.listAll({
					sortBy: "transferDate",
					sortOrder: "desc",
					status: status === "ALL" ? undefined : status,
				}),
				warehousesService.listAll(),
			]);
			setTransfers(transferItems);
			setWarehouses(warehouseItems);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat transfer gudang."));
		} finally {
			setLoading(false);
		}
	}, [status]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	useEffect(() => {
		if (!createOpen || inventory.length > 0 || inventoryLoading) {
			return;
		}

		const loadInventory = async () => {
			setInventoryLoading(true);
			try {
				const items = await warehouseInventoryService.listAll({
					sortBy: "updatedAt",
					sortOrder: "desc",
				});
				setInventory(items.filter((item) => item.quantity > 0));
			} catch (loadError: unknown) {
				setError(getApiErrorMessage(loadError, "Gagal memuat stok transfer gudang."));
			} finally {
				setInventoryLoading(false);
			}
		};

		void loadInventory();
	}, [createOpen, inventory.length, inventoryLoading]);

	useEffect(() => {
		if (!warehouseModalOpen || cities.length > 0 || citiesLoading) {
			return;
		}

		const loadCities = async () => {
			setCitiesLoading(true);
			try {
				const items = await citiesService.listAll({ sortBy: "name", sortOrder: "asc" });
				setCities(items);
			} catch (loadError: unknown) {
				setError(getApiErrorMessage(loadError, "Gagal memuat master kota."));
			} finally {
				setCitiesLoading(false);
			}
		};

		void loadCities();
	}, [cities.length, citiesLoading, warehouseModalOpen]);

	const sourceInventory = useMemo(
		() =>
			inventory.filter(
				(item) =>
					isTransferableCondition(item.condition) &&
					(!sourceWarehouseId || item.warehouseId === sourceWarehouseId),
			),
		[inventory, sourceWarehouseId],
	);

	const selectedInventory = sourceInventory.find((item) => item.id === inventoryId);
	const selectedInventoryKey = selectedInventory
		? getDraftKey(selectedInventory.productId, selectedInventory.condition)
		: null;
	const selectedDraftQuantity = useMemo(
		() =>
			selectedInventoryKey
				? transferDetails.find((item) => item.draftKey === selectedInventoryKey)?.quantity ?? 0
				: 0,
		[selectedInventoryKey, transferDetails],
	);
	const remainingSelectedQuantity = selectedInventory
		? Math.max(selectedInventory.quantity - selectedDraftQuantity, 0)
		: 0;

	const resetCreateForm = useCallback(() => {
		setSourceWarehouseId("");
		setDestinationWarehouseId("");
		setInventoryId("");
		setQuantity(1);
		setTransferDetails([]);
		setNotes("");
	}, []);

	const addTransferDetail = () => {
		if (!sourceWarehouseId) {
			setError("Pilih gudang asal terlebih dahulu.");
			return;
		}
		if (!selectedInventory) {
			setError("Pilih barang yang akan ditransfer.");
			return;
		}
		if (quantity < 1 || quantity > remainingSelectedQuantity) {
			setError("Jumlah transfer harus lebih dari 0 dan tidak melebihi stok tersisa.");
			return;
		}

		setError("");
		setTransferDetails((current) => {
			const draftKey = getDraftKey(selectedInventory.productId, selectedInventory.condition);
			const existing = current.find((item) => item.draftKey === draftKey);
			if (existing) {
				return current.map((item) =>
					item.draftKey === draftKey
						? { ...item, quantity: item.quantity + quantity }
						: item,
				);
			}

			return [
				...current,
				{
					draftKey,
					productId: selectedInventory.productId,
					productName: selectedInventory.product?.name ?? selectedInventory.productId,
					condition: selectedInventory.condition,
					quantity,
				},
			];
		});
		setInventoryId("");
		setQuantity(1);
	};

	const saveTransfer = async () => {
		if (!sourceWarehouseId || !destinationWarehouseId) {
			setError("Pilih gudang asal dan gudang tujuan.");
			return;
		}
		if (sourceWarehouseId === destinationWarehouseId) {
			setError("Gudang asal dan tujuan harus berbeda.");
			return;
		}
		if (transferDetails.length === 0) {
			setError("Tambahkan minimal satu barang ke daftar transfer.");
			return;
		}

		setSaving(true);
		setError("");
		try {
			const payload = {
				sourceWarehouseId,
				destinationWarehouseId,
				notes: notes || undefined,
				details: transferDetails.map((detail) => ({
					productId: detail.productId,
					condition: detail.condition,
					quantity: detail.quantity,
				})),
			};
			if (editingTransferId) {
				await warehouseTransfersService.update(editingTransferId, payload);
			} else {
				await warehouseTransfersService.create(payload);
			}
			resetCreateForm();
			setEditingTransferId(null);
			setCreateOpen(false);
			await load();
		} catch (saveError: unknown) {
			setError(
				getApiErrorMessage(
					saveError,
					editingTransferId ? "Gagal memperbarui transfer gudang." : "Gagal membuat transfer gudang.",
				),
			);
		} finally {
			setSaving(false);
		}
	};

	const updateStatus = async (id: string, nextStatus: Exclude<TransferStatus, "PENDING">) => {
		setSaving(true);
		setError("");
		try {
			await warehouseTransfersService.updateStatus(id, nextStatus);
			await load();
		} catch (updateError: unknown) {
			setError(getApiErrorMessage(updateError, "Gagal mengubah status transfer."));
		} finally {
			setSaving(false);
		}
	};

	const handleCreateWarehouse = async () => {
		setError("");
		const name = sanitizeText(warehouseForm.name);
		const address = sanitizeText(warehouseForm.address);
		const cityName = sanitizeText(warehouseForm.cityName);
		const province = sanitizeText(warehouseForm.province);

		if (!name || !address) {
			setError("Nama gudang dan alamat wajib diisi.");
			return;
		}
		if (!warehouseForm.cityId && (!cityName || !province)) {
			setError("Pilih kota, atau isi nama kota dan provinsi baru.");
			return;
		}

		setSaving(true);
		try {
			const resolvedCityId = warehouseForm.cityId
				? warehouseForm.cityId
				: (await citiesService.create({ name: cityName, province })).id;

			await warehousesService.create({
				name,
				address,
				cityId: resolvedCityId,
			});

			setWarehouseForm({ name: "", address: "", cityId: "", cityName: "", province: "" });
			setWarehouseModalOpen(false);
			await load();
		} catch (createError: unknown) {
			setError(getApiErrorMessage(createError, "Gagal membuat gudang."));
		} finally {
			setSaving(false);
		}
	};

	const totals = useMemo(() => {
		const totalQty = transfers.reduce(
			(sum, transfer) => sum + transfer.details.reduce((itemSum, item) => itemSum + item.quantity, 0),
			0,
		);
		return {
			total: transfers.length,
			pending: transfers.filter((transfer) => transfer.status === "PENDING").length,
			inTransit: transfers.filter((transfer) => transfer.status === "IN_TRANSIT").length,
			totalQty,
		};
	}, [transfers]);

	const selectedTransfer = useMemo(
		() => transfers.find((item) => item.id === selectedTransferId) ?? null,
		[selectedTransferId, transfers],
	);

	const selectedTransferSummary = useMemo(
		() =>
			selectedTransfer
				? {
						totalItems: selectedTransfer.details.length,
						totalQuantity: selectedTransfer.details.reduce((sum, item) => sum + item.quantity, 0),
				  }
				: null,
		[selectedTransfer],
	);

	const openCreateModal = () => {
		setError("");
		resetCreateForm();
		setEditingTransferId(null);
		setCreateOpen(true);
	};

	const closeCreateModal = () => {
		setError("");
		resetCreateForm();
		setEditingTransferId(null);
		setCreateOpen(false);
	};

	const openEditModal = (transfer: WarehouseTransferItem) => {
		setError("");
		setEditingTransferId(transfer.id);
		setSourceWarehouseId(transfer.sourceWarehouseId);
		setDestinationWarehouseId(transfer.destinationWarehouseId);
		setInventoryId("");
		setQuantity(1);
		setNotes(transfer.notes ?? "");
		setTransferDetails(
			transfer.details.map((detail) => ({
				draftKey: getDraftKey(detail.productId, detail.condition),
				productId: detail.productId,
				productName: detail.product?.name ?? detail.productId,
				condition: detail.condition,
				quantity: detail.quantity,
			})),
		);
		setCreateOpen(true);
	};

	return (
		<FeaturePage
			title="Transfer Gudang"
			description="Transfer stok antar gudang untuk mencatat perpindahan barang secara rapi dan transparan."
			actions={[{ label: "Buat Transfer", onClick: openCreateModal }]}
		>
			<section className="grid gap-4 md:grid-cols-4">
				{[
					["Total Transfer", totals.total],
					["Menunggu", totals.pending],
					["Dalam Perjalanan", totals.inTransit],
					["Total Qty", totals.totalQty],
				].map(([label, value]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">{label}</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={status}
						onChange={(event) => setStatus(event.target.value as "ALL" | TransferStatus)}
					>
						{statusOptions.map((option) => (
							<option key={option} value={option}>
								{option === "ALL" ? "Semua Status" : statusLabel[option]}
							</option>
						))}
					</select>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => {
								setError("");
								setWarehouseModalOpen(true);
							}}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Tambah Gudang
						</button>
						<button
							type="button"
							onClick={() => void load()}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Muat Ulang
						</button>
					</div>
				</div>
			</section>

			<Modal
				isOpen={createOpen}
				onClose={closeCreateModal}
				title={editingTransferId ? "Edit Transfer Gudang" : "Buat Transfer Gudang"}
			>
				<div className="space-y-4">
					{error ? (
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{error}
						</div>
					) : null}
					<div className="grid gap-3 md:grid-cols-2">
						<select
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={sourceWarehouseId}
							onChange={(event) => {
								setSourceWarehouseId(event.target.value);
								setInventoryId("");
								setQuantity(1);
								setTransferDetails([]);
							}}
						>
							<option value="">Gudang asal</option>
							{warehouses.map((warehouse) => (
								<option key={warehouse.id} value={warehouse.id}>
									{warehouse.name}
								</option>
							))}
						</select>
						<select
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={destinationWarehouseId}
							onChange={(event) => setDestinationWarehouseId(event.target.value)}
						>
							<option value="">Gudang tujuan</option>
							{warehouses.map((warehouse) => (
								<option key={warehouse.id} value={warehouse.id}>
									{warehouse.name}
								</option>
							))}
						</select>
						<select
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
							value={inventoryId}
							onChange={(event) => setInventoryId(event.target.value)}
							disabled={inventoryLoading || !sourceWarehouseId}
						>
							<option value="">
								{!sourceWarehouseId
									? "Pilih gudang asal terlebih dahulu"
									: inventoryLoading
										? "Memuat stok..."
										: "Pilih barang transfer"}
							</option>
							{sourceInventory.map((item) => (
								<option key={item.id} value={item.id}>
									{item.product?.name ?? item.productId} - {conditionLabel[item.condition]} (stok {item.quantity})
								</option>
							))}
						</select>
						<input
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Catatan transfer"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							maxLength={250}
						/>
					</div>

					<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_190px]">
						<input
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							type="number"
							min={1}
							max={remainingSelectedQuantity || undefined}
							value={quantity}
							onChange={(event) => setQuantity(Number(event.target.value))}
							disabled={!selectedInventory}
							placeholder="Jumlah"
						/>
						<div className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
							{selectedInventory ? `Sisa stok: ${remainingSelectedQuantity}` : "Pilih barang dulu"}
						</div>
						<button
							type="button"
							onClick={addTransferDetail}
							disabled={!selectedInventory || saving}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Tambah Barang
						</button>
					</div>

					<div className="overflow-hidden rounded-2xl border border-slate-200">
						<div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
							<div>
								<p className="text-sm font-semibold text-slate-900">Daftar Barang Transfer</p>
								<p className="text-xs text-slate-500">
									{transferDetails.length} barang, {transferDetails.reduce((sum, item) => sum + item.quantity, 0)} unit
								</p>
							</div>
						</div>
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-4 py-3">Barang</th>
									<th className="px-4 py-3">Kualitas</th>
									<th className="px-4 py-3">Jumlah</th>
									<th className="px-4 py-3 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{transferDetails.length === 0 ? (
									<tr>
										<td className="px-4 py-4 text-slate-500" colSpan={4}>
											Belum ada barang yang dimasukkan ke transfer ini.
										</td>
									</tr>
								) : (
									transferDetails.map((detail) => (
										<tr key={detail.draftKey}>
											<td className="px-4 py-3 font-medium text-slate-900">{detail.productName}</td>
											<td className="px-4 py-3 text-slate-600">{conditionLabel[detail.condition]}</td>
											<td className="px-4 py-3 text-slate-600">{detail.quantity}</td>
											<td className="px-4 py-3 text-right">
												<button
													type="button"
													onClick={() =>
														setTransferDetails((current) =>
															current.filter((item) => item.draftKey !== detail.draftKey),
														)
													}
													className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
												>
													Hapus
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={closeCreateModal}
							disabled={saving}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Batal
						</button>
						<button
							type="button"
							onClick={saveTransfer}
							disabled={saving}
							className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{saving ? "Menyimpan..." : editingTransferId ? "Simpan Perubahan" : "Simpan Transfer"}
						</button>
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={warehouseModalOpen}
				onClose={() => setWarehouseModalOpen(false)}
				title="Tambah Gudang"
			>
				<div className="space-y-4">
					{error ? (
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{error}
						</div>
					) : null}
					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-slate-700">
							<span>Nama Gudang</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.name}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, name: e.target.value }))}
								placeholder="Contoh: Gudang Utama"
								disabled={saving}
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700 md:col-span-2">
							<span>Alamat</span>
							<textarea
								className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								value={warehouseForm.address}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, address: e.target.value }))}
								disabled={saving}
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Kota</span>
							<select
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.cityId}
								onChange={(e) =>
									setWarehouseForm((prev) => ({
										...prev,
										cityId: e.target.value,
										cityName: e.target.value ? "" : prev.cityName,
										province: e.target.value ? "" : prev.province,
									}))
								}
								disabled={saving || citiesLoading}
							>
								<option value="">{citiesLoading ? "Memuat kota..." : "Pilih kota"}</option>
								{cities.map((city) => (
									<option key={city.id} value={city.id}>
										{city.name}, {city.province}
									</option>
								))}
							</select>
						</label>
						<p className="text-xs text-slate-500 md:col-span-2">
							Jika kota belum ada, kosongkan pilihan lalu isi nama kota dan provinsi di bawah.
						</p>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Nama Kota Baru</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.cityName}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, cityId: "", cityName: e.target.value }))}
								disabled={saving || Boolean(warehouseForm.cityId)}
								placeholder="Contoh: Medan"
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Provinsi Baru</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.province}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, cityId: "", province: e.target.value }))}
								disabled={saving || Boolean(warehouseForm.cityId)}
								placeholder="Contoh: Sumatera Utara"
							/>
						</label>
					</div>
					<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
						<button
							type="button"
							onClick={() => setWarehouseModalOpen(false)}
							disabled={saving}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleCreateWarehouse}
							disabled={saving}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{saving ? "Menyimpan..." : "Simpan Gudang"}
						</button>
					</div>
				</div>
			</Modal>

			{!createOpen && error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Gudang Asal</th>
							<th className="px-4 py-3">Gudang Tujuan</th>
							<th className="px-4 py-3">Item</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Memuat transfer...
								</td>
							</tr>
						) : transfers.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Belum ada transfer gudang.
								</td>
							</tr>
						) : (
							transfers.map((transfer) => (
								<tr key={transfer.id}>
									<td className="px-4 py-3 text-slate-700">
										{String(transfer.transferDate).slice(0, 10)}
									</td>
									<td className="px-4 py-3 font-medium text-slate-900">
										{transfer.sourceWarehouse?.name ?? "-"}
									</td>
									<td className="px-4 py-3 font-medium text-slate-900">
										{transfer.destinationWarehouse?.name ?? "-"}
									</td>
									<td className="px-4 py-3 text-slate-700">
										<div className="font-medium text-slate-900">
											{transfer.details.length} barang /{" "}
											{transfer.details.reduce((sum, detail) => sum + detail.quantity, 0)} unit
										</div>
										<div className="mt-1 space-y-1 text-xs text-slate-500">
											{transfer.details.slice(0, 2).map((detail) => (
												<div key={detail.id}>
													{detail.product?.name ?? detail.productId} x {detail.quantity}
												</div>
											))}
											{transfer.details.length > 2 ? (
												<div>+{transfer.details.length - 2} barang lainnya</div>
											) : null}
										</div>
									</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
											{toUiLabel(transfer.status, transferStatusLabel)}
										</span>
									</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setSelectedTransferId(transfer.id)}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
											>
												Detail
											</button>
											{transfer.status === "PENDING" ? (
												<>
													<button
														type="button"
														onClick={() => openEditModal(transfer)}
														disabled={saving}
														className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => updateStatus(transfer.id, "IN_TRANSIT")}
														disabled={saving}
														className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
													>
														Jalan
													</button>
													<button
														type="button"
														onClick={() => updateStatus(transfer.id, "COMPLETED")}
														disabled={saving}
														className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
													>
														Selesai
													</button>
												</>
											) : null}
											{transfer.status === "IN_TRANSIT" ? (
												<button
													type="button"
													onClick={() => updateStatus(transfer.id, "COMPLETED")}
													disabled={saving}
													className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
												>
													Selesai
												</button>
											) : null}
											{transfer.status === "PENDING" || transfer.status === "IN_TRANSIT" ? (
												<button
													type="button"
													onClick={() => updateStatus(transfer.id, "CANCELLED")}
													disabled={saving}
													className="rounded-lg border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-60"
												>
													Batal
												</button>
											) : null}
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<Modal
				isOpen={Boolean(selectedTransfer)}
				onClose={() => setSelectedTransferId(null)}
				title="Detail Dokumen Transfer"
			>
				{selectedTransfer ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Tanggal Transfer</p>
								<p className="font-semibold text-slate-900">
									{String(selectedTransfer.transferDate).slice(0, 10)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status</p>
								<p className="font-semibold text-slate-900">
									{toUiLabel(selectedTransfer.status, transferStatusLabel)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Gudang Asal</p>
								<p className="font-semibold text-slate-900">
									{selectedTransfer.sourceWarehouse?.name ?? selectedTransfer.sourceWarehouseId}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Gudang Tujuan</p>
								<p className="font-semibold text-slate-900">
									{selectedTransfer.destinationWarehouse?.name ?? selectedTransfer.destinationWarehouseId}
								</p>
							</div>
						</div>

						{selectedTransferSummary ? (
							<section className="grid gap-3 md:grid-cols-2">
								{[
									{ label: "Baris Item", value: selectedTransferSummary.totalItems },
									{ label: "Total Qty", value: selectedTransferSummary.totalQuantity },
								].map((item) => (
									<div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
										<p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
									</div>
								))}
							</section>
						) : null}

						<div className="rounded-lg border border-slate-200 p-4">
							<p className="text-xs text-slate-500">Catatan Transfer</p>
							<p className="mt-1 text-slate-700">{selectedTransfer.notes || "-"}</p>
						</div>

						<div className="overflow-hidden rounded-lg border border-slate-200">
							<div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
								<h3 className="font-semibold text-slate-900">Detail Barang Ditransfer</h3>
							</div>
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-4 py-3">Barang</th>
										<th className="px-4 py-3">Kondisi</th>
										<th className="px-4 py-3 text-right">Qty</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{selectedTransfer.details.map((detail) => (
										<tr key={detail.id}>
											<td className="px-4 py-3 text-slate-700">
												{detail.product?.name ?? detail.productId}
											</td>
											<td className="px-4 py-3 text-slate-700">
												{detail.condition === "GOOD"
													? "Bagus"
													: conditionLabel[detail.condition]}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-slate-900">
												{detail.quantity}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
