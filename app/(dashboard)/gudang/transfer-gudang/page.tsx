"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import SearchCombobox from "@/components/shared/SearchCombobox";
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
import { warehouseAssignmentService } from "@/services/warehouse-user-assignments";
import { useAuth } from "@/hooks/useAuth";
import { isWarehouseStaff } from "@/lib/role-capabilities";

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

const transferStatusMeta: Record<TransferStatus, { className: string }> = {
	PENDING: { className: "border border-amber-200 bg-amber-50/80 text-amber-700" },
	IN_TRANSIT: { className: "border border-sky-200 bg-sky-50/80 text-sky-700" },
	COMPLETED: { className: "border border-emerald-200 bg-emerald-50/80 text-emerald-700" },
	CANCELLED: { className: "border border-slate-200 bg-slate-100 text-slate-700" },
};

const TransferStatusBadge = ({ status }: { status: TransferStatus }) => (
	<span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur ${transferStatusMeta[status].className}`}>
		{toUiLabel(status, transferStatusLabel)}
	</span>
);

const conditionLabel: Record<ProductCondition, string> = {
	GOOD: "Bagus",
	DAMAGED: "Rusak",
};

const isTransferableCondition = (condition: ProductCondition) => condition === "GOOD";

type TransferDraftItem = {
	draftKey: string;
	productId: string;
	productName: string;
	condition: ProductCondition;
	quantity: number;
};

const getDraftKey = (productId: string, condition: ProductCondition) => `${productId}:${condition}`;

export default function TransferGudangPage() {
	const { user } = useAuth();
	const scopedStaff = isWarehouseStaff(user);
	const [assignedWarehouseId, setAssignedWarehouseId] = useState<string | null>(null);
	const [transfers, setTransfers] = useState<WarehouseTransferItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<"ALL" | TransferStatus>("ALL");
	const [createOpen, setCreateOpen] = useState(false);
	const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
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
			const [transferItems, warehouseItems, assignment] = await Promise.all([
				warehouseTransfersService.listAll({
					sortBy: "transferDate",
					sortOrder: "desc",
					status: status === "ALL" ? undefined : status,
				}),
				warehousesService.listAll(),
				scopedStaff ? warehouseAssignmentService.getMyAssignment() : Promise.resolve(null),
			]);
			setTransfers(transferItems);
			setWarehouses(warehouseItems);
			setAssignedWarehouseId(assignment?.warehouseId ?? null);
			if (scopedStaff && !assignment) setError("Akun gudang belum ditetapkan ke gudang manapun.");
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat transfer gudang."));
		} finally {
			setLoading(false);
		}
	}, [status, scopedStaff]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const selectedInventory = inventory.find((item) => item.id === inventoryId);
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
		setSourceWarehouseId(scopedStaff ? assignedWarehouseId ?? "" : "");
		setDestinationWarehouseId("");
		setInventoryId("");
		setQuantity(1);
		setTransferDetails([]);
		setNotes("");
	}, [assignedWarehouseId, scopedStaff]);

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
					productName: selectedInventory.product?.name ?? "Produk",
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
		if (scopedStaff && !assignedWarehouseId) { setError("Akun gudang belum memiliki penugasan aktif."); return; }
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
		if (scopedStaff && transfer.sourceWarehouseId !== assignedWarehouseId) { setError("Hanya gudang asal yang dapat mengubah transfer pending."); return; }
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
				productName: detail.product?.name ?? "Produk",
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
			actionsDescription="Buat dan pantau perpindahan stok antar gudang. Pengelolaan gudang tersedia di Penugasan Gudang."
			actions={[
				{ label: "Buat Transfer", onClick: openCreateModal, tone: "primary" },
			]}
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
							disabled={scopedStaff}
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
						<SearchCombobox
							className="md:col-span-2"
							value={inventoryId}
							selectedOption={selectedInventory ? { value: selectedInventory.id, label: selectedInventory.product?.name ?? "Produk", description: `${conditionLabel[selectedInventory.condition]} · stok ${selectedInventory.quantity}` } : null}
							loadOptions={async (query) => {
								const items = (await warehouseInventoryService.search({ search: query, warehouseId: sourceWarehouseId, condition: "GOOD" })).filter((item) => item.quantity > 0 && isTransferableCondition(item.condition));
								setInventory((current) => Array.from(new Map([...current, ...items].map((item) => [item.id, item])).values()));
								return items.map((item) => ({ value: item.id, label: item.product?.name ?? "Produk", description: `${conditionLabel[item.condition]} · stok ${item.quantity}` }));
							}}
							onChange={(value) => setInventoryId(value)}
							disabled={!sourceWarehouseId}
							dependencyKey={sourceWarehouseId}
							placeholder={sourceWarehouseId ? "Cari barang transfer" : "Pilih gudang asal terlebih dahulu"}
						/>
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
							className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
						>
							{saving ? "Menyimpan..." : editingTransferId ? "Simpan Perubahan" : "Simpan Transfer"}
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
													{detail.product?.name ?? "Produk"} x {detail.quantity}
												</div>
											))}
											{transfer.details.length > 2 ? (
												<div>+{transfer.details.length - 2} barang lainnya</div>
											) : null}
										</div>
									</td>
									<td className="px-4 py-3">
									<TransferStatusBadge status={transfer.status} />
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
							{transfer.status === "PENDING" && (!scopedStaff || transfer.sourceWarehouseId === assignedWarehouseId) ? (
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
												</>
											) : null}
							{transfer.status === "IN_TRANSIT" && (!scopedStaff || transfer.destinationWarehouseId === assignedWarehouseId) ? (
												<button
													type="button"
													onClick={() => updateStatus(transfer.id, "COMPLETED")}
													disabled={saving}
													className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
												>
											Terima
												</button>
											) : null}
							{(transfer.status === "PENDING" || transfer.status === "IN_TRANSIT") && (!scopedStaff || transfer.sourceWarehouseId === assignedWarehouseId) ? (
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
								<TransferStatusBadge status={selectedTransfer.status} />
							</div>
							<div>
								<p className="text-xs text-slate-500">Gudang Asal</p>
								<p className="font-semibold text-slate-900">
									{selectedTransfer.sourceWarehouse?.name ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Gudang Tujuan</p>
								<p className="font-semibold text-slate-900">
									{selectedTransfer.destinationWarehouse?.name ?? "-"}
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
												{detail.product?.name ?? "Produk"}
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
