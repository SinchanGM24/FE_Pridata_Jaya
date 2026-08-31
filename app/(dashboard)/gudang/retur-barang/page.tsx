"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDateTime } from "@/lib/datetime";
import {
	storeReturnsService,
	type StoreReturnItemCondition,
	type StoreReturnRequestItem,
	type StoreReturnStatus,
} from "@/services/store-returns";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const statusTone: Record<string, string> = {
	PENDING: "border border-amber-200 bg-amber-50 text-amber-700",
	APPROVED_GOOD: "border border-emerald-200 bg-emerald-50 text-emerald-700",
	APPROVED_DAMAGED: "border border-rose-200 bg-rose-50 text-rose-700",
	REJECTED: "border border-slate-200 bg-slate-50 text-slate-700",
};

type GudangDecision = Exclude<StoreReturnStatus, "PENDING">;
const PAGE_SIZE = 10;

interface ReviewItemDraft {
	returnItemId: string;
	productName: string;
	requestedQuantity: number;
	receivedQuantity: string;
	approvedCondition: StoreReturnItemCondition;
}

const requestedConditionLabel: Record<StoreReturnItemCondition, string> = {
	GOOD: "Salah Kirim / Barang Masih Baik",
	DAMAGED: "Rusak",
};

const getRequestedConditionSummary = (request: StoreReturnRequestItem) => {
	const requestedConditions = Array.from(
		new Set(request.items.map((item) => item.requestedCondition)),
	);
	if (requestedConditions.length === 1) {
		return requestedConditionLabel[requestedConditions[0]];
	}
	return requestedConditions
		.map((condition) => requestedConditionLabel[condition])
		.join(", ");
};

export default function ReturBarangPage() {
	const [requests, setRequests] = useState<StoreReturnRequestItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const [totalItems, setTotalItems] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [activeRequest, setActiveRequest] =
		useState<StoreReturnRequestItem | null>(null);
	const [verificationNote, setVerificationNote] = useState("");
	const [decision, setDecision] = useState<GudangDecision>("APPROVED_GOOD");
	const [reviewItems, setReviewItems] = useState<ReviewItemDraft[]>([]);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const result = await storeReturnsService.list({
				page,
				limit: PAGE_SIZE,
				search: debouncedSearch || undefined,
				sortBy: "submittedAt",
				sortOrder: "desc",
			});
			setRequests(result.items);
			setTotalItems(result.meta?.totalItems ?? result.items.length);
			const nextTotalPages = Math.max(1, result.meta?.totalPages ?? 1);
			setTotalPages(nextTotalPages);
			if (page > nextTotalPages) setPage(nextTotalPages);
		} catch (loadError: unknown) {
			setError(
				getApiErrorMessage(
					loadError,
					"Gagal memuat pengajuan retur barang.",
				),
			);
		} finally {
			setLoading(false);
		}
	}, [debouncedSearch, page]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setDebouncedSearch(search.trim());
			setPage(1);
		}, 350);
		return () => window.clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const summary = useMemo(
		() => ({
			pending: requests.filter((item) => item.status === "PENDING").length,
			approved: requests.filter(
				(item) =>
					item.status === "APPROVED_GOOD" ||
					item.status === "APPROVED_DAMAGED",
			).length,
			rejected: requests.filter((item) => item.status === "REJECTED").length,
		}),
		[requests],
	);

	const currentPage = Math.min(page, totalPages);
	const paginatedRequests = requests;

	const openDetail = (request: StoreReturnRequestItem) => {
		setActiveRequest(request);
		setDecision("APPROVED_GOOD");
		setVerificationNote(request.reviewNote || "");
		setReviewItems(
			request.items.map((item) => ({
				returnItemId: item.id,
				productName: item.productNameSnapshot,
				requestedQuantity: item.quantity,
				receivedQuantity: String(item.quantity),
				approvedCondition: item.requestedCondition,
			})),
		);
	};

	const applyDecision = async () => {
		if (!activeRequest) {
			return;
		}

		setSaving(true);
		setError("");
		setSuccess("");
		try {
			const reviewedItems = reviewItems.map((item) => ({
				returnItemId: item.returnItemId,
				receivedQuantity: Math.max(0, Math.floor(Number(item.receivedQuantity) || 0)),
				approvedCondition: item.approvedCondition,
			}));
			if (decision !== "REJECTED") {
				const invalidItem = reviewedItems.find(
					(item, index) => item.receivedQuantity > reviewItems[index].requestedQuantity,
				);
				if (invalidItem) {
					setError("Jumlah diterima tidak boleh melebihi jumlah yang diajukan.");
					setSaving(false);
					return;
				}
				if (!reviewedItems.some((item) => item.receivedQuantity > 0)) {
					setError("Isi minimal satu jumlah barang yang diterima, atau pilih Tolak Seluruh Retur.");
					setSaving(false);
					return;
				}
			}
			const resolvedDecision: GudangDecision =
				decision === "REJECTED"
					? "REJECTED"
					: reviewedItems.some(
							(item) => item.receivedQuantity > 0 && item.approvedCondition === "DAMAGED",
						)
						? "APPROVED_DAMAGED"
						: "APPROVED_GOOD";
			await storeReturnsService.review(activeRequest.id, {
				decision: resolvedDecision,
				reviewNote: verificationNote.trim() || undefined,
				items: decision === "REJECTED" ? undefined : reviewedItems,
			});

			setSuccess("Verifikasi retur berhasil diproses.");
			setActiveRequest(null);
			setVerificationNote("");
			setReviewItems([]);
			await load();
		} catch (submitError: unknown) {
			setError(
				getApiErrorMessage(
					submitError,
					"Gagal memproses verifikasi retur.",
				),
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<FeaturePage
			title="Retur Barang"
			description="Gudang memverifikasi pengajuan retur yang sudah diklasifikasikan toko. Jika toko mengajukan salah kirim maka barang kembali ke stok baik, jika rusak maka barang masuk pencatatan barang rusak setelah dicek gudang."
		>
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>

			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Total Hasil", value: totalItems },
					{ label: "Menunggu di Halaman", value: summary.pending },
					{ label: "Disetujui di Halaman", value: summary.approved },
					{ label: "Ditolak di Halaman", value: summary.rejected },
				].map((item) => (
					<div
						key={item.label}
						className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
					>
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">
							{item.label}
						</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">
							{item.value}
						</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
				Toko sekarang menentukan dulu alasan retur dan klasifikasi awal barang:
				<span className="font-semibold text-slate-900"> rusak</span> atau
				<span className="font-semibold text-slate-900">
					{" "}
					salah kirim / masih baik
				</span>
				. Gudang tinggal memverifikasi klasifikasi tersebut saat barang fisik
				dicek.
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 className="font-semibold text-slate-900">Riwayat Retur</h2>
						<p className="mt-1 text-xs text-slate-500">
							Menampilkan {requests.length} dari {totalItems} pengajuan.
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<input
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
							placeholder="Cari request, toko, invoice, item..."
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-72"
						/>
					</div>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Request</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">
									Memuat retur barang...
								</td>
							</tr>
						) : requests.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">
									Tidak ada pengajuan retur yang sesuai pencarian.
								</td>
							</tr>
						) : (
							paginatedRequests.map((request) => (
								<tr key={request.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">
											{request.requestNumber}
										</div>
										<div className="text-xs text-slate-500">
											{formatAppDateTime(request.submittedAt)}
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{request.store?.name ?? "-"}
									</td>
									<td className="px-4 py-3 text-slate-700">
										<div>
											{request.invoice?.invoiceNumber ?? "-"}
										</div>
										<div className="text-xs text-slate-500">
											Diterima {formatAppDateTime(request.invoice?.deliveryOrder?.receivedAt)}
										</div>
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[request.status] ?? "border border-slate-200 bg-slate-50 text-slate-700"}`}
										>
											{request.status}
										</span>
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => openDetail(request)}
											className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
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
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={totalItems}
					currentItemCount={paginatedRequests.length}
					pageSize={PAGE_SIZE}
					itemLabel="retur"
					onPageChange={setPage}
				/>
			</section>

			<Modal
				isOpen={Boolean(activeRequest)}
				onClose={() => setActiveRequest(null)}
				title="Detail Retur Barang"
			>
				{activeRequest ? (
					<div className="space-y-4">
						<div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Nomor Retur</p>
								<p className="font-semibold text-slate-900">
									{activeRequest.requestNumber}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Tanggal Pengajuan</p>
								<p className="font-semibold text-slate-900">
									{formatAppDateTime(activeRequest.submittedAt)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Toko</p>
								<p className="font-semibold text-slate-900">
									{activeRequest.store?.name ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Invoice</p>
								<p className="font-semibold text-slate-900">
									{activeRequest.invoice?.invoiceNumber ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Gudang Tujuan Retur</p>
								<p className="font-semibold text-slate-900">
									{activeRequest.sourceWarehouse?.name ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Potong Piutang</p>
								<p className="font-semibold text-slate-900">
									{formatRupiah(activeRequest.receivableAdjustmentAmount)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Klasifikasi Toko</p>
								<p className="font-semibold text-slate-900">
									{getRequestedConditionSummary(activeRequest)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status</p>
								<span
									className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[activeRequest.status] ?? "border border-slate-200 bg-slate-50 text-slate-700"}`}
								>
									{activeRequest.status}
								</span>
							</div>
							<div className="md:col-span-2">
								<p className="text-xs text-slate-500">Alasan dari Toko</p>
								<p className="mt-1 font-medium text-slate-900">{activeRequest.reason}</p>
								<p className="mt-1 text-slate-600">{activeRequest.note || "-"}</p>
							</div>
						</div>
						<div className="overflow-hidden rounded-xl border border-slate-200">
							<div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
								<h3 className="text-sm font-semibold text-slate-900">Barang yang Diretur</h3>
							</div>
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-3 py-2">Barang</th>
										<th className="px-3 py-2 text-right">Diajukan</th>
										<th className="px-3 py-2 text-right">Diterima</th>
										<th className="px-3 py-2">Klasifikasi Toko</th>
										<th className="px-3 py-2">Hasil Gudang</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{activeRequest.items.map((item, index) => (
										<tr key={item.id}>
											<td className="px-3 py-2 text-slate-700">
												{item.productNameSnapshot}
											</td>
											<td className="px-3 py-2 text-right text-slate-900">
												{item.quantity}
											</td>
											<td className="px-3 py-2 text-right text-slate-900">
												{activeRequest.status === "PENDING" ? (
													<input
														type="number"
														min={0}
														max={item.quantity}
														value={reviewItems[index]?.receivedQuantity ?? "0"}
														onChange={(event) =>
															setReviewItems((current) =>
																current.map((row, rowIndex) =>
																	rowIndex === index
																		? { ...row, receivedQuantity: event.target.value }
																		: row,
																),
															)
														}
														className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
													/>
												) : (
													item.receivedQuantity ?? item.quantity
												)}
											</td>
											<td className="px-3 py-2 text-slate-700">
												{requestedConditionLabel[item.requestedCondition]}
											</td>
											<td className="px-3 py-2 text-slate-700">
												{activeRequest.status === "PENDING" ? (
													<select
														value={reviewItems[index]?.approvedCondition ?? item.requestedCondition}
														onChange={(event) =>
															setReviewItems((current) =>
																current.map((row, rowIndex) =>
																	rowIndex === index
																		? {
																				...row,
																				approvedCondition: event.target.value as StoreReturnItemCondition,
																			}
																		: row,
																),
															)
														}
														className="rounded-lg border border-slate-300 px-2 py-1.5"
													>
														<option value="GOOD">Barang Bagus</option>
														<option value="DAMAGED">Barang Rusak</option>
													</select>
												) : (
													requestedConditionLabel[item.requestedCondition]
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{activeRequest.reviewNote ? (
							<div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
								<p className="text-xs text-slate-500">Catatan Verifikasi Gudang</p>
								<p className="mt-1">{activeRequest.reviewNote}</p>
							</div>
						) : null}
						{activeRequest.status === "PENDING" ? (
							<>
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
									<p className="mb-3 font-semibold text-slate-900">Cara Memproses Retur</p>
									<div className="flex flex-wrap gap-2">
										{[
											{ value: "APPROVED_GOOD", label: "Terima Sesuai Hasil Per Item" },
											{ value: "REJECTED", label: "Tolak Seluruh Retur" },
										].map((item) => (
											<button
												key={item.value}
												type="button"
												onClick={() => setDecision(item.value as GudangDecision)}
												className={`rounded-lg px-3 py-2 text-xs font-semibold ${
													decision === item.value
														? "bg-indigo-600 text-white"
														: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
												}`}
											>
												{item.label}
											</button>
										))}
									</div>
									<p className="mt-3 text-slate-600">
										{decision === "REJECTED"
											? "Seluruh pengajuan akan ditolak dan tidak ada stok yang bertambah."
											: "Isi jumlah fisik yang benar-benar diterima dan kondisi hasil pemeriksaan untuk setiap barang. Isi 0 jika barang tersebut tidak diterima."}
									</p>
								</div>
								<label className="block space-y-2 text-sm text-slate-700">
									<span>Catatan Verifikasi Gudang</span>
									<textarea
										className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
										value={verificationNote}
										onChange={(event) => setVerificationNote(event.target.value)}
									/>
								</label>
							</>
						) : null}
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setActiveRequest(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							>
								Batal
							</button>
							{activeRequest.status === "PENDING" ? (
								<button
									type="button"
									onClick={() => void applyDecision()}
									disabled={saving}
									className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
								>
									{saving ? "Menyimpan..." : "Simpan Keputusan"}
								</button>
							) : null}
						</div>
					</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
