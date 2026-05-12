"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	type ProductCondition,
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";
import {
	type StockAdjustmentRecord,
	stockAdjustmentsService,
} from "@/services/stock-adjustments";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

const conditionLabel: Record<ProductCondition, string> = {
	NEW: "New",
	GOOD: "Good",
	DAMAGED: "Rusak",
	DEFECTIVE: "Cacat",
};

export default function BarangRusakPage() {
	const [records, setRecords] = useState<StockAdjustmentRecord[]>([]);
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [warehouseId, setWarehouseId] = useState("");
	const [inventoryId, setInventoryId] = useState("");
	const [toCondition, setToCondition] = useState<"DAMAGED" | "DEFECTIVE">("DAMAGED");
	const [quantity, setQuantity] = useState(1);
	const [reason, setReason] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [recordResult, inventoryResult, warehouseResult] = await Promise.all([
				stockAdjustmentsService.list({
					page: 1,
					limit: 100,
					type: "DAMAGE",
					sortBy: "transactionDate",
					sortOrder: "desc",
				}),
				warehouseInventoryService.list({ page: 1, limit: 100, sortBy: "updatedAt", sortOrder: "desc" }),
				warehousesService.list({ page: 1, limit: 100 }),
			]);
			setRecords(recordResult.items);
			setInventory(
				inventoryResult.items.filter(
					(item) => item.quantity > 0 && (item.condition === "NEW" || item.condition === "GOOD"),
				),
			);
			setWarehouses(warehouseResult.items);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat data barang rusak.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const sourceInventory = useMemo(
		() => inventory.filter((item) => !warehouseId || item.warehouseId === warehouseId),
		[inventory, warehouseId],
	);

	const selectedInventory = sourceInventory.find((item) => item.id === inventoryId);

	const recordDamage = async () => {
		if (!warehouseId || !selectedInventory) {
			setError("Pilih gudang dan barang yang rusak.");
			return;
		}
		if (quantity < 1 || quantity > selectedInventory.quantity) {
			setError("Quantity rusak harus lebih dari 0 dan tidak melebihi stok tersedia.");
			return;
		}

		setSaving(true);
		setError("");
		try {
			await stockAdjustmentsService.recordDamage({
				warehouseId,
				productId: selectedInventory.productId,
				reason: reason || undefined,
				items: [
					{
						fromCondition: selectedInventory.condition as "NEW" | "GOOD",
						toCondition,
						quantity,
					},
				],
			});
			setInventoryId("");
			setQuantity(1);
			setReason("");
			await load();
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal mencatat barang rusak.");
		} finally {
			setSaving(false);
		}
	};

	const totals = useMemo(() => {
		const totalCases = records.length;
		const totalQty = records.reduce(
			(sum, record) => sum + record.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
			0,
		);
		const damagedStock = records.filter((record) =>
			record.items.some((item) => item.toCondition === "DAMAGED"),
		).length;
		const defectiveStock = records.filter((record) =>
			record.items.some((item) => item.toCondition === "DEFECTIVE"),
		).length;
		return { totalCases, totalQty, damagedStock, defectiveStock };
	}, [records]);

	return (
		<FeaturePage
			title="Barang Rusak"
			description="Pencatatan barang rusak memakai stock adjustment DAMAGE BE2. Stok berpindah dari kondisi NEW/GOOD ke DAMAGED/DEFECTIVE secara transaksional."
		>
			<section className="grid gap-4 md:grid-cols-4">
				{[
					["Kasus Kerusakan", totals.totalCases],
					["Total Qty", totals.totalQty],
					["Rusak", totals.damagedStock],
					["Cacat", totals.defectiveStock],
				].map(([label, value]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">{label}</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 lg:grid-cols-5">
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={warehouseId}
						onChange={(event) => {
							setWarehouseId(event.target.value);
							setInventoryId("");
						}}
					>
						<option value="">Pilih gudang</option>
						{warehouses.map((warehouse) => (
							<option key={warehouse.id} value={warehouse.id}>
								{warehouse.name}
							</option>
						))}
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={inventoryId}
						onChange={(event) => setInventoryId(event.target.value)}
					>
						<option value="">Pilih barang</option>
						{sourceInventory.map((item) => (
							<option key={item.id} value={item.id}>
								{item.product?.name ?? item.productId} - {conditionLabel[item.condition]} ({item.quantity})
							</option>
						))}
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={toCondition}
						onChange={(event) => setToCondition(event.target.value as "DAMAGED" | "DEFECTIVE")}
					>
						<option value="DAMAGED">Rusak</option>
						<option value="DEFECTIVE">Cacat</option>
					</select>
					<input
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						type="number"
						min={1}
						max={selectedInventory?.quantity ?? undefined}
						value={quantity}
						onChange={(event) => setQuantity(Number(event.target.value))}
					/>
					<button
						type="button"
						onClick={recordDamage}
						disabled={saving}
						className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
					>
						Catat Rusak
					</button>
				</div>
				<input
					className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					placeholder="Penyebab atau catatan kerusakan"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
			</section>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3">Produk</th>
							<th className="px-4 py-3">Perubahan</th>
							<th className="px-4 py-3">Catatan</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Memuat riwayat barang rusak...
								</td>
							</tr>
						) : records.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Belum ada pencatatan barang rusak.
								</td>
							</tr>
						) : (
							records.map((record) => (
								<tr key={record.id}>
									<td className="px-4 py-3 text-slate-700">
										{String(record.transactionDate).slice(0, 10)}
									</td>
									<td className="px-4 py-3 text-slate-700">{record.warehouse?.name ?? "-"}</td>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{record.product?.name ?? "-"}</div>
										<div className="text-xs text-slate-500">{record.product?.sku ?? "Tanpa SKU"}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{record.items.map((item) => (
											<div key={item.id}>
												{item.fromCondition ? conditionLabel[item.fromCondition] : "-"} ke{" "}
												{item.toCondition ? conditionLabel[item.toCondition] : "-"} x {item.quantity}
											</div>
										))}
									</td>
									<td className="px-4 py-3 text-slate-600">{record.reason || "-"}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</FeaturePage>
	);
}
