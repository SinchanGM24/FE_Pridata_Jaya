"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { stockAdjustmentsService } from "@/services/stock-adjustments";
import { groupWarehouseReceiptBatches } from "@/services/warehouse-receipts";

const formatDate = (value?: string | null) =>
	new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
		new Date(String(value || Date.now())),
	);

export default function PenerimaanBarangPage() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [records, setRecords] = useState<ReturnType<typeof groupWarehouseReceiptBatches>>([]);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const items = await stockAdjustmentsService.listAll({
				type: "RECEIPT",
				sortBy: "transactionDate",
				sortOrder: "desc",
			});
			setRecords(groupWarehouseReceiptBatches(items));
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data penerimaan barang."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, []);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) {
			return records;
		}

		return records.filter(
			(row) =>
				row.referenceNumber.toLowerCase().includes(query) ||
				row.supplier.toLowerCase().includes(query) ||
				row.warehouseName.toLowerCase().includes(query) ||
				row.items.some((item) => item.productName.toLowerCase().includes(query)),
		);
	}, [records, search]);

	const summary = useMemo(
		() => ({
			totalDocs: records.length,
			totalItems: records.reduce((sum, row) => sum + row.totalItems, 0),
			totalDamaged: records.reduce((sum, row) => sum + row.totalDamaged, 0),
			totalUnits: records.reduce(
				(sum, row) => sum + row.items.reduce((inner, item) => inner + item.quantity, 0),
				0,
			),
		}),
		[records],
	);

	return (
		<FeaturePage
			title="Penerimaan Barang"
			description="Ringkasan dokumen penerimaan barang multi-item. Polanya mengikuti FE1: satu dokumen bisa membawa lebih dari satu produk dengan split barang baik dan rusak."
			actions={[
				{ label: "Kelola Item", href: "/gudang/kelola-item" },
				{
					label: loading ? "Memuat..." : "Refresh",
					onClick: () => {
						if (loading) return;
						void load();
					},
				},
				{ label: "Input Barang Masuk", href: "/gudang/penerimaan-barang/input" },
			]}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Dokumen Penerimaan", value: summary.totalDocs },
					{ label: "Total Baris Item", value: summary.totalItems },
					{ label: "Total Unit Masuk", value: summary.totalUnits },
					{ label: "Total Rusak", value: summary.totalDamaged },
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
						placeholder="Cari referensi, supplier, gudang, produk"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<p className="text-xs text-slate-500">
						Cari berdasarkan nomor referensi, supplier, gudang, atau nama produk.
					</p>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Referensi</th>
							<th className="px-4 py-3">Supplier</th>
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Ringkasan Item</th>
							<th className="px-4 py-3 text-right">Rusak</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Memuat penerimaan barang...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Belum ada dokumen penerimaan yang cocok.
								</td>
							</tr>
						) : (
							filteredRows.map((row) => (
								<tr key={row.batchId}>
									<td className="px-4 py-3 font-medium text-slate-900">{row.referenceNumber}</td>
									<td className="px-4 py-3 text-slate-700">{row.supplier}</td>
									<td className="px-4 py-3 text-slate-700">{row.warehouseName}</td>
									<td className="px-4 py-3 text-slate-700">{formatDate(row.receivedAt)}</td>
									<td className="px-4 py-3 text-slate-700">
										<div className="space-y-1">
											{row.items.slice(0, 3).map((item, index) => (
												<div key={`${row.batchId}-${index}`} className="text-xs">
													{item.productName} | {item.condition} x {item.quantity}
												</div>
											))}
											{row.items.length > 3 ? (
												<div className="text-xs text-slate-500">+{row.items.length - 3} item lain</div>
											) : null}
										</div>
									</td>
									<td className="px-4 py-3 text-right font-semibold text-rose-700">
										{row.totalDamaged}
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
