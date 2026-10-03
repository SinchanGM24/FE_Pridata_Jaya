"use client";

export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import { canManageWarehouseItems } from "@/lib/role-capabilities";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDateTime } from "@/lib/datetime";
import { logError } from "@/lib/log";
import {
	stockAdjustmentsService,
	type ReceiptBatch,
	type ReceiptBatchesSummary,
} from "@/services/stock-adjustments";
import { aggregateReceiptItems } from "@/services/warehouse-receipts";

const PAGE_SIZE = 20;

/** Batch fallback (meta tidak terbaca) tidak punya nomor referensi; supplier bisa kosong. */
const orDash = (value?: string | null) => value || "—";

function PenerimaanBarangPageContent() {
	const { user } = useAuth();
	const canManageItems = canManageWarehouseItems(user);
	const searchParams = useSearchParams();
	const requestedBatchId = searchParams.get("batchId");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search.trim());
	const [selectedBatch, setSelectedBatch] = useState<ReceiptBatch | null>(null);

	const list = usePagedList(
		(page, limit) =>
			stockAdjustmentsService.receiptBatches({ search: debouncedSearch || undefined, page, limit }),
		{ filterKey: debouncedSearch, errorMessage: "Gagal memuat data penerimaan barang.", pageSize: PAGE_SIZE },
	);

	// Ringkasan sengaja tanpa `search`: jumlah dokumen tetap total semua dokumen seperti sebelumnya.
	const [summary, setSummary] = useState<ReceiptBatchesSummary | null>(null);
	const [summaryError, setSummaryError] = useState("");
	const [summaryTick, setSummaryTick] = useState(0);
	useEffect(() => {
		let active = true;
		stockAdjustmentsService
			.receiptBatchesSummary()
			.then((next) => {
				if (!active) return;
				setSummary(next);
				setSummaryError("");
			})
			.catch((cause: unknown) => {
				if (!active) return;
				setSummary(null); // tampil "—", bukan 0
				setSummaryError(getApiErrorMessage(cause, "Gagal memuat ringkasan penerimaan barang."));
				logError("Gagal memuat ringkasan penerimaan barang.", cause);
			});
		return () => { active = false; };
	}, [summaryTick]);

	// Deep link `?batchId=` (dari Stok Barang): ambil batch itu langsung, walau tidak ada di halaman ini.
	// Galat disimpan per batchId: tanpa `?batchId` (atau dengan batchId lain) galat lama tidak tampil lagi.
	const [linkedFailure, setLinkedFailure] = useState<{ batchId: string; message: string } | null>(null);
	const [linkedTick, setLinkedTick] = useState(0);
	useEffect(() => {
		if (!requestedBatchId) return;
		let active = true;
		stockAdjustmentsService
			.receiptBatches({ batchId: requestedBatchId, limit: 1 })
			.then(({ items }) => {
				if (!active) return;
				setLinkedFailure(null);
				// Jangan timpa dokumen yang sudah dibuka pengguna lewat "Detail".
				if (items[0]) setSelectedBatch((current) => current ?? items[0]);
			})
			.catch((cause: unknown) => {
				if (!active) return;
				setLinkedFailure({
					batchId: requestedBatchId,
					message: getApiErrorMessage(cause, "Gagal membuka dokumen penerimaan."),
				});
				logError("Gagal membuka dokumen penerimaan.", cause);
			});
		return () => { active = false; };
	}, [requestedBatchId, linkedTick]);
	const linkedError =
		linkedFailure && linkedFailure.batchId === requestedBatchId ? linkedFailure.message : "";

	const feedbackError = list.error || summaryError || linkedError;
	const retry = () => {
		list.reload();
		if (summaryError) setSummaryTick((tick) => tick + 1);
		if (linkedError) setLinkedTick((tick) => tick + 1);
	};

	const selectedBatchItemRows = useMemo(
		() => (selectedBatch ? aggregateReceiptItems(selectedBatch.items) : []),
		[selectedBatch],
	);

	return (
		<FeaturePage
			title="Penerimaan Barang"
			description="Daftar dokumen barang masuk dari supplier ke gudang."
			actionsDescription={canManageItems ? "Catat penerimaan barang dari supplier atau kelola master item sebelum input." : "Catat penerimaan barang dari supplier ke gudang yang ditugaskan."}
			actions={[
				...(canManageItems ? [{ label: "Kelola Item", href: "/gudang/kelola-item", tone: "secondary" as const }] : []),
				{ label: "Input Barang Masuk", href: "/gudang/penerimaan-barang/input", tone: "primary" },
			]}
		>
			{/* Hanya galat muat di sini: tidak bisa ditutup, supaya tabel kosong tidak terbaca "Belum ada dokumen". */}
			<PageFeedback error={feedbackError} onRetry={retry} />

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
						placeholder="Cari referensi, supplier, gudang, produk"
						maxLength={100}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<div className="text-sm text-slate-500">
						{summary ? summary.totalDocs : "—"} dokumen
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
						{list.loading && list.items.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Memuat penerimaan barang...
								</td>
							</tr>
						) : list.items.length === 0 ? (
							list.error ? null : (
								<tr>
									<td colSpan={6} className="px-4 py-4 text-slate-600">
										Belum ada dokumen penerimaan yang cocok.
									</td>
								</tr>
							)
						) : (
							list.items.map((row) => (
								<tr key={row.batchId}>
									<td className="px-4 py-3 font-medium text-slate-900">{orDash(row.referenceNumber)}</td>
									<td className="px-4 py-3 text-slate-700">{formatAppDateTime(row.receivedAt)}</td>
									<td className="px-4 py-3 text-slate-700">{orDash(row.supplier)}</td>
									<td className="px-4 py-3 text-slate-700">{row.warehouseName}</td>
									<td className="px-4 py-3 text-right text-slate-700">{row.totalItems}</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => setSelectedBatch(row)}
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
				<PaginationControls
					currentPage={list.page}
					totalPages={list.totalPages}
					totalItems={list.totalItems}
					currentItemCount={list.items.length}
					pageSize={PAGE_SIZE}
					itemLabel="dokumen"
					loading={list.loading}
					onPageChange={list.setPage}
				/>
			</section>

			<Modal
				isOpen={Boolean(selectedBatch)}
				onClose={() => setSelectedBatch(null)}
				title="Detail Dokumen Penerimaan"
			>
				{selectedBatch ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
							<p>
								<span className="font-semibold">Nomor Penerimaan:</span> {orDash(selectedBatch.referenceNumber)}
							</p>
							<p>
								<span className="font-semibold">Tanggal:</span> {formatAppDateTime(selectedBatch.receivedAt)}
							</p>
							<p>
								<span className="font-semibold">Supplier:</span> {orDash(selectedBatch.supplier)}
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

export default function PenerimaanBarangPage() {
	return (
		<Suspense fallback={
			<div className="flex min-h-[400px] items-center justify-center p-8">
				<div className="text-sm text-slate-500 animate-pulse">Memuat...</div>
			</div>
		}>
			<PenerimaanBarangPageContent />
		</Suspense>
	);
}
