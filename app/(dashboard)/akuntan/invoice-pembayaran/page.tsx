"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import {
	invoiceStatusLabel,
	paymentMethodLabel,
	paymentStatusLabel,
	toUiLabel,
} from "@/lib/ui-labels";
import { invoicesService, type InvoiceListItem, type InvoiceStatus } from "@/services/invoices";
import { paymentsService, type Payment } from "@/services/payments";
import { formatRupiah } from "@/lib/format";


const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

type FilterMode = "all" | "partial" | "paid";
type QuickDeskMode = "all" | "cash" | "transfer";
type PageMode = "verification" | "data";

type InvoicePaymentRow = {
	invoice: InvoiceListItem;
	payments: Payment[];
	totalPaidVerified: number;
	remainingAmount: number;
	paymentCount: number;
	lastPaymentDate: string | null;
	methodSummary: string;
};

type Filters = {
	search: string;
	filterMode: FilterMode;
	dateFrom: string;
	dateTo: string;
};

const defaultFilters: Filters = {
	search: "",
	filterMode: "all",
	dateFrom: "",
	dateTo: "",
};

const TABLE_PAGE_SIZE = 20;

const normalizeSearchText = (value: unknown) =>
	String(value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

const matchesLooseSearch = (source: Array<unknown>, query: string) => {
	const tokens = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return true;

	const haystack = normalizeSearchText(source.join(" "));
	return tokens.every((token) => haystack.includes(token));
};

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

const resolveMethodSummary = (payments: Payment[]) => {
	const methods = Array.from(new Set(payments.map((payment) => payment.method)));
	if (methods.length === 0) return "-";
	if (methods.length === 1) return toUiLabel(methods[0], paymentMethodLabel);
	return methods
		.map((method) => toUiLabel(method, paymentMethodLabel))
		.join(", ");
};

const submissionSourceLabel: Record<string, string> = {
	STORE_SELF: "Toko sendiri",
	STORE_SELF_SERVICE: "Toko sendiri",
	SALES_REPRESENTED: "Diwakilkan sales",
	SALES_REPRESENTATIVE: "Diwakilkan sales",
	INTERNAL_BACKOFFICE: "Backoffice",
};

const isPendingForAccountant = (payment: Payment) =>
	payment.verificationTarget === "ACCOUNTANT" ||
	(!payment.verificationTarget && payment.method !== "CASH");

const invoiceStatusTone: Record<InvoiceStatus, string> = {
	UNPAID: "border-amber-200 bg-amber-50 text-amber-700",
	PARTIAL: "border-sky-200 bg-sky-50 text-sky-700",
	PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
	CANCELLED: "border-slate-200 bg-slate-50 text-slate-600",
};

const rowMatchesQuickMode = (row: InvoicePaymentRow, mode: QuickDeskMode) => {
	return getPaymentsForQuickMode(row.payments, mode).length > 0;
};

const getPaymentsForQuickMode = (payments: Payment[], mode: QuickDeskMode) => {
	if (mode === "all") return payments;
	if (mode === "cash") return payments.filter((payment) => payment.method === "CASH");
	return payments.filter((payment) => payment.method !== "CASH");
};

const buildPaymentScope = (row: InvoicePaymentRow, mode: QuickDeskMode) => {
	const payments = getPaymentsForQuickMode(row.payments, mode);
	return {
		payments,
		paymentCount: payments.length,
		totalPaid: payments.reduce((sum, payment) => sum + payment.amount, 0),
		lastPaymentDate: payments[0]?.paymentDate ?? null,
		methodSummary: resolveMethodSummary(payments),
	};
};

export default function InvoicePembayaranPage() {
	const [rows, setRows] = useState<InvoicePaymentRow[]>([]);
	const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [filters, setFilters] = useState<Filters>(defaultFilters);
	const [pageMode, setPageMode] = useState<PageMode>("verification");
	const [quickDeskMode, setQuickDeskMode] = useState<QuickDeskMode>("all");
	const [page, setPage] = useState(1);
	const [verificationPage, setVerificationPage] = useState(1);
	const [selectedRow, setSelectedRow] = useState<InvoicePaymentRow | null>(null);
	const [selectedPendingPayment, setSelectedPendingPayment] = useState<Payment | null>(null);
	const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);

	const updateFilters = useCallback((nextFilters: Filters | ((current: Filters) => Filters)) => {
		setPage(1);
		setVerificationPage(1);
		setFilters(nextFilters);
	}, []);

	const loadData = useCallback(async (activeFilters: Filters) => {
		setLoading(true);
		setError("");
		setSuccess("");

		try {
			const invoiceStatus: InvoiceStatus | undefined =
				activeFilters.filterMode === "paid"
					? "PAID"
					: activeFilters.filterMode === "partial"
						? "PARTIAL"
						: undefined;

			const [invoices, verifiedPayments, pendingAccountantPayments] = await Promise.all([
				invoicesService.listAll({
					status: invoiceStatus,
					dateFrom: activeFilters.dateFrom || undefined,
					dateTo: activeFilters.dateTo || undefined,
					sortBy: "invoiceDate",
					sortOrder: "desc",
				}),
				paymentsService.listAll({
					status: "VERIFIED",
					dateFrom: activeFilters.dateFrom || undefined,
					dateTo: activeFilters.dateTo || undefined,
					sortBy: "paymentDate",
					sortOrder: "desc",
				}),
				paymentsService.listAll({
					status: "PENDING",
					dateFrom: activeFilters.dateFrom || undefined,
					dateTo: activeFilters.dateTo || undefined,
					sortBy: "paymentDate",
					sortOrder: "desc",
				}),
			]);

			const paymentsByInvoice = new Map<string, Payment[]>();
			for (const payment of verifiedPayments) {
				const key = payment.invoiceId;
				if (!paymentsByInvoice.has(key)) {
					paymentsByInvoice.set(key, []);
				}
				paymentsByInvoice.get(key)?.push(payment);
			}

			const nextRows = invoices
				.filter((invoice) => invoice.status !== "CANCELLED")
				.map((invoice) => {
					const invoicePayments = (paymentsByInvoice.get(invoice.id) ?? [])
						.slice()
						.sort((left, right) =>
							String(right.paymentDate || "").localeCompare(String(left.paymentDate || "")),
						);
					const totalPaidVerified = invoicePayments.reduce((sum, payment) => sum + payment.amount, 0);
					const remainingAmount = Math.max(0, invoice.totalAmount - totalPaidVerified);
					return {
						invoice,
						payments: invoicePayments,
						totalPaidVerified,
						remainingAmount,
						paymentCount: invoicePayments.length,
						lastPaymentDate: invoicePayments[0]?.paymentDate ?? null,
						methodSummary: resolveMethodSummary(invoicePayments),
					};
				})
				.filter((row) => row.paymentCount > 0)
				.filter((row) => {
					return matchesLooseSearch(
						[
						row.invoice.invoiceNumber,
						row.invoice.storeNameSnapshot,
						row.invoice.status,
						toUiLabel(row.invoice.status, invoiceStatusLabel),
						row.methodSummary,
						...row.payments.map((payment) => payment.paymentNumber ?? ""),
						...row.payments.map((payment) => payment.referenceNo ?? payment.referenceNumber ?? ""),
						...row.payments.map((payment) => toUiLabel(payment.method, paymentMethodLabel)),
						],
						activeFilters.search,
					);
				})
				.sort((left, right) =>
					String(right.lastPaymentDate || right.invoice.invoiceDate).localeCompare(
						String(left.lastPaymentDate || left.invoice.invoiceDate),
					),
				);

			setRows(nextRows);
			setPendingPayments(
				pendingAccountantPayments
					.filter(isPendingForAccountant)
					.filter((payment) =>
						matchesLooseSearch(
							[
								payment.paymentNumber,
								payment.invoice?.invoiceNumber,
								payment.invoice?.storeNameSnapshot,
								payment.referenceNo,
								payment.referenceNumber,
								payment.notes,
								toUiLabel(payment.method, paymentMethodLabel),
								submissionSourceLabel[payment.submissionSource ?? ""],
							],
							activeFilters.search,
						),
					)
					.sort((left, right) =>
						String(right.paymentDate || "").localeCompare(String(left.paymentDate || "")),
					),
			);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat invoice pembayaran."));
		} finally {
			setLoading(false);
		}
	}, []);

	const handleVerifyPayment = async (payment: Payment) => {
		setVerifyingPaymentId(payment.id);
		setError("");
		setSuccess("");
		try {
			await paymentsService.verify(payment.id);
			await loadData(filters);
			setSuccess(`Pembayaran ${payment.paymentNumber ?? "-"} berhasil dikonfirmasi.`);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal mengonfirmasi pembayaran."));
		} finally {
			setVerifyingPaymentId(null);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadData(filters);
		}, 350);

		return () => window.clearTimeout(timer);
	}, [filters, loadData]);

	const scopedRows = useMemo(
		() => rows.filter((row) => rowMatchesQuickMode(row, quickDeskMode)),
		[quickDeskMode, rows],
	);

	const summary = useMemo(
		() => ({
			totalInvoice: scopedRows.length,
			totalCicilan: scopedRows.reduce(
				(sum, row) => sum + buildPaymentScope(row, quickDeskMode).paymentCount,
				0,
			),
			totalTerbayar: scopedRows.reduce(
				(sum, row) => sum + buildPaymentScope(row, quickDeskMode).totalPaid,
				0,
			),
			totalSisa: scopedRows.reduce((sum, row) => sum + row.remainingAmount, 0),
		}),
		[quickDeskMode, scopedRows],
	);

	const verificationSummary = useMemo(
		() => ({
			totalPengajuan: pendingPayments.length,
			totalNominal: pendingPayments.reduce((sum, payment) => sum + payment.amount, 0),
			totalToko: new Set(pendingPayments.map((payment) => payment.storeId)).size,
		}),
		[pendingPayments],
	);

	const totalPages = Math.max(1, Math.ceil(scopedRows.length / TABLE_PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const paginatedRows = useMemo(() => {
		const start = (currentPage - 1) * TABLE_PAGE_SIZE;
		return scopedRows.slice(start, start + TABLE_PAGE_SIZE);
	}, [currentPage, scopedRows]);
	const verificationTotalPages = Math.max(1, Math.ceil(pendingPayments.length / TABLE_PAGE_SIZE));
	const verificationCurrentPage = Math.min(verificationPage, verificationTotalPages);
	const paginatedPendingPayments = useMemo(() => {
		const start = (verificationCurrentPage - 1) * TABLE_PAGE_SIZE;
		return pendingPayments.slice(start, start + TABLE_PAGE_SIZE);
	}, [pendingPayments, verificationCurrentPage]);

	const quickDeskDescription =
		quickDeskMode === "cash"
			? "Mode tunai menampilkan invoice yang sudah memiliki pembayaran tunai terverifikasi. Rincian cicilan tunai dan referensinya ada di detail invoice."
			: quickDeskMode === "transfer"
				? "Mode transfer menampilkan invoice yang sudah memiliki pembayaran transfer terverifikasi."
				: "Halaman ini hanya menampilkan invoice final yang sudah memiliki pembayaran terverifikasi. Satu invoice diringkas menjadi satu baris, lalu rincian cicilan dibuka dari detail.";

	return (
		<FeaturePage
			title="Invoice Pembayaran"
			description="Konfirmasi pembayaran transfer toko, lalu pindah ke mode data untuk membaca invoice pembayaran yang sudah terkonfirmasi."
		>
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>
			<section className="rounded-2xl border border-slate-200 bg-white p-4">
				<div className="flex flex-wrap gap-2">
					{[
						["verification", "Konfirmasi"],
						["data", "Data Pembayaran"],
					].map(([value, label]) => (
						<button
							key={value}
							type="button"
							onClick={() => setPageMode(value as PageMode)}
							className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
								pageMode === value
									? "bg-indigo-600 text-white"
									: "border border-slate-300 text-slate-700 hover:bg-slate-50"
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</section>

			{pageMode === "verification" ? (
				<>
					<section className="grid gap-4 md:grid-cols-3">
						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<p className="text-sm text-slate-500">Menunggu Konfirmasi</p>
							<p className="mt-2 text-3xl font-semibold text-slate-900">{verificationSummary.totalPengajuan}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<p className="text-sm text-slate-500">Total Nominal</p>
							<p className="mt-2 text-2xl font-semibold text-emerald-600">
								{formatRupiah(verificationSummary.totalNominal)}
							</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<p className="text-sm text-slate-500">Jumlah Toko</p>
							<p className="mt-2 text-3xl font-semibold text-slate-900">{verificationSummary.totalToko}</p>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								placeholder="Cari invoice, toko, pembayaran, atau referensi"
								value={filters.search}
								onChange={(event) =>
									updateFilters((current) => ({ ...current, search: event.target.value }))
								}
							/>
							<input
								type="date"
								value={filters.dateFrom}
								onChange={(event) =>
									updateFilters((current) => ({ ...current, dateFrom: event.target.value }))
								}
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								aria-label="Tanggal pembayaran dari"
							/>
							<input
								type="date"
								value={filters.dateTo}
								onChange={(event) =>
									updateFilters((current) => ({ ...current, dateTo: event.target.value }))
								}
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								aria-label="Tanggal pembayaran sampai"
							/>
							<div className="flex flex-wrap gap-2 md:justify-end">
								<button
									type="button"
									onClick={() => {
										updateFilters(defaultFilters);
									}}
									disabled={loading}
									className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
								>
									Reset
								</button>
							</div>
						</div>
					</section>

					<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
						<div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
							<div>
								<h2 className="text-lg font-semibold text-slate-900">Konfirmasi Pembayaran</h2>
								<p className="mt-1 text-sm text-slate-500">
									Periksa nominal, sumber pengajuan, referensi, dan bukti sebelum mengonfirmasi pembayaran.
								</p>
							</div>
							<div className="text-sm text-slate-600 md:text-right">
								<p>Menampilkan {paginatedPendingPayments.length} dari {pendingPayments.length} pembayaran.</p>
								<p>Halaman {verificationCurrentPage} dari {verificationTotalPages}</p>
							</div>
						</div>
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-4 py-3">Pembayaran</th>
									<th className="px-4 py-3">Invoice</th>
									<th className="px-4 py-3">Tanggal</th>
									<th className="px-4 py-3">Metode</th>
									<th className="px-4 py-3">Bukti</th>
									<th className="px-4 py-3 text-right">Nominal</th>
									<th className="px-4 py-3 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{loading ? (
									<tr>
										<td className="px-4 py-4 text-slate-600" colSpan={7}>
											Memuat pembayaran menunggu konfirmasi...
										</td>
									</tr>
								) : pendingPayments.length === 0 ? (
									<tr>
										<td className="px-4 py-4 text-slate-600" colSpan={7}>
											Tidak ada pembayaran yang menunggu konfirmasi.
										</td>
									</tr>
								) : (
									paginatedPendingPayments.map((payment) => (
										<tr key={payment.id}>
											<td className="px-4 py-3 font-medium text-slate-900">
												{payment.paymentNumber ?? "-"}
											</td>
											<td className="px-4 py-3 text-slate-700">
												<div className="font-medium text-slate-900">
													{payment.invoice?.invoiceNumber ?? "-"}
												</div>
												<div className="mt-1 text-xs text-slate-500">
													{payment.invoice?.storeNameSnapshot ?? "-"}
												</div>
											</td>
											<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
											<td className="px-4 py-3 text-slate-700">
												{toUiLabel(payment.method, paymentMethodLabel)}
											</td>
											<td className="px-4 py-3 text-slate-700">
												{payment.proofUrl ? (
													<a
														href={payment.proofUrl}
														target="_blank"
														rel="noreferrer"
														className="font-medium text-sky-700 hover:text-sky-800"
													>
														{payment.proofFileName || "Lihat bukti"}
													</a>
												) : (
													"-"
												)}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-slate-900">
												{formatRupiah(payment.amount)}
											</td>
											<td className="px-4 py-3 text-right">
												<div className="flex justify-end gap-2">
													<button
														type="button"
														onClick={() => setSelectedPendingPayment(payment)}
														className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
													>
														Detail
													</button>
													<button
														type="button"
														onClick={() => void handleVerifyPayment(payment)}
														disabled={verifyingPaymentId === payment.id}
														className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
													>
														{verifyingPaymentId === payment.id ? "Memproses..." : "Konfirmasi"}
													</button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
						<PaginationControls
							currentPage={verificationCurrentPage}
							totalPages={verificationTotalPages}
							totalItems={pendingPayments.length}
							currentItemCount={paginatedPendingPayments.length}
							pageSize={TABLE_PAGE_SIZE}
							itemLabel="pembayaran"
							loading={loading}
							onPageChange={setVerificationPage}
						/>
					</section>
				</>
			) : null}

			{pageMode === "data" ? (
				<>
			<section className="rounded-2xl border border-slate-200 bg-white p-4">
				<div className="flex flex-wrap gap-2">
					{[
						["all", "Keseluruhan"],
						["cash", "Cash"],
						["transfer", "Transfer"],
					].map(([value, label]) => (
						<button
							key={value}
							type="button"
							onClick={() => {
								setQuickDeskMode(value as QuickDeskMode);
								setPage(1);
							}}
							className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
								quickDeskMode === value
									? "bg-indigo-600 text-white"
									: "border border-slate-300 text-slate-700 hover:bg-slate-50"
							}`}
						>
							{label}
						</button>
					))}
				</div>
				<p className="mt-3 text-sm text-slate-600">{quickDeskDescription}</p>
			</section>

			<section className="grid gap-4 md:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Total Invoice</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalInvoice}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Jumlah Cicilan</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalCicilan}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Total Terbayar</p>
					<p className="mt-2 text-2xl font-semibold text-emerald-600">
						{formatRupiah(summary.totalTerbayar)}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Sisa Tagihan</p>
					<p className="mt-2 text-2xl font-semibold text-rose-600">
						{formatRupiah(summary.totalSisa)}
					</p>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4">
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari invoice, toko, pembayaran, atau referensi"
						value={filters.search}
						onChange={(event) =>
							updateFilters((current) => ({ ...current, search: event.target.value }))
						}
					/>
					<select
						value={filters.filterMode}
						onChange={(event) =>
							updateFilters((current) => ({
								...current,
								filterMode: event.target.value as FilterMode,
							}))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="all">Semua Status Invoice</option>
						<option value="partial">Bayar Sebagian</option>
						<option value="paid">Lunas</option>
					</select>
					<input
						type="date"
						value={filters.dateFrom}
						onChange={(event) =>
							updateFilters((current) => ({ ...current, dateFrom: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal invoice dari"
					/>
					<input
						type="date"
						value={filters.dateTo}
						onChange={(event) =>
							updateFilters((current) => ({ ...current, dateTo: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal invoice sampai"
					/>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<button
							type="button"
							onClick={() => {
								updateFilters(defaultFilters);
							}}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Reset
						</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
				<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
					<p>
						Menampilkan {paginatedRows.length} invoice dari {scopedRows.length} hasil filter.
					</p>
					<p>
						Halaman {currentPage} dari {totalPages}
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Tanggal Pembayaran</th>
							<th className="px-4 py-3">Metode</th>
							<th className="px-4 py-3 text-right">Total Tagihan</th>
							<th className="px-4 py-3 text-right">Terbayar</th>
							<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={9}>
									Memuat invoice pembayaran...
								</td>
							</tr>
						) : scopedRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={9}>
									Tidak ada invoice pembayaran terkonfirmasi pada filter ini.
								</td>
							</tr>
						) : (
							paginatedRows.map((row) => {
								const paymentScope = buildPaymentScope(row, quickDeskMode);
								return (
									<tr key={row.invoice.id}>
										<td className="px-4 py-3">
											<div className="font-medium text-slate-900">{row.invoice.invoiceNumber}</div>
										</td>
										<td className="px-4 py-3 text-slate-700">{row.invoice.storeNameSnapshot}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(paymentScope.lastPaymentDate)}</td>
										<td className="px-4 py-3 text-slate-700">{paymentScope.methodSummary}</td>
										<td className="px-4 py-3 text-right font-semibold text-slate-900">
											{formatRupiah(row.invoice.totalAmount)}
										</td>
										<td className="px-4 py-3 text-right text-slate-900">
											{formatRupiah(paymentScope.totalPaid)}
										</td>
										<td className="px-4 py-3 text-right text-slate-900">
											{formatRupiah(row.remainingAmount)}
										</td>
										<td className="px-4 py-3">
											<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceStatusTone[row.invoice.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
												{toUiLabel(row.invoice.status, invoiceStatusLabel)}
											</span>
										</td>
										<td className="px-4 py-3 text-right">
											<button
												type="button"
												onClick={() => setSelectedRow(row)}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
											>
												Detail
											</button>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
				<PaginationControls
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={scopedRows.length}
					currentItemCount={paginatedRows.length}
					pageSize={TABLE_PAGE_SIZE}
					itemLabel="invoice"
					loading={loading}
					onPageChange={setPage}
				/>
			</section>
				</>
			) : null}

			<Modal
				isOpen={Boolean(selectedPendingPayment)}
				onClose={() => setSelectedPendingPayment(null)}
				title="Detail Pembayaran Menunggu Konfirmasi"
				maxWidthClassName="max-w-3xl"
			>
				{selectedPendingPayment ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 md:grid-cols-2">
							{[
								{ label: "Nomor Pembayaran", value: selectedPendingPayment.paymentNumber ?? "-" },
								{ label: "Invoice", value: selectedPendingPayment.invoice?.invoiceNumber ?? "-" },
								{ label: "Toko", value: selectedPendingPayment.invoice?.storeNameSnapshot ?? "-" },
								{ label: "Tanggal Pembayaran", value: dateOnly(selectedPendingPayment.paymentDate) },
								{
									label: "Metode",
									value: toUiLabel(selectedPendingPayment.method, paymentMethodLabel),
								},
								{
									label: "Sumber",
									value: submissionSourceLabel[selectedPendingPayment.submissionSource ?? ""] ?? "-",
								},
								{
									label: "Referensi",
									value:
										selectedPendingPayment.referenceNo ??
										selectedPendingPayment.referenceNumber ??
										"-",
								},
								{ label: "Nominal", value: formatRupiah(selectedPendingPayment.amount) },
							].map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
										{item.label}
									</p>
									<p className="mt-2 font-semibold text-slate-900">{item.value}</p>
								</div>
							))}
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
									Bukti Pembayaran
								</p>
								<div className="mt-2">
									{selectedPendingPayment.proofUrl ? (
										<a
											href={selectedPendingPayment.proofUrl}
											target="_blank"
											rel="noreferrer"
											className="font-semibold text-sky-700 hover:text-sky-800"
										>
											{selectedPendingPayment.proofFileName || "Lihat bukti"}
										</a>
									) : (
										<span className="text-slate-600">-</span>
									)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
									Catatan
								</p>
								<p className="mt-2 whitespace-pre-wrap text-slate-700">
									{selectedPendingPayment.notes || "-"}
								</p>
							</div>
						</div>
					</div>
				) : null}
			</Modal>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => setSelectedRow(null)}
				title="Detail Invoice Pembayaran"
				maxWidthClassName="max-w-7xl"
			>
				{selectedRow ? (
					<div className="space-y-5 text-sm text-slate-700">
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoice</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedRow.invoice.invoiceNumber}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Toko</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedRow.invoice.storeNameSnapshot}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Tanggal Invoice</div>
								<div className="mt-2 font-medium text-slate-900">
									{dateOnly(selectedRow.invoice.invoiceDate)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Jatuh Tempo</div>
								<div className="mt-2 font-medium text-slate-900">
									{dateOnly(selectedRow.invoice.dueDate)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status Invoice</div>
								<div className="mt-2">
									<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceStatusTone[selectedRow.invoice.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
									{toUiLabel(selectedRow.invoice.status, invoiceStatusLabel)}
									</span>
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Metode Pembayaran</div>
								<div className="mt-2 font-medium text-slate-900">{selectedRow.methodSummary}</div>
							</div>
						</div>

						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Tagihan</div>
								<div className="mt-2 text-lg font-semibold text-slate-900">
									{formatRupiah(selectedRow.invoice.totalAmount)}
								</div>
							</div>
							<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Terbayar</div>
								<div className="mt-2 text-lg font-semibold text-emerald-700">
									{formatRupiah(selectedRow.totalPaidVerified)}
								</div>
							</div>
							<div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sisa Tagihan</div>
								<div className="mt-2 text-lg font-semibold text-rose-700">
									{formatRupiah(selectedRow.remainingAmount)}
								</div>
							</div>
						</div>

						<div className="rounded-xl border border-slate-200">
							<div className="border-b border-slate-100 px-4 py-3">
								<h3 className="font-medium text-slate-900">Rincian Cicilan Terkonfirmasi</h3>
								<p className="mt-1 text-xs text-slate-500">
									Semua pembayaran di bawah ini sudah terverifikasi.
								</p>
							</div>
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-slate-200 text-sm">
									<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
										<tr>
											<th className="px-4 py-3">Pembayaran</th>
											<th className="px-4 py-3">Tanggal</th>
											<th className="px-4 py-3">Metode</th>
											<th className="px-4 py-3">Sumber</th>
											<th className="px-4 py-3 text-right">Nominal</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3">Referensi</th>
											<th className="px-4 py-3">Bukti</th>
											<th className="px-4 py-3">Catatan</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{selectedRow.payments.map((payment) => (
											<tr key={payment.id}>
												<td className="px-4 py-3">
													<div className="font-medium text-slate-900">
														{payment.paymentNumber ?? "-"}
													</div>
												</td>
												<td className="px-4 py-3 text-slate-700">
													{dateOnly(payment.paymentDate)}
												</td>
												<td className="px-4 py-3 text-slate-700">
													{toUiLabel(payment.method, paymentMethodLabel)}
												</td>
												<td className="px-4 py-3 text-slate-700">
													{submissionSourceLabel[payment.submissionSource ?? ""] ?? "-"}
												</td>
												<td className="px-4 py-3 text-right text-slate-900">
													{formatRupiah(payment.amount)}
												</td>
												<td className="px-4 py-3 text-slate-700">
													{toUiLabel(payment.status, paymentStatusLabel)}
												</td>
												<td className="px-4 py-3 text-slate-700">
													{payment.referenceNo ?? payment.referenceNumber ?? "-"}
												</td>
												<td className="px-4 py-3 text-slate-700">
													{payment.proofUrl ? (
														<a
															href={payment.proofUrl}
															target="_blank"
															rel="noreferrer"
															className="font-medium text-sky-700 hover:text-sky-800"
														>
															{payment.proofFileName || "Lihat bukti"}
														</a>
													) : (
														"-"
													)}
												</td>
												<td className="px-4 py-3 text-slate-700">{payment.notes || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{selectedRow.invoice.notes ? (
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan Invoice</div>
								<div className="mt-2 text-slate-700">{selectedRow.invoice.notes}</div>
							</div>
						) : null}
					</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
