"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";

const conditionColors: Record<string, string> = {
	NEW: "bg-emerald-100 text-emerald-800",
	GOOD: "bg-blue-100 text-blue-800",
	DAMAGED: "bg-amber-100 text-amber-800",
	DEFECTIVE: "bg-red-100 text-red-800",
};

export default function PenerimaanBarangPage() {
	const [rows, setRows] = useState<WarehouseInventoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const result = await warehouseInventoryService.list({
				page: 1,
				limit: 100,
				sortBy: "updatedAt",
				sortOrder: "desc",
			});
			setRows(result.items);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat data penerimaan barang.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const filteredRows = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter(
			(row) =>
				(row.product?.name ?? "").toLowerCase().includes(q) ||
				(row.warehouse?.name ?? "").toLowerCase().includes(q) ||
				row.condition.toLowerCase().includes(q),
		);
	}, [rows, search]);

	const summary = useMemo(
		() => ({
			totalSku: new Set(rows.map((row) => row.productId)).size,
			totalRows: rows.length,
			totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
			damagedRows: rows.filter((row) => row.condition === "DAMAGED" || row.condition === "DEFECTIVE").length,
		}),
		[rows],
	);

	return (
		<FeaturePage
			title="Penerimaan Barang"
			description="Daftar stok/inventori terbaru dari proses penerimaan barang. Input barang masuk dilakukan di halaman terpisah agar meja kerja utama tetap ringan."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Baris Inventori", value: summary.totalRows },
					{ label: "SKU Aktif", value: summary.totalSku },
					{ label: "Total Qty", value: summary.totalQuantity },
					{ label: "Rusak/Defect", value: summary.damagedRows },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
						placeholder="Cari produk, gudang, kondisi"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Refresh
						</button>
						<Link
							href="/gudang/kelola-item"
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
						>
							Kelola Item
						</Link>
						<Link
							href="/gudang/penerimaan-barang/input"
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
						>
							Input Barang Masuk
						</Link>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Produk</th>
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3">Kondisi</th>
							<th className="px-4 py-3 text-right">Qty</th>
							<th className="px-4 py-3">Update</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">
									Memuat data penerimaan...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">
									Tidak ada data inventori.
								</td>
							</tr>
						) : (
							filteredRows.map((row) => (
								<tr key={row.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{row.product?.name ?? "-"}</div>
										<div className="text-xs text-slate-500">
											{row.product?.category?.name ?? row.product?.brand?.name ?? "-"}
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{row.warehouse?.name ?? "-"}</td>
									<td className="px-4 py-3">
										<span className={`rounded-full px-2 py-1 text-xs font-medium ${conditionColors[row.condition] ?? "bg-slate-100 text-slate-700"}`}>
											{row.condition}
										</span>
									</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">{row.quantity}</td>
									<td className="px-4 py-3 text-slate-600">
										{String(row.updatedAt || row.createdAt || "").slice(0, 10) || "-"}
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
