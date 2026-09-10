"use client";

export const dynamic = "force-dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import { invoiceStatusLabel, statusTone, toUiLabel } from "@/lib/ui-labels";
import { filesService } from "@/services/files";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";
import { paymentsService, type PaymentMethod } from "@/services/payments";
import { fieldClasses } from "@/components/shared/FormInput";

const dateOnly = (v?: string | null) => (v ? formatAppDate(v) : "-");

const getErrorMessage = (error: unknown, fallback: string) => getApiErrorMessage(error, fallback);

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

	const invoiceColumns: ResponsiveColumn<InvoiceListItem>[] = [
		{ key: "invoiceNumber", head: "Nomor Invoice", role: "title" },
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (inv) => (
				<Badge tone={statusTone(inv.status)}>{toUiLabel(inv.status, invoiceStatusLabel)}</Badge>
			),
		},
		{
			key: "remainingAmount",
			head: "Sisa",
			role: "amount",
			align: "right",
			render: (inv) => formatRupiah(inv.remainingAmount),
		},
		{ key: "storeNameSnapshot", head: "Toko" },
		{ key: "invoiceDate", head: "Tgl Invoice", render: (inv) => dateOnly(inv.invoiceDate) },
		{
			key: "totalAmount",
			head: "Total",
			align: "right",
			render: (inv) => formatRupiah(inv.totalAmount),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (inv) => (
				<Button variant="secondary" size="sm" onClick={() => setSelectedInvoice(inv)}>
					Detail
				</Button>
			),
		},
	];

	const orderItemColumns: ResponsiveColumn<NonNullable<OrderListItem["items"]>[number]>[] = [
		{
			key: "product",
			head: "Barang",
			role: "title",
			render: (item) => (
				<span className="block">
					<span className="block font-medium text-slate-900">
						{item.product?.name ?? "Produk"}
					</span>
					<span className="block text-xs text-slate-500">{item.product?.sku ?? "-"}</span>
				</span>
			),
		},
		{
			key: "subtotal",
			head: "Subtotal",
			role: "amount",
			align: "right",
			render: (item) => formatRupiah(item.subtotal),
		},
		{ key: "quantity", head: "Qty", align: "right" },
		{
			key: "unitPriceSnapshot",
			head: "Harga",
			align: "right",
			render: (item) => formatRupiah(item.unitPriceSnapshot),
		},
	];

	return (
		<SalesPortalShell title="Riwayat Transaksi Sales">
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>

			{/*
			 * Eyebrow "Halaman Utama" di atas hitungan invoice dihapus: ia tidak
			 * menamai apa pun, dan hitungannya sudah dilaporkan PaginationControls
			 * di bawah tabel. Judul dan kedua kontrol saring sekarang satu kartu.
			 */}
			<Card>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<h2 className="type-title text-slate-900">Riwayat Invoice</h2>
					<div className="flex flex-wrap gap-2">
						<input
							type="search"
							className={fieldClasses("control", "md:w-56")}
							placeholder="Cari nomor / toko..."
							aria-label="Cari nomor invoice atau nama toko"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(1);
							}}
						/>
						<select
							className={fieldClasses("control", "md:w-48")}
							aria-label="Saring status invoice"
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
					</div>
				</div>
			</Card>

			<section className="space-y-3">
				<ResponsiveTable
					columns={invoiceColumns}
					data={paginatedInvoices}
					getRowKey={(inv) => inv.id}
					loading={loading}
					onRowClick={(inv) => setSelectedInvoice(inv)}
					emptyText="Tidak ada invoice"
					emptyDescription="Coba ubah kata kunci pencarian atau filter status."
				/>
				<PaginationControls
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={filteredInvoices.length}
					currentItemCount={paginatedInvoices.length}
					pageSize={PAGE_SIZE}
					itemLabel="invoice"
					loading={loading}
					onPageChange={setPage}
				/>
			</section>

			<Modal
				isOpen={Boolean(selectedInvoice)}
				onClose={() => setSelectedInvoice(null)}
				title={selectedInvoice ? `Detail Invoice ${selectedInvoice.invoiceNumber}` : "Detail Invoice"}
			>
				{selectedInvoice ? (
					<div className="space-y-4 text-sm text-slate-700">
						<dl className="grid gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
							<div className="min-w-0">
								<dt className="type-label text-slate-500">Invoice</dt>
								<dd className="type-body mt-1 font-medium text-slate-900">
									{selectedInvoice.invoiceNumber}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="type-label text-slate-500">Toko</dt>
								<dd className="type-body mt-1 break-words font-medium text-slate-900">
									{selectedInvoice.storeNameSnapshot}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="type-label text-slate-500">Order</dt>
								<dd className="type-body mt-1 font-medium text-slate-900">
									{selectedOrder?.orderNumber ?? selectedInvoice.order?.orderNumber ?? "-"}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="type-label text-slate-500">Status</dt>
								<dd className="mt-1">
									<Badge tone={statusTone(selectedInvoice.status)}>
										{toUiLabel(selectedInvoice.status, invoiceStatusLabel)}
									</Badge>
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="type-label text-slate-500">Total</dt>
								<dd className="type-body mt-1 font-medium text-slate-900">
									{formatRupiah(selectedInvoice.totalAmount)}
								</dd>
							</div>
							{/* Sisa tagihan yang menentukan apakah tombol bayar muncul. */}
							<div className="min-w-0">
								<dt className="type-label text-slate-500">Sisa</dt>
								<dd className="type-display mt-1 text-slate-900">
									{formatRupiah(selectedInvoice.remainingAmount)}
								</dd>
							</div>
						</dl>

						<div className="space-y-2">
							<h3 className="type-title text-slate-900">Item yang Dipesan</h3>
							<ResponsiveTable
								columns={orderItemColumns}
								data={selectedOrder?.items ?? []}
								getRowKey={(item) => item.id}
								emptyText="Detail item belum tersedia"
								emptyDescription="Data item order tidak dikirim untuk sesi sales."
							/>
						</div>
						<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<Button variant="secondary" onClick={() => setSelectedInvoice(null)}>
								Tutup
							</Button>
							{selectedInvoice.remainingAmount > 0 && selectedInvoice.status !== "CANCELLED" ? (
								<Button variant="commerce" onClick={() => openPaymentModal(selectedInvoice)}>
									Input Pembayaran
								</Button>
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
						<div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-800">
							Pembayaran akan dicatat untuk invoice {paymentInvoice.invoiceNumber} dan diteruskan ke akuntan.
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							{/* Batas atas nominal yang boleh diisi — angka penentu di modal ini. */}
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<p className="type-label text-slate-500">Sisa Tagihan</p>
								<p className="type-display mt-1.5 text-slate-900">
									{formatRupiah(paymentInvoice.remainingAmount)}
								</p>
							</div>
							<label className="space-y-2">
								<span className="block text-sm font-medium text-slate-700">Dibayarkan</span>
								<input
									type="number"
									min={1}
									max={paymentInvoice.remainingAmount}
									value={paymentForm.amount}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, amount: Number(event.target.value) }))
									}
									disabled={submittingPayment}
									className={fieldClasses("control")}
								/>
							</label>
							<label className="space-y-2">
								<span className="block text-sm font-medium text-slate-700">Metode</span>
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
									className={fieldClasses("control")}
								>
									<option value="CASH">Tunai diwakilkan sales</option>
									<option value="TRANSFER">Transfer</option>
								</select>
							</label>
							<label className="space-y-2">
								<span className="block text-sm font-medium text-slate-700">Nomor Referensi Transfer</span>
								<input
									value={paymentForm.referenceNo}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, referenceNo: event.target.value }))
									}
									disabled={submittingPayment || paymentForm.method === "CASH"}
									placeholder={paymentForm.method === "TRANSFER" ? "Wajib untuk transfer" : "Tidak diperlukan untuk tunai"}
									className={fieldClasses("control")}
								/>
							</label>
							<label className="space-y-2">
								<span className="block text-sm font-medium text-slate-700">Bukti Fisik Tunai</span>
								<input
									type="file"
									accept="image/*,application/pdf"
									onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
									disabled={submittingPayment || paymentForm.method === "TRANSFER"}
									className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-50 disabled:opacity-60"
								/>
							</label>
							<label className="space-y-2 md:col-span-2">
								<span className="block text-sm font-medium text-slate-700">Keterangan Bukti</span>
								<input
									value={paymentForm.proofNotes}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, proofNotes: event.target.value }))
									}
									disabled={submittingPayment || paymentForm.method === "TRANSFER"}
									placeholder="Contoh: kuitansi tanda tangan dan stempel toko"
									className={fieldClasses("control")}
								/>
							</label>
							<label className="space-y-2 md:col-span-2">
								<span className="block text-sm font-medium text-slate-700">Catatan</span>
								<input
									value={paymentForm.notes}
									onChange={(event) =>
										setPaymentForm((current) => ({ ...current, notes: event.target.value }))
									}
									disabled={submittingPayment}
									placeholder="Opsional"
									className={fieldClasses("control")}
								/>
							</label>
						</div>
						<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<Button
								variant="secondary"
								onClick={() => setPaymentInvoice(null)}
								disabled={submittingPayment}
							>
								Batal
							</Button>
							<Button
								variant="commerce"
								onClick={() => void handleSubmitPayment()}
								disabled={submittingPayment}
							>
								{submittingPayment ? "Menyimpan..." : "Simpan Pembayaran"}
							</Button>
						</div>
					</div>
				) : null}
			</Modal>
		</SalesPortalShell>
	);
}

function SalesTransactionHistoryPageContent() {
	return (
		<Suspense
			fallback={
				<div className="type-body flex min-h-[40dvh] items-center justify-center text-slate-600">
					Memuat riwayat transaksi sales...
				</div>
			}
		>
			<SalesTransactionHistoryContent />
		</Suspense>
	);
}

export default function SalesTransactionHistoryPage() {
	return (
		<Suspense fallback={null}>
			<SalesTransactionHistoryPageContent />
		</Suspense>
	);
}
