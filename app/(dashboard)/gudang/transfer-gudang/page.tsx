"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
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
	PENDING: "Pending",
	IN_TRANSIT: "Dalam Perjalanan",
	COMPLETED: "Selesai",
	CANCELLED: "Dibatalkan",
};

const conditionLabel: Record<ProductCondition, string> = {
	NEW: "New",
	GOOD: "Good",
	DAMAGED: "Rusak",
	DEFECTIVE: "Cacat",
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function TransferGudangPage() {
	const [transfers, setTransfers] = useState<WarehouseTransferItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [cities, setCities] = useState<City[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<"ALL" | TransferStatus>("ALL");
	const [createOpen, setCreateOpen] = useState(false);
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
	const [notes, setNotes] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [transferResult, warehouseResult, inventoryResult, cityResult] = await Promise.all([
				warehouseTransfersService.list({
					page: 1,
					limit: 100,
					sortBy: "transferDate",
					sortOrder: "desc",
					status: status === "ALL" ? undefined : status,
				}),
				warehousesService.list({ page: 1, limit: 100 }),
				warehouseInventoryService.list({ page: 1, limit: 100, sortBy: "updatedAt", sortOrder: "desc" }),
				citiesService.list({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
			]);
			setTransfers(transferResult.items);
			setWarehouses(warehouseResult.items);
			setInventory(inventoryResult.items.filter((item) => item.quantity > 0));
			setCities(cityResult);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat transfer gudang.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, [status]);

	const sourceInventory = useMemo(
		() =>
			inventory.filter((item) => !sourceWarehouseId || item.warehouseId === sourceWarehouseId),
		[inventory, sourceWarehouseId],
	);

	const selectedInventory = sourceInventory.find((item) => item.id === inventoryId);

	const createTransfer = async () => {
		if (!sourceWarehouseId || !destinationWarehouseId || !selectedInventory) {
			setError("Pilih gudang asal, gudang tujuan, dan produk yang akan ditransfer.");
			return;
		}
		if (sourceWarehouseId === destinationWarehouseId) {
			setError("Gudang asal dan tujuan harus berbeda.");
			return;
		}
		if (quantity < 1 || quantity > selectedInventory.quantity) {
			setError("Quantity transfer harus lebih dari 0 dan tidak melebihi stok tersedia.");
			return;
		}

		setSaving(true);
		setError("");
		try {
			await warehouseTransfersService.create({
				sourceWarehouseId,
				destinationWarehouseId,
				notes: notes || undefined,
				details: [
					{
						productId: selectedInventory.productId,
						condition: selectedInventory.condition,
						quantity,
					},
				],
			});
			setInventoryId("");
			setQuantity(1);
			setNotes("");
			setCreateOpen(false);
			await load();
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal membuat transfer gudang.");
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
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal mengubah status transfer.");
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

			const newWarehouse = await warehousesService.create({
				name,
				address,
				cityId: resolvedCityId,
			});

			setWarehouseForm({ name: "", address: "", cityId: "", cityName: "", province: "" });
			setWarehouseModalOpen(false);
			await load();
		} catch (err: unknown) {
			setError("Gagal membuat gudang.");
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

	return (
		<FeaturePage
			title="Transfer Gudang"
			description="Transfer stok antar gudang memakai state machine BE2. Penyelesaian transfer akan memindahkan stok secara atomik di backend."
			actions={[{ label: "Buat Transfer", onClick: () => {
				setError("");
				setCreateOpen(true);
			} }]}
		>
			<section className="grid gap-4 md:grid-cols-4">
				{[
					["Total Transfer", totals.total],
					["Pending", totals.pending],
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
							onClick={() => setWarehouseModalOpen(true)}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Tambah Gudang
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
			</section>

			<Modal
				isOpen={createOpen}
				onClose={() => setCreateOpen(false)}
				title="Buat Transfer Gudang"
			>
				<div className="space-y-3">
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
						>
							<option value="">Produk dan kondisi</option>
							{sourceInventory.map((item) => (
								<option key={item.id} value={item.id}>
									{item.product?.name ?? item.productId} - {conditionLabel[item.condition]} ({item.quantity})
								</option>
							))}
						</select>
						<input
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							type="number"
							min={1}
							max={selectedInventory?.quantity ?? undefined}
							value={quantity}
							onChange={(event) => setQuantity(Number(event.target.value))}
						/>
						<input
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Catatan transfer"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
						/>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={() => setCreateOpen(false)}
							disabled={saving}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Batal
						</button>
						<button
							type="button"
							onClick={createTransfer}
							disabled={saving}
							className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{saving ? "Menyimpan..." : "Simpan Transfer"}
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
								disabled={saving}
							>
								<option value="">Pilih kota</option>
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
							<th className="px-4 py-3">Rute</th>
							<th className="px-4 py-3">Item</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Memuat transfer...
								</td>
							</tr>
						) : transfers.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Belum ada transfer gudang.
								</td>
							</tr>
						) : (
							transfers.map((transfer) => (
								<tr key={transfer.id}>
									<td className="px-4 py-3 text-slate-700">
										{String(transfer.transferDate).slice(0, 10)}
									</td>
									<td className="px-4 py-3 text-slate-700">
										<div className="font-medium text-slate-900">
											{transfer.sourceWarehouse?.name ?? "-"} {"->"}{" "}
											{transfer.destinationWarehouse?.name ?? "-"}
										</div>
										<div className="text-xs text-slate-500">{transfer.notes || "Tanpa catatan"}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{transfer.details.map((detail) => (
											<div key={detail.id}>
												{detail.product?.name ?? detail.productId} - {conditionLabel[detail.condition]} x{" "}
												{detail.quantity}
											</div>
										))}
									</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
											{statusLabel[transfer.status]}
										</span>
									</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-2">
											{transfer.status === "PENDING" ? (
												<>
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
		</FeaturePage>
	);
}
