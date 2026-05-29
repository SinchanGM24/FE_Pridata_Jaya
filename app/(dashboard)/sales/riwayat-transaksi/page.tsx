"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Modal from "@/components/shared/Modal";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { invoiceStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { filesService } from "@/services/files";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";
import { paymentsService, type PaymentMethod } from "@/services/payments";

interface ErrorWithMessage {
	response?: {
		data?: {
			message?: string;
		};
	};
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

const invoiceStatusColors: Record<string, string> = {
	UNPAID: "bg-amber-100 text-amber-800",
	PARTIAL: "bg-blue-100 text-blue-800",
	PAID: "bg-emerald-100 text-emerald-800",
	CANCELLED: "bg-slate-100 text-slate-600",
};

const getErrorMessage = (error: unknown, fallback: string) =>
	(error as ErrorWithMessage)?.response?.data?.message || fallback;

const PAGE_SIZE = 10;

type PaymentForm = {
	amount: number;
	method: PaymentMethod;
	referenceNo: string;
	proofNotes: string;
	notes: string;
};

function SalesTransactionHistoryContent() {
	const searchParams = useSearchParams();
	const storeId = searchParams.get("storeId") ?? undefined;
	const [orders, setOrders] = useState<OrderListItem[]>([]);
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [filterStatus, setFilterStatus] = useState("");
	const [page, setPage] = useState(1);
	const [selectedInvoice, setSelectedInvoice] = useState<InvoiceListItem | null>(null);
	const [paymentInvoice, setPaymentInvoice] = useState<InvoiceListItem | null>(null);
	const [paymentForm, setPaymentForm] = useState<PaymentForm>({
		amount: 0,
		method: "CASH",
		referenceNo: "",
		proofNotes: "",
		notes: "",
	});
	const [proofFile, setProofFile] = useState<File | null>(null);
	const [submittingPayment, setSubmittingPayment] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		setSuccess("");
		try {
			const [invoiceResult, orderResult] = await Promise.all([
				invoicesService.listForSales({
					page: 1,
					limit: 100,
					storeId,
					sortBy: "invoiceDate",
					sortOrder: "desc",
				}),
				ordersService.listForSales({
					page: 1,
					limit: 100,
					storeId,
					sortBy: "documentDate",
					sortOrder: "desc",
				}),
			]);
			setInvoices(invoiceResult.items);
			setOrders(orderResult.items);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Gagal memuat riwayat invoice."));
		} finally {
			setLoading(false);
		}
	}, [storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setOrders([]);
			setInvoices([]);
			setFilterStatus("");
			setPage(1);
			setSelectedInvoice(null);
			setPaymentInvoice(null);
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load, storeId]);

	const ordersById = useMemo(
		() => Object.fromEntries(orders.map((order) => [order.id, order])),
		[orders],
	);

	const filteredInvoices = useMemo(() => {
		let rows = invoices;
		if (filterStatus) rows = rows.filter((i) => i.status === filterStatus);
		if (search) {
			const q = search.toLowerCase();
			rows = rows.filter(
				(i) =>
					i.invoiceNumber.toLowerCase().includes(q) ||
					i.storeNameSnapshot.toLowerCase().includes(q),
			);
		}
		return rows;
	}, [invoices, search, filterStatus]);
	const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const paginatedInvoices = useMemo(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return filteredInvoices.slice(start, start + PAGE_SIZE);
	}, [currentPage, filteredInvoices]);

	const selectedOrder = selectedInvoice ? ordersById[selectedInvoice.orderId] : null;

	const handleRefresh = async () => {
		await load();
	};

	const openPaymentModal = (invoice: InvoiceListItem) => {
		setPaymentInvoice(invoice);
		setPaymentForm({
			amount: invoice.remainingAmount,
			method: "CASH",
			referenceNo: "",
			proofNotes: "",
			notes: "",
		});
		setProofFile(null);
		setError("");
		setSuccess("");
	};

	const handleSubmitPayment = async () => {
		if (!paymentInvoice) return;
		if (paymentForm.amount <= 0 || paymentForm.amount > paymentInvoice.remainingAmount) {
			setError("Nominal pembayaran harus lebih dari 0 dan tidak melebihi sisa tagihan.");
			return;
		}
		if (paymentForm.method === "TRANSFER" && !paymentForm.referenceNo.trim()) {
			setError("Nomor referensi transfer wajib diisi.");
			return;
		}
		if (paymentForm.method === "CASH" && !proofFile) {
			setError("Bukti fisik pembayaran tunai wajib diunggah ketika diwakilkan oleh sales.");
			return;
		}

		setSubmittingPayment(true);
		setError("");
		setSuccess("");
		try {
			const proof =
				paymentForm.method === "CASH" && proofFile
					? await filesService.uploadPaymentProof(proofFile)
					: null;
			await paymentsService.createForSales({
				invoiceId: paymentInvoice.id,
				amount: paymentForm.amount,
				method: paymentForm.method,
				referenceNo: paymentForm.method === "TRANSFER" ? paymentForm.referenceNo.trim() : undefined,
				proofUrl: proof?.url,
				proofFileName: proofFile?.name,
				proofMimeType: proof?.contentType,
				proofNotes: paymentForm.proofNotes || undefined,
				notes: paymentForm.notes || undefined,
			});
			setSuccess(`Pembayaran ${paymentInvoice.invoiceNumber} berhasil diajukan ke akuntan.`);
			setPaymentInvoice(null);
			setSelectedInvoice(null);
			await load();
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Gagal mencatat pembayaran toko."));
		} finally {
			setSubmittingPayment(false);
		}
	};

	return (
		<SalesPortalShell title="Riwayat Transaksi Sales">
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
						Halaman Utama
					</p>
					<p className="mt-1 text-lg font-semibold text-slate-900">
						Invoice ({invoices.length})
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<input
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm w-56"
						placeholder="Cari nomor / toko..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
					/>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={filterStatus}
						onChange={(e) => {
							setFilterStatus(e.target.value);
							setPage(1);
						}}
					>
						<option value="">Semua Status</option>
						<option value="UNPAID">Belum Lunas</option>
						<option value="PARTIAL">Bayar Sebagian</option>
						<option value="PAID">Lunas</option>
						<option value="CANCELLED">Dibatalkan</option>
					</select>
					<button
						type="button"
						onClick={() => void handleRefresh()}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Muat Ulang
					</button>
				</div>
			</div>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
						<p>
							Menampilkan {paginatedInvoices.length} invoice dari {filteredInvoices.length} hasil filter.
						</p>
						<p>
							Halaman {currentPage} / {totalPages}
						</p>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Nomor Invoice</th>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Tgl Invoice</th>
								<th className="px-4 py-3">Jatuh Tempo</th>
								<th className="px-4 py-3 text-right">Total</th>
								<th className="px-4 py-3 text-right">Sisa</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td colSpan={8} className="px-4 py-4 text-slate-600">
										Memuat...
									</td>
								</tr>
							) : filteredInvoices.length === 0 ? (
								<tr>
									<td colSpan={8} className="px-4 py-4 text-slate-600">
										Tidak ada invoice.
									</td>
								</tr>
							) : (
								paginatedInvoices.map((inv) => (
									<tr key={inv.id}>
										<td className="px-4 py-3 font-medium text-slate-900">
											{inv.invoiceNumber}
										</td>
										<td className="px-4 py-3 text-slate-700">
											{inv.storeNameSnapshot}
										</td>
										<td className="px-4 py-3 text-slate-700">
											{dateOnly(inv.invoiceDate)}
										</td>
										<td className="px-4 py-3 text-slate-700">
											{dateOnly(inv.dueDate)}
										</td>
										<td className="px-4 py-3 text-right text-slate-900">
											{formatRupiah(inv.totalAmount)}
										</td>
										<td className="px-4 py-3 text-right font-medium text-slate-900">
											{formatRupiah(inv.remainingAmount)}
										</td>
										<td className="px-4 py-3">
											<span
												className={`rounded-full px-2 py-1 text-xs font-medium ${
													invoiceStatusColors[inv.status] ??
													"bg-slate-100 text-slate-700"
												}`}
											>
												{toUiLabel(inv.status, invoiceStatusLabel)}
											</span>
										</td>
										<td className="px-4 py-3 text-right">
											<button
												type="button"
												onClick={() => setSelectedInvoice(inv)}
												className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
											>
												Detail
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
					<div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
						<button
							type="button"
							onClick={() => setPage((current) => Math.max(1, current - 1))}
							disabled={loading || currentPage <= 1}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<button
							type="button"
							onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
							disabled={loading || currentPage >= totalPages}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</section>

			<Modal
				isOpen={Boolean(selectedInvoice)}
				onClose={() => setSelectedInvoice(null)}
				title={selectedInvoice ? `Detail Invoice ${selectedInvoice.invoiceNumber}` : "Detail Invoice"}
			>
				{selectedInvoice ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Invoice</p>
								<p className="font-semibold text-slate-900">{selectedInvoice.invoiceNumber}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Toko</p>
								<p className="font-semibold text-slate-900">{selectedInvoice.storeNameSnapshot}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Order</p>
								<p className="font-semibold text-slate-900">
									{selectedOrder?.orderNumber ?? selectedInvoice.order?.orderNumber ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status</p>
								<p className="font-semibold text-slate-900">
									{toUiLabel(selectedInvoice.status, invoiceStatusLabel)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Total</p>
								<p className="font-semibold text-slate-900">{formatRupiah(selectedInvoice.totalAmount)}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Sisa</p>
								<p className="font-semibold text-slate-900">{formatRupiah(selectedInvoice.remainingAmount)}</p>
							</div>
						</div>

						<div className="overflow-hidden rounded-lg border border-slate-200">
							<div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
								<h3 className="font-semibold text-slate-900">Item yang Dipesan</h3>
							</div>
							<table className="min-w-full divide-y divide-slate-200">
								<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-4 py-3">Barang</th>
										<th className="px-4 py-3 text-right">Qty</th>
										<th className="px-4 py-3 text-right">Harga</th>
										<th className="px-4 py-3 text-right">Subtotal</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{(selectedOrder?.items ?? []).length === 0 ? (
										<tr>
											<td className="px-4 py-4 text-slate-600" colSpan={4}>
												Detail item order belum tersedia dari data sales.
											</td>
										</tr>
									) : (
										selectedOrder?.items?.map((item) => (
											<tr key={item.id}>
												<td className="px-4 py-3">
													<div className="font-medium text-slate-900">
														{item.product?.name ?? item.productId}
													</div>
													<div className="text-xs text-slate-500">{item.product?.sku ?? "-"}</div>
												</td>
												<td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
												<td className="px-4 py-3 text-right text-slate-700">
													{formatRupiah(item.unitPriceSnapshot)}
												</td>
												<td className="px-4 py-3 text-right font-semibold text-slate-900">
													{formatRupiah(item.subtotal)}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setSelectedInvoice(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								Tutup
							</button>
							{selectedInvoice.remainingAmount > 0 && selectedInvoice.status !== "CANCELLED" ? (
								<button
									type="button"
									onClick={() => openPaymentModal(selectedInvoice)}
									className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
								>
									Input Pembayaran
								</button>
							) : null}
						</div>
					</div>
				) : null}
			</Modal>

			<Modal
				isOpen={Boolean(paymentInvoice)}
				onClose={() => setPaymentInvoice(null)}
				title="Input Pembayaran"
			>
				{paymentInvoice ? (
					<div className="space-y-5 text-sm text-slate-700">
						<div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800">
							Pembayaran akan dicatat untuk invoice {paymentInvoice.invoiceNumber} dan diteruskan ke akuntan.
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sisa Tagihan</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">{formatRupiah(paymentInvoice.remainingAmount)}</p>
							</div>
							<label className="space-y-1.5">
								<span className="font-medium text-slate-700">Dibayarkan</span>
								<input
									type="number"
									min={1}
									max={paymentInvoice.remainingAmount}
									value={paymentForm.amount}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, amount: Number(event.target.value) }))
									}
									disabled={submittingPayment}
									className="w-full rounded-xl border border-slate-300 px-3 py-2"
								/>
							</label>
							<label className="space-y-1.5">
								<span className="font-medium text-slate-700">Metode</span>
								<select
									value={paymentForm.method}
									onChange={(event) => {
										const method = event.target.value as PaymentMethod;
										setPaymentForm((current) => ({
											...current,
											method,
											referenceNo: method === "CASH" ? "" : current.referenceNo,
										}));
										if (method === "TRANSFER") setProofFile(null);
									}}
									disabled={submittingPayment}
									className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
								>
									<option value="CASH">Tunai diwakilkan sales</option>
									<option value="TRANSFER">Transfer</option>
								</select>
							</label>
							<label className="space-y-1.5">
								<span className="font-medium text-slate-700">Nomor Referensi Transfer</span>
								<input
									value={paymentForm.referenceNo}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, referenceNo: event.target.value }))
									}
									disabled={submittingPayment || paymentForm.method === "CASH"}
									placeholder={paymentForm.method === "TRANSFER" ? "Wajib untuk transfer" : "Tidak diperlukan untuk tunai"}
									className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
								/>
							</label>
							<label className="space-y-1.5">
								<span className="font-medium text-slate-700">Bukti Fisik Tunai</span>
								<input
									type="file"
									accept="image/*,application/pdf"
									onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
									disabled={submittingPayment || paymentForm.method === "TRANSFER"}
									className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-50 disabled:opacity-60"
								/>
							</label>
							<label className="space-y-1.5 md:col-span-2">
								<span className="font-medium text-slate-700">Keterangan Bukti</span>
								<input
									value={paymentForm.proofNotes}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, proofNotes: event.target.value }))
									}
									disabled={submittingPayment || paymentForm.method === "TRANSFER"}
									placeholder="Contoh: kuitansi tanda tangan dan stempel toko"
									className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
								/>
							</label>
							<label className="space-y-1.5 md:col-span-2">
								<span className="font-medium text-slate-700">Catatan</span>
								<input
									value={paymentForm.notes}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, notes: event.target.value }))
									}
									disabled={submittingPayment}
									placeholder="Opsional"
									className="w-full rounded-xl border border-slate-300 px-3 py-2"
								/>
							</label>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setPaymentInvoice(null)}
								disabled={submittingPayment}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => void handleSubmitPayment()}
								disabled={submittingPayment}
								className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
							>
								{submittingPayment ? "Menyimpan..." : "Simpan Pembayaran"}
							</button>
						</div>
					</div>
				) : null}
			</Modal>
		</SalesPortalShell>
	);
}

export default function SalesTransactionHistoryPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
					Memuat riwayat transaksi sales...
				</div>
			}
		>
			<SalesTransactionHistoryContent />
		</Suspense>
	);
}
