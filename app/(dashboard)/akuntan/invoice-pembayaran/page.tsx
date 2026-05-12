"use client";

import { useEffect, useMemo, useState } from "react";
import CancelReasonModal from "@/components/fakturis/CancelReasonModal";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { invoiceDraftsService, type InvoiceDraftListItem } from "@/services/invoice-drafts";
import { invoicesService, type InvoiceListItem, type InvoiceStatus } from "@/services/invoices";
import {
	paymentsService,
	type Payment,
	type PaymentMethod,
	type PaymentStatus,
} from "@/services/payments";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

type PaymentDeskItem =
	| {
			id: string;
			number: string;
			customer: string;
			date: string;
			dueDate?: string | null;
			status: string;
			kind: "draft";
			totalAmount: number;
			outstandingAmount: number;
			raw: InvoiceDraftListItem;
	  }
	| {
			id: string;
			number: string;
			customer: string;
			date: string;
			dueDate?: string | null;
			status: InvoiceStatus;
			kind: "invoice";
			totalAmount: number;
			outstandingAmount: number;
			raw: InvoiceListItem;
	  };

type FilterMode = "all" | "draft" | "unpaid" | "partial" | "paid" | "cancelled";
type PaymentFilterMode = "ALL" | PaymentStatus;
type PaymentMethodFilter = "ALL" | PaymentMethod;

type DocumentFilters = {
	search: string;
	filterMode: FilterMode;
	dateFrom: string;
	dateTo: string;
};

type PaymentFilters = {
	search: string;
	status: PaymentFilterMode;
	method: PaymentMethodFilter;
	dateFrom: string;
	dateTo: string;
};

const defaultDocumentFilters: DocumentFilters = {
	search: "",
	filterMode: "all",
	dateFrom: "",
	dateTo: "",
};

const defaultPaymentFilters: PaymentFilters = {
	search: "",
	status: "PENDING",
	method: "ALL",
	dateFrom: "",
	dateTo: "",
};

const PAGE_LIMIT = 100;
const TABLE_PAGE_SIZE = 20;

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: unknown }).response === "object" &&
		(error as { response?: { data?: unknown } }).response?.data &&
		typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message ===
			"string"
	) {
		return (error as { response?: { data?: { message: string } } }).response?.data?.message ?? fallback;
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return fallback;
};

async function collectPaginated<T>(
	fetchPage: (page: number, limit: number) => Promise<{ items: T[]; meta?: { totalPages?: number } }>,
): Promise<T[]> {
	const firstPage = await fetchPage(1, PAGE_LIMIT);
	const totalPages = firstPage.meta?.totalPages ?? 1;

	if (totalPages <= 1) {
		return firstPage.items;
	}

	const remainingPages = await Promise.all(
		Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2, PAGE_LIMIT)),
	);

	return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export default function InvoicePembayaranPage() {
	const [rows, setRows] = useState<PaymentDeskItem[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [loadingDocuments, setLoadingDocuments] = useState(true);
	const [loadingPayments, setLoadingPayments] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [documentFilters, setDocumentFilters] = useState<DocumentFilters>(defaultDocumentFilters);
	const [paymentFilters, setPaymentFilters] = useState<PaymentFilters>(defaultPaymentFilters);
	const [documentPage, setDocumentPage] = useState(1);
	const [paymentPage, setPaymentPage] = useState(1);
	const [selectedDocument, setSelectedDocument] = useState<PaymentDeskItem | null>(null);
	const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
	const [paymentActionId, setPaymentActionId] = useState<string | null>(null);
	const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const loadDocuments = async (filters: DocumentFilters) => {
		setLoadingDocuments(true);
		setError("");
		try {
			const draftStatus =
				filters.filterMode === "draft"
					? "DRAFT"
					: filters.filterMode === "cancelled"
						? "CANCELLED"
						: undefined;
			const invoiceStatus =
				filters.filterMode === "unpaid"
					? "UNPAID"
					: filters.filterMode === "partial"
						? "PARTIAL"
						: filters.filterMode === "paid"
							? "PAID"
							: filters.filterMode === "cancelled"
								? "CANCELLED"
								: undefined;

			const [drafts, invoices] = await Promise.all([
				collectPaginated((page, limit) =>
					invoiceDraftsService.list({
						page,
						limit,
						search: filters.search || undefined,
						status: draftStatus,
						dateFrom: filters.dateFrom || undefined,
						dateTo: filters.dateTo || undefined,
						sortBy: "draftDate",
						sortOrder: "desc",
					}),
				),
				collectPaginated((page, limit) =>
					invoicesService.list({
						page,
						limit,
						search: filters.search || undefined,
						status: invoiceStatus,
						dateFrom: filters.dateFrom || undefined,
						dateTo: filters.dateTo || undefined,
						sortBy: "invoiceDate",
						sortOrder: "desc",
					}),
				),
			]);

			const mappedRows: PaymentDeskItem[] = [
				...drafts.map((draft) => ({
					id: draft.id,
					number: draft.draftNumber,
					customer: draft.storeNameSnapshot,
					date: draft.draftDate,
					dueDate: draft.dueDate ?? null,
					status: draft.status,
					kind: "draft" as const,
					totalAmount: draft.totalAmount,
					outstandingAmount: draft.totalAmount,
					raw: draft,
				})),
				...invoices.map((invoice) => ({
					id: invoice.id,
					number: invoice.invoiceNumber,
					customer: invoice.storeNameSnapshot,
					date: invoice.invoiceDate,
					dueDate: invoice.dueDate ?? null,
					status: invoice.status,
					kind: "invoice" as const,
					totalAmount: invoice.totalAmount,
					outstandingAmount: invoice.remainingAmount,
					raw: invoice,
				})),
			]
				.filter((item) => {
					if (filters.filterMode === "all") return true;
					if (filters.filterMode === "draft") return item.kind === "draft";
					if (filters.filterMode === "cancelled") return item.status === "CANCELLED";
					return item.kind === "invoice";
				})
				.sort((a, b) => (a.date < b.date ? 1 : -1));

			setRows(mappedRows);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat desk invoice."));
		} finally {
			setLoadingDocuments(false);
		}
	};

	const loadPayments = async (filters: PaymentFilters) => {
		setLoadingPayments(true);
		setError("");
		try {
			const paymentItems = await collectPaginated((page, limit) =>
				paymentsService.list({
					page,
					limit,
					sortBy: "paymentDate",
					sortOrder: "desc",
					status: filters.status === "ALL" ? undefined : filters.status,
					method: filters.method === "ALL" ? undefined : filters.method,
					search: filters.search || undefined,
					dateFrom: filters.dateFrom || undefined,
					dateTo: filters.dateTo || undefined,
				}),
			);
			setPayments(paymentItems);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat pembayaran."));
		} finally {
			setLoadingPayments(false);
		}
	};

	const loadAll = async (nextDocumentFilters = documentFilters, nextPaymentFilters = paymentFilters) => {
		await Promise.all([loadDocuments(nextDocumentFilters), loadPayments(nextPaymentFilters)]);
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadAll(defaultDocumentFilters, defaultPaymentFilters);
		}, 0);

		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const documentSummary = useMemo(
		() => ({
			total: rows.length,
			drafts: rows.filter((row) => row.kind === "draft").length,
			invoices: rows.filter((row) => row.kind === "invoice").length,
			outstandingAmount: rows.reduce((sum, row) => sum + row.outstandingAmount, 0),
		}),
		[rows],
	);

	const paymentSummary = useMemo(
		() => ({
			total: payments.length,
			pending: payments.filter((payment) => payment.status === "PENDING").length,
			verified: payments.filter((payment) => payment.status === "VERIFIED").length,
			cancelled: payments.filter((payment) => payment.status === "CANCELLED").length,
		}),
		[payments],
	);

	const documentTotalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
	const currentDocumentPage = Math.min(documentPage, documentTotalPages);
	const paginatedDocumentRows = useMemo(() => {
		const start = (currentDocumentPage - 1) * TABLE_PAGE_SIZE;
		return rows.slice(start, start + TABLE_PAGE_SIZE);
	}, [currentDocumentPage, rows]);

	const paymentTotalPages = Math.max(1, Math.ceil(payments.length / TABLE_PAGE_SIZE));
	const currentPaymentPage = Math.min(paymentPage, paymentTotalPages);
	const paginatedPayments = useMemo(() => {
		const start = (currentPaymentPage - 1) * TABLE_PAGE_SIZE;
		return payments.slice(start, start + TABLE_PAGE_SIZE);
	}, [currentPaymentPage, payments]);

	const handleVerifyPayment = async (payment: Payment) => {
		setPaymentActionId(payment.id);
		setError("");
		setSuccess("");
		try {
			await paymentsService.verify(payment.id);
			setSuccess(`Pembayaran ${payment.paymentNumber ?? payment.id} berhasil diverifikasi.`);
			await loadPayments(paymentFilters);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memverifikasi pembayaran."));
		} finally {
			setPaymentActionId(null);
		}
	};

	const openCancelPayment = (payment: Payment) => {
		setCancelTarget(payment);
		setCancelReason("");
	};

	const handleCancelPayment = async () => {
		if (!cancelTarget || !cancelReason.trim()) return;
		setPaymentActionId(cancelTarget.id);
		setError("");
		setSuccess("");
		try {
			await paymentsService.cancel(cancelTarget.id, cancelReason.trim());
			setSuccess(`Pembayaran ${cancelTarget.paymentNumber ?? cancelTarget.id} berhasil dibatalkan.`);
			setCancelTarget(null);
			setCancelReason("");
			await loadPayments(paymentFilters);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal membatalkan pembayaran."));
		} finally {
			setPaymentActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Invoice Pembayaran"
			description="Meja kontrol akuntan untuk memantau draft, invoice final, dan pembayaran masuk. Filter dokumen dan workflow verifikasi dipisah agar peninjauan lebih rapi."
		>
			<section className="grid gap-4 md:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Total Dokumen</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{documentSummary.total}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Draft</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{documentSummary.drafts}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Invoice Final</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{documentSummary.invoices}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Outstanding Dokumen</p>
					<p className="mt-2 text-2xl font-semibold text-rose-600">
						{formatRupiah(documentSummary.outstandingAmount)}
					</p>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari nomor dokumen atau nama toko"
						value={documentFilters.search}
						onChange={(e) =>
							setDocumentFilters((current) => ({ ...current, search: e.target.value }))
						}
					/>
					<select
						value={documentFilters.filterMode}
						onChange={(e) =>
							setDocumentFilters((current) => ({
								...current,
								filterMode: e.target.value as FilterMode,
							}))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="all">Semua Dokumen</option>
						<option value="draft">Draft</option>
						<option value="unpaid">Unpaid</option>
						<option value="partial">Partial</option>
						<option value="paid">Paid</option>
						<option value="cancelled">Cancelled</option>
					</select>
					<input
						type="date"
						value={documentFilters.dateFrom}
						onChange={(e) =>
							setDocumentFilters((current) => ({ ...current, dateFrom: e.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal dokumen dari"
					/>
					<input
						type="date"
						value={documentFilters.dateTo}
						onChange={(e) =>
							setDocumentFilters((current) => ({ ...current, dateTo: e.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal dokumen sampai"
					/>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<button
							type="button"
							onClick={() => void loadDocuments(documentFilters)}
							disabled={loadingDocuments}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Terapkan
						</button>
						<button
							type="button"
							onClick={() => {
								setDocumentPage(1);
								setDocumentFilters(defaultDocumentFilters);
								void loadDocuments(defaultDocumentFilters);
							}}
							disabled={loadingDocuments}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Reset
						</button>
					</div>
				</div>
			</section>

			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
					<p>
						Menampilkan {paginatedDocumentRows.length} dokumen dari {rows.length} hasil filter.
					</p>
					<p>
						Halaman {currentDocumentPage} / {documentTotalPages}
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Dokumen</th>
							<th className="px-4 py-3">Jenis</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loadingDocuments ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Memuat desk invoice...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Tidak ada dokumen pada filter ini.
								</td>
							</tr>
						) : (
							paginatedDocumentRows.map((item) => (
								<tr key={`${item.kind}-${item.id}`}>
									<td className="px-4 py-3 font-medium text-slate-900">{item.number}</td>
									<td className="px-4 py-3 text-slate-700">
										<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
											{item.kind === "draft" ? "Draft" : "Invoice"}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">{item.customer}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.date)}</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(item.totalAmount)}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(item.outstandingAmount)}
									</td>
									<td className="px-4 py-3 text-slate-700">{item.status}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => setSelectedDocument(item)}
											className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
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
						onClick={() => setDocumentPage((current) => Math.max(1, current - 1))}
						disabled={loadingDocuments || currentDocumentPage <= 1}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Sebelumnya
					</button>
					<button
						type="button"
						onClick={() => setDocumentPage((current) => Math.min(documentTotalPages, current + 1))}
						disabled={loadingDocuments || currentDocumentPage >= documentTotalPages}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Berikutnya
					</button>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-4">
				{[
					["Total Pembayaran", paymentSummary.total],
					["Pending", paymentSummary.pending],
					["Verified", paymentSummary.verified],
					["Cancelled", paymentSummary.cancelled],
				].map(([label, value]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari pembayaran, ref, invoice, toko"
						value={paymentFilters.search}
						onChange={(e) =>
							setPaymentFilters((current) => ({ ...current, search: e.target.value }))
						}
					/>
					<select
						value={paymentFilters.status}
						onChange={(e) =>
							setPaymentFilters((current) => ({
								...current,
								status: e.target.value as PaymentFilterMode,
							}))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Status</option>
						<option value="PENDING">PENDING</option>
						<option value="VERIFIED">VERIFIED</option>
						<option value="CANCELLED">CANCELLED</option>
					</select>
					<select
						value={paymentFilters.method}
						onChange={(e) =>
							setPaymentFilters((current) => ({
								...current,
								method: e.target.value as PaymentMethodFilter,
							}))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Metode</option>
						<option value="CASH">CASH</option>
						<option value="TRANSFER">TRANSFER</option>
						<option value="GIRO">GIRO</option>
						<option value="OTHER">OTHER</option>
					</select>
					<input
						type="date"
						value={paymentFilters.dateFrom}
						onChange={(e) =>
							setPaymentFilters((current) => ({ ...current, dateFrom: e.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal pembayaran dari"
					/>
					<input
						type="date"
						value={paymentFilters.dateTo}
						onChange={(e) =>
							setPaymentFilters((current) => ({ ...current, dateTo: e.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal pembayaran sampai"
					/>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<button
							type="button"
							onClick={() => void loadPayments(paymentFilters)}
							disabled={loadingPayments}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Terapkan
						</button>
						<button
							type="button"
							onClick={() => {
								setPaymentPage(1);
								setPaymentFilters(defaultPaymentFilters);
								void loadPayments(defaultPaymentFilters);
							}}
							disabled={loadingPayments}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Reset
						</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
					<p>
						Menampilkan {paginatedPayments.length} pembayaran dari {payments.length} hasil filter.
					</p>
					<p>
						Halaman {currentPaymentPage} / {paymentTotalPages}
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Pembayaran</th>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Metode</th>
							<th className="px-4 py-3 text-right">Nominal</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loadingPayments ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Memuat pembayaran...
								</td>
							</tr>
						) : payments.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Tidak ada pembayaran pada filter ini.
								</td>
							</tr>
						) : (
							paginatedPayments.map((payment) => {
								const paymentNumber = payment.paymentNumber ?? payment.id;
								const ref = payment.referenceNo ?? payment.referenceNumber;
								const invoiceNumber = payment.invoice?.invoiceNumber ?? "-";
								const storeName = payment.invoice?.storeNameSnapshot ?? "-";
								const disabled = Boolean(paymentActionId);

								return (
									<tr key={payment.id}>
										<td className="px-4 py-3">
											<div className="font-medium text-slate-900">{paymentNumber}</div>
											<div className="text-xs text-slate-500">{ref || "-"}</div>
										</td>
										<td className="px-4 py-3 text-slate-700">{invoiceNumber}</td>
										<td className="px-4 py-3 text-slate-700">{storeName}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
										<td className="px-4 py-3 text-slate-700">{payment.method}</td>
										<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(payment.amount)}</td>
										<td className="px-4 py-3 text-slate-700">{payment.status}</td>
										<td className="px-4 py-3">
											<div className="flex justify-end gap-2">
												<button
													type="button"
													onClick={() => setSelectedPayment(payment)}
													className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
												>
													Detail
												</button>
												{payment.status === "PENDING" ? (
													<button
														type="button"
														onClick={() => handleVerifyPayment(payment)}
														disabled={disabled}
														className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
													>
														Verify
													</button>
												) : null}
												{payment.status !== "CANCELLED" ? (
													<button
														type="button"
														onClick={() => openCancelPayment(payment)}
														disabled={disabled}
														className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
													>
														Batal
													</button>
												) : null}
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
				<div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
					<button
						type="button"
						onClick={() => setPaymentPage((current) => Math.max(1, current - 1))}
						disabled={loadingPayments || currentPaymentPage <= 1}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Sebelumnya
					</button>
					<button
						type="button"
						onClick={() => setPaymentPage((current) => Math.min(paymentTotalPages, current + 1))}
						disabled={loadingPayments || currentPaymentPage >= paymentTotalPages}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Berikutnya
					</button>
				</div>
			</section>

			<Modal
				isOpen={Boolean(selectedDocument)}
				onClose={() => setSelectedDocument(null)}
				title="Detail Dokumen"
			>
				{selectedDocument ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Nomor</div>
								<div className="mt-2 font-medium text-slate-900">{selectedDocument.number}</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Jenis</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedDocument.kind === "draft" ? "Invoice Draft" : "Invoice Final"}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Toko</div>
								<div className="mt-2 font-medium text-slate-900">{selectedDocument.customer}</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
								<div className="mt-2 font-medium text-slate-900">{selectedDocument.status}</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Tanggal</div>
								<div className="mt-2 font-medium text-slate-900">{dateOnly(selectedDocument.date)}</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Jatuh Tempo</div>
								<div className="mt-2 font-medium text-slate-900">
									{dateOnly(selectedDocument.dueDate)}
								</div>
							</div>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</div>
								<div className="mt-2 font-medium text-slate-900">
									{formatRupiah(selectedDocument.totalAmount)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Outstanding</div>
								<div className="mt-2 font-medium text-slate-900">
									{formatRupiah(selectedDocument.outstandingAmount)}
								</div>
							</div>
						</div>
						{"notes" in selectedDocument.raw && selectedDocument.raw.notes ? (
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan</div>
								<div className="mt-2 text-slate-700">{selectedDocument.raw.notes}</div>
							</div>
						) : null}
						{"cancelReason" in selectedDocument.raw && selectedDocument.raw.cancelReason ? (
							<div className="rounded-xl border border-red-200 bg-red-50 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-red-500">Alasan Batal</div>
								<div className="mt-2 text-red-700">{selectedDocument.raw.cancelReason}</div>
							</div>
						) : null}
					</div>
				) : null}
			</Modal>

			<Modal
				isOpen={Boolean(selectedPayment)}
				onClose={() => setSelectedPayment(null)}
				title="Detail Pembayaran"
			>
				{selectedPayment ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">No Pembayaran</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedPayment.paymentNumber ?? selectedPayment.id}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
								<div className="mt-2 font-medium text-slate-900">{selectedPayment.status}</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoice</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedPayment.invoice?.invoiceNumber ?? selectedPayment.invoiceId}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Toko</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedPayment.invoice?.storeNameSnapshot ?? "-"}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Tanggal</div>
								<div className="mt-2 font-medium text-slate-900">
									{dateOnly(selectedPayment.paymentDate)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Metode</div>
								<div className="mt-2 font-medium text-slate-900">{selectedPayment.method}</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Nominal</div>
								<div className="mt-2 font-medium text-slate-900">
									{formatRupiah(selectedPayment.amount)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Referensi</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedPayment.referenceNo ?? selectedPayment.referenceNumber ?? "-"}
								</div>
							</div>
						</div>
						{selectedPayment.notes ? (
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan</div>
								<div className="mt-2 text-slate-700">{selectedPayment.notes}</div>
							</div>
						) : null}
						{selectedPayment.cancelReason ? (
							<div className="rounded-xl border border-red-200 bg-red-50 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-red-500">Alasan Batal</div>
								<div className="mt-2 text-red-700">{selectedPayment.cancelReason}</div>
							</div>
						) : null}
					</div>
				) : null}
			</Modal>

			<CancelReasonModal
				isOpen={Boolean(cancelTarget)}
				title="Batalkan Pembayaran"
				description={
					cancelTarget
						? `Pembayaran ${cancelTarget.paymentNumber ?? cancelTarget.id} akan dibatalkan.`
						: ""
				}
				reason={cancelReason}
				submitting={Boolean(paymentActionId)}
				onReasonChange={setCancelReason}
				onClose={() => {
					setCancelTarget(null);
					setCancelReason("");
				}}
				onConfirm={handleCancelPayment}
			/>
		</FeaturePage>
	);
}
