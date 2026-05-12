"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	type ProductCondition,
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

const conditionOptions: Array<{ value: "ALL" | ProductCondition; label: string }> = [
	{ value: "ALL", label: "Semua Kondisi" },
	{ value: "NEW", label: "New" },
	{ value: "GOOD", label: "Good" },
	{ value: "DAMAGED", label: "Damaged" },
	{ value: "DEFECTIVE", label: "Defective" },
];

export default function StokGudangPage() {
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [warehouseId, setWarehouseId] = useState("ALL");
	const [condition, setCondition] = useState<"ALL" | ProductCondition>("ALL");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [inventoryResult, warehouseResult] = await Promise.all([
				warehouseInventoryService.list({ page: 1, limit: 100, sortBy: "updatedAt", sortOrder: "desc" }),
				warehousesService.list({ page: 1, limit: 100 }),
			]);
			setInventory(inventoryResult.items);
			setWarehouses(warehouseResult.items);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat stok gudang.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return inventory.filter((item) => {
			if (warehouseId !== "ALL" && item.warehouseId !== warehouseId) return false;
			if (condition !== "ALL" && item.condition !== condition) return false;
			if (!query) return true;
			return (
				item.product?.name?.toLowerCase().includes(query) ||
				item.product?.sku?.toLowerCase().includes(query) ||
				item.warehouse?.name?.toLowerCase().includes(query) ||
				item.product?.category?.name?.toLowerCase().includes(query) ||
				false
			);
		});
	}, [condition, inventory, search, warehouseId]);

	const totals = useMemo(() => {
		const totalRows = filteredRows.length;
		const totalQuantity = filteredRows.reduce((sum, item) => sum + item.quantity, 0);
		const lowStock = filteredRows.filter((item) => item.quantity <= 10).length;
		const damaged = filteredRows.filter(
			(item) => item.condition === "DAMAGED" || item.condition === "DEFECTIVE",
		).length;
		return { totalRows, totalQuantity, lowStock, damaged };
	}, [filteredRows]);

	return (
		<FeaturePage
			title="Stok Gudang"
			description="Daftar stok lintas gudang untuk memantau SKU, kondisi barang, dan titik stok yang mulai tipis."
		>
			<section className="grid gap-4 md:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Baris Inventori</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{totals.totalRows}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Total Quantity</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{totals.totalQuantity}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">{"Low Stock (<=10)"}</p>
					<p className="mt-2 text-3xl font-semibold text-amber-600">{totals.lowStock}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Barang Rusak</p>
					<p className="mt-2 text-3xl font-semibold text-rose-600">{totals.damaged}</p>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
					<input
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari produk, SKU, gudang, atau kategori"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={warehouseId}
						onChange={(e) => setWarehouseId(e.target.value)}
					>
						<option value="ALL">Semua Gudang</option>
						{warehouses.map((warehouse) => (
							<option key={warehouse.id} value={warehouse.id}>
								{warehouse.name}
							</option>
						))}
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={condition}
						onChange={(e) => setCondition(e.target.value as "ALL" | ProductCondition)}
					>
						{conditionOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<button
						onClick={load}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
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
							<th className="px-4 py-3">Produk</th>
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3">Kategori</th>
							<th className="px-4 py-3">Kondisi</th>
							<th className="px-4 py-3 text-right">Quantity</th>
							<th className="px-4 py-3">Update</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Memuat inventori...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Tidak ada stok yang cocok dengan filter saat ini.
								</td>
							</tr>
						) : (
							filteredRows.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{item.product?.name ?? "-"}</div>
										<div className="text-xs text-slate-500">{item.product?.sku ?? "Tanpa SKU"}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{item.warehouse?.name ?? "-"}</td>
									<td className="px-4 py-3 text-slate-700">
										{item.product?.category?.name ?? "Tanpa kategori"}
									</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
											{item.condition}
										</span>
									</td>
									<td className="px-4 py-3 text-right font-medium text-slate-900">{item.quantity}</td>
									<td className="px-4 py-3 text-slate-500">
										{String(item.updatedAt || item.createdAt || "").slice(0, 10) || "-"}
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
