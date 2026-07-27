"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDateTime } from "@/lib/datetime";
import {
	isReturnEligibleWithin24Hours,
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
	const [page, setPage] = useState(1);
	const [activeRequest, setActiveRequest] =
		useState<StoreReturnRequestItem | null>(null);
	const [verificationNote, setVerificationNote] = useState("");
	const [decision, setDecision] = useState<GudangDecision>("APPROVED_GOOD");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const records = await storeReturnsService.listAll({
				sortBy: "submittedAt",
				sortOrder: "desc",
			});
			setRequests(records);
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
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const summary = useMemo(
		() => ({
			total: requests.length,
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

	const filteredRequests = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) {
			return requests;
		}

		return requests.filter((request) => {
			const itemText = request.items
				.map((item) => `${item.productNameSnapshot} ${item.quantity}`)
				.join(" ");
			return [
				request.requestNumber,
				request.store?.name,
				request.storeId,
				request.invoice?.invoiceNumber,
				request.invoiceId,
				request.reason,
				request.note,
				request.reviewNote,
				request.status,
				getRequestedConditionSummary(request),
				itemText,
			]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query));
		});
	}, [requests, search]);

	const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const paginatedRequests = useMemo(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return filteredRequests.slice(start, start + PAGE_SIZE);
	}, [currentPage, filteredRequests]);

	const defaultDecisionForRequest = (
		request: StoreReturnRequestItem,
	): GudangDecision => {
		if (request.items.every((item) => item.requestedCondition === "DAMAGED")) {
			return "APPROVED_DAMAGED";
		}
		return "APPROVED_GOOD";
	};

	const openDetail = (request: StoreReturnRequestItem) => {
		setActiveRequest(request);
		setDecision(defaultDecisionForRequest(request));
		setVerificationNote(request.reviewNote || "");
	};

	const applyDecision = async () => {
		if (!activeRequest) {
			return;
		}

		setSaving(true);
		setError("");
		setSuccess("");
		try {
			await storeReturnsService.review(activeRequest.id, {
				decision,
				reviewNote: verificationNote.trim() || undefined,
			});

			setSuccess("Verifikasi retur berhasil diproses.");
			setActiveRequest(null);
			setVerificationNote("");
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
					{ label: "Total Request", value: summary.total },
					{ label: "Menunggu", value: summary.pending },
					{ label: "Disetujui", value: summary.approved },
					{ label: "Ditolak", value: summary.rejected },
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
							Menampilkan {filteredRequests.length} dari {requests.length} pengajuan.
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
						) : filteredRequests.length === 0 ? (
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
											{isReturnEligibleWithin24Hours(
												request.invoice?.deliveryOrder?.receivedAt ||
													request.invoice?.deliveryOrder?.shipments?.[0]
														?.shippedAt,
											)
												? "Masih dalam 24 jam"
												: "Di luar jendela 24 jam"}
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
				<div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
					<p>
						Halaman {currentPage} dari {totalPages}
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setPage((value) => Math.max(1, value - 1))}
							disabled={currentPage <= 1}
							className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<button
							type="button"
							onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
							disabled={currentPage >= totalPages}
							className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
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
										<th className="px-3 py-2 text-right">Qty</th>
										<th className="px-3 py-2 text-right">Subtotal</th>
										<th className="px-3 py-2">Klasifikasi Toko</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{activeRequest.items.map((item) => (
										<tr key={item.id}>
											<td className="px-3 py-2 text-slate-700">
												{item.productNameSnapshot}
											</td>
											<td className="px-3 py-2 text-right text-slate-900">
												{item.quantity}
											</td>
											<td className="px-3 py-2 text-right text-slate-900">
												{formatRupiah(item.subtotal)}
											</td>
											<td className="px-3 py-2 text-slate-700">
												{requestedConditionLabel[item.requestedCondition]}
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
									<p className="mb-3 font-semibold text-slate-900">Keputusan Gudang</p>
									<div className="flex flex-wrap gap-2">
										{[
											{ value: "APPROVED_GOOD", label: "Masuk Stok Bagus" },
											{ value: "APPROVED_DAMAGED", label: "Masuk Barang Rusak" },
											{ value: "REJECTED", label: "Tolak Retur" },
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
										{decision === "APPROVED_GOOD"
											? "Barang akan kembali ke inventaris gudang sebagai stok bagus."
											: decision === "APPROVED_DAMAGED"
												? "Barang akan dicatat ke alur barang rusak setelah retur disetujui."
												: "Gunakan jika hasil pemeriksaan gudang menyatakan retur tidak valid."}
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
