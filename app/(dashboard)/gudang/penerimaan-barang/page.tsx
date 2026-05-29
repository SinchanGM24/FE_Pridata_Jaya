"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDateTime } from "@/lib/datetime";
import { stockAdjustmentsService } from "@/services/stock-adjustments";
import { groupWarehouseReceiptBatches } from "@/services/warehouse-receipts";

const conditionLabel = (value: string) => {
	if (value === "DAMAGED") return "Rusak";
	if (value === "GOOD" || value === "GOOD") return "Bagus";
	return value || "-";
};

export default function PenerimaanBarangPage() {
	const searchParams = useSearchParams();
	const requestedBatchId = searchParams.get("batchId");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [records, setRecords] = useState<ReturnType<typeof groupWarehouseReceiptBatches>>([]);
	const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const items = await stockAdjustmentsService.listAll({
				type: "RECEIPT",
				sortBy: "transactionDate",
				sortOrder: "desc",
			});
			const groupedRecords = groupWarehouseReceiptBatches(items);
			setRecords(groupedRecords);
			if (requestedBatchId && groupedRecords.some((item) => item.batchId === requestedBatchId)) {
				setSelectedBatchId(requestedBatchId);
			}
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data penerimaan barang."));
		} finally {
			setLoading(false);
		}
	}, [requestedBatchId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

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

	const selectedBatch = useMemo(
		() => records.find((item) => item.batchId === selectedBatchId) ?? null,
		[records, selectedBatchId],
	);

	const selectedBatchItemRows = useMemo(() => {
		if (!selectedBatch) {
			return [];
		}

		const grouped = new Map<
			string,
			{
				productName: string;
				receivedQuantity: number;
				goodQuantity: number;
				damagedQuantity: number;
			}
		>();

		for (const item of selectedBatch.items) {
			const current = grouped.get(item.productName) ?? {
				productName: item.productName,
				receivedQuantity: 0,
				goodQuantity: 0,
				damagedQuantity: 0,
			};

			current.receivedQuantity += item.quantity;
			if (conditionLabel(item.condition) === "Rusak") {
				current.damagedQuantity += item.quantity;
			} else {
				current.goodQuantity += item.quantity;
			}

			grouped.set(item.productName, current);
		}

		return Array.from(grouped.values()).sort((left, right) =>
			left.productName.localeCompare(right.productName, "id"),
		);
	}, [selectedBatch]);

	return (
		<FeaturePage
			title="Penerimaan Barang"
			description="Daftar dokumen barang masuk dari supplier ke gudang."
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

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
						placeholder="Cari referensi, supplier, gudang, produk"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<div className="text-sm text-slate-500">
						{summary.totalDocs} dokumen
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Nomor Penerimaan</th>
							<th className="px-4 py-3">Tanggal Masuk</th>
							<th className="px-4 py-3">Supplier</th>
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3 text-right">Jumlah Item</th>
							<th className="px-4 py-3">Aksi</th>
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
									<td className="px-4 py-3 text-slate-700">{formatAppDateTime(row.receivedAt)}</td>
									<td className="px-4 py-3 text-slate-700">{row.supplier}</td>
									<td className="px-4 py-3 text-slate-700">{row.warehouseName}</td>
									<td className="px-4 py-3 text-right text-slate-700">{row.totalItems}</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => setSelectedBatchId(row.batchId)}
											className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
										>
											Detail
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<Modal
				isOpen={Boolean(selectedBatch)}
				onClose={() => setSelectedBatchId(null)}
				title="Detail Dokumen Penerimaan"
			>
				{selectedBatch ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
							<p>
								<span className="font-semibold">Nomor Penerimaan:</span> {selectedBatch.referenceNumber}
							</p>
							<p>
								<span className="font-semibold">Tanggal:</span> {formatAppDateTime(selectedBatch.receivedAt)}
							</p>
							<p>
								<span className="font-semibold">Supplier:</span> {selectedBatch.supplier}
							</p>
							<p>
								<span className="font-semibold">Gudang Tujuan:</span> {selectedBatch.warehouseName}
							</p>
							{selectedBatch.note ? (
								<p className="md:col-span-2">
									<span className="font-semibold">Catatan:</span> {selectedBatch.note}
								</p>
							) : null}
						</div>

						<div className="overflow-hidden rounded-xl border border-slate-200">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-3 py-2">Barang</th>
										<th className="px-3 py-2 text-right">Diterima</th>
										<th className="px-3 py-2 text-right">Bagus</th>
										<th className="px-3 py-2 text-right">Rusak</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{selectedBatchItemRows.map((item) => (
										<tr key={item.productName}>
											<td className="px-3 py-2 text-slate-700">{item.productName}</td>
											<td className="px-3 py-2 text-right text-slate-900">{item.receivedQuantity}</td>
											<td className="px-3 py-2 text-right text-slate-900">{item.goodQuantity}</td>
											<td className="px-3 py-2 text-right text-rose-700">{item.damagedQuantity}</td>
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
