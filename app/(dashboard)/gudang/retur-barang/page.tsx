"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	stockAdjustmentsService,
	type StockAdjustmentRecord,
} from "@/services/stock-adjustments";
import { type ProductCondition } from "@/services/warehouse-inventory";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";
import { productsService, type Product } from "@/services/products";

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

const RETURN_CONDITIONS: ProductCondition[] = ["NEW", "GOOD", "DAMAGED", "DEFECTIVE"];

export default function ReturBarangPage() {
	const [records, setRecords] = useState<StockAdjustmentRecord[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const [warehouseId, setWarehouseId] = useState("");
	const [productId, setProductId] = useState("");
	const [condition, setCondition] = useState<ProductCondition>("GOOD");
	const [quantity, setQuantity] = useState(1);
	const [reason, setReason] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [adjResult, whResult, prodResult] = await Promise.all([
				stockAdjustmentsService.list({ page: 1, limit: 50, type: "RECEIPT", sortBy: "createdAt", sortOrder: "desc" }),
				warehousesService.list({ page: 1, limit: 100 }),
				productsService.list({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
			]);
			setRecords(adjResult.items);
			setWarehouses(whResult.items);
			setProducts(prodResult.items);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message :
				typeof err === "object" && err !== null && "response" in err ?
				(err as { response?: { data?: { message?: string } } }).response?.data?.message :
				"Gagal memuat data retur barang.";
			setError(message || "Gagal memuat data retur barang.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { Promise.resolve().then(load); }, []);

	const summary = useMemo(() => ({
		total: records.length,
		thisMonth: records.filter((r) => {
			const d = new Date(r.transactionDate);
			const now = new Date();
			return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
		}).length,
		totalQty: records.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0), 0),
	}), [records]);

	const handleSubmit = async () => {
		if (!warehouseId || !productId || quantity < 1 || !reason.trim()) {
			setError("Semua field wajib diisi, termasuk alasan retur.");
			return;
		}
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await stockAdjustmentsService.receiveReturn({
				warehouseId,
				productId,
				reason,
				items: [{ condition, quantity }],
			});
			setSuccess("Retur barang berhasil dicatat. Stok gudang telah diperbarui.");
			setWarehouseId("");
			setProductId("");
			setCondition("GOOD");
			setQuantity(1);
			setReason("");
			await load();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message :
				typeof err === "object" && err !== null && "response" in err ?
				(err as { response?: { data?: { message?: string } } }).response?.data?.message :
				"Gagal mencatat retur barang.";
			setError(message || "Gagal mencatat retur barang.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FeaturePage
			title="Retur Barang"
			description="Catat barang yang dikembalikan dari toko ke gudang. Retur barang akan menambah stok gudang sesuai kondisi barang yang diterima kembali."
		>
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
			) : null}
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Total Retur", value: summary.total },
					{ label: "Bulan Ini", value: summary.thisMonth },
					{ label: "Total Unit Kembali", value: summary.totalQty },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Catat Retur Barang</h2>
				<div className="mt-5 grid gap-4 md:grid-cols-2">
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Gudang Tujuan</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={warehouseId}
							onChange={(e) => setWarehouseId(e.target.value)}
							disabled={loading || submitting}
						>
							<option value="">Pilih gudang</option>
							{warehouses.map((wh) => (
								<option key={wh.id} value={wh.id}>{wh.name}</option>
							))}
						</select>
					</label>
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Produk</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={productId}
							onChange={(e) => setProductId(e.target.value)}
							disabled={loading || submitting}
						>
							<option value="">Pilih produk</option>
							{products.map((p) => (
								<option key={p.id} value={p.id}>{p.name}</option>
							))}
						</select>
					</label>
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Kondisi Barang Dikembalikan</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={condition}
							onChange={(e) => setCondition(e.target.value as ProductCondition)}
							disabled={submitting}
						>
							{RETURN_CONDITIONS.map((c) => (
								<option key={c} value={c}>{c}</option>
							))}
						</select>
					</label>
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Jumlah Unit</span>
						<input
							type="number" min={1}
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={quantity}
							onChange={(e) => setQuantity(Number(e.target.value))}
							disabled={submitting}
						/>
					</label>
					<label className="space-y-1.5 text-sm text-slate-700 md:col-span-2">
						<span>Alasan Retur</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							placeholder="Contoh: Barang rusak saat pengiriman, toko tidak jadi menerima, dll."
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							disabled={submitting}
						/>
					</label>
				</div>
				<div className="mt-5 flex justify-end">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={submitting || loading}
						className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
					>
						{submitting ? "Menyimpan..." : "Catat Retur"}
					</button>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
					<h2 className="font-semibold text-slate-900">Riwayat Retur</h2>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Produk</th>
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3">Kondisi</th>
							<th className="px-4 py-3 text-right">Qty</th>
							<th className="px-4 py-3">Alasan</th>
							<th className="px-4 py-3">Tanggal</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
						) : records.length === 0 ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Belum ada riwayat retur.</td></tr>
						) : (
							records.map((rec) =>
								rec.items.map((item) => (
									<tr key={`${rec.id}-${item.id}`}>
										<td className="px-4 py-3 font-medium text-slate-900">{rec.product?.name ?? "-"}</td>
										<td className="px-4 py-3 text-slate-700">{rec.warehouse?.name ?? "-"}</td>
										<td className="px-4 py-3 text-slate-700">{item.toCondition ?? "-"}</td>
										<td className="px-4 py-3 text-right text-slate-900">{item.quantity}</td>
										<td className="px-4 py-3 text-slate-500 text-xs">{rec.reason || "-"}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(rec.transactionDate)}</td>
									</tr>
								))
							)
						)}
					</tbody>
				</table>
			</section>
		</FeaturePage>
	);
}
