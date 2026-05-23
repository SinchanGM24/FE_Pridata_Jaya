"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	invoiceStatusLabel,
	paymentMethodLabel,
	paymentStatusLabel,
	toUiLabel,
} from "@/lib/ui-labels";
import { invoicesService, type InvoiceListItem, type InvoiceStatus } from "@/services/invoices";
import { paymentsService, type Payment } from "@/services/payments";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

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

const rowMatchesQuickMode = (row: InvoicePaymentRow, mode: QuickDeskMode) => {
	if (mode === "all") return true;
	if (mode === "cash") {
		return row.payments.some((payment) => payment.method === "CASH");
	}
	return row.payments.some((payment) => payment.method !== "CASH");
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
	const [selectedRow, setSelectedRow] = useState<InvoicePaymentRow | null>(null);
	const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);

	const loadData = async (activeFilters: Filters) => {
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
					search: activeFilters.search || undefined,
					status: invoiceStatus,
					dateFrom: activeFilters.dateFrom || undefined,
					dateTo: activeFilters.dateTo || undefined,
					sortBy: "invoiceDate",
					sortOrder: "desc",
				}),
				paymentsService.listAll({
					status: "VERIFIED",
					search: activeFilters.search || undefined,
					dateFrom: activeFilters.dateFrom || undefined,
					dateTo: activeFilters.dateTo || undefined,
					sortBy: "paymentDate",
					sortOrder: "desc",
				}),
				paymentsService.listAll({
					status: "PENDING",
					search: activeFilters.search || undefined,
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

			const normalizedQuery = activeFilters.search.trim().toLowerCase();

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
					if (!normalizedQuery) return true;
					const searchableText = [
						row.invoice.invoiceNumber,
						row.invoice.storeNameSnapshot,
						...row.payments.map((payment) => payment.paymentNumber ?? payment.id),
						...row.payments.map((payment) => payment.referenceNo ?? payment.referenceNumber ?? ""),
					]
						.join(" ")
						.toLowerCase();

					return searchableText.includes(normalizedQuery);
				})
				.sort((left, right) =>
					String(right.lastPaymentDate || right.invoice.invoiceDate).localeCompare(
						String(left.lastPaymentDate || left.invoice.invoiceDate),
					),
				);

			setRows(nextRows);
			setPendingPayments(
				pendingAccountantPayments
					.filter(
						(payment) =>
							payment.method === "TRANSFER" &&
							payment.verificationTarget === "ACCOUNTANT",
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
	};

	const handleVerifyPayment = async (payment: Payment) => {
		setVerifyingPaymentId(payment.id);
		setError("");
		setSuccess("");
		try {
			await paymentsService.verify(payment.id);
			await loadData(filters);
			setSuccess(`Pembayaran ${payment.paymentNumber ?? payment.id} berhasil dikonfirmasi.`);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal mengonfirmasi pembayaran."));
		} finally {
			setVerifyingPaymentId(null);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadData(defaultFilters);
		}, 0);

		return () => window.clearTimeout(timer);
	}, []);

	const scopedRows = useMemo(
		() => rows.filter((row) => rowMatchesQuickMode(row, quickDeskMode)),
		[quickDeskMode, rows],
	);

	const summary = useMemo(
		() => ({
			totalInvoice: scopedRows.length,
			totalCicilan: scopedRows.reduce((sum, row) => sum + row.paymentCount, 0),
			totalTerbayar: scopedRows.reduce((sum, row) => sum + row.totalPaidVerified, 0),
			totalSisa: scopedRows.reduce((sum, row) => sum + row.remainingAmount, 0),
		}),
		[scopedRows],
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
									? "bg-slate-900 text-white"
									: "border border-slate-300 text-slate-700 hover:bg-slate-50"
							}`}
						>
							{label}
						</button>
					))}
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
									setFilters((current) => ({ ...current, search: event.target.value }))
								}
							/>
							<input
								type="date"
								value={filters.dateFrom}
								onChange={(event) =>
									setFilters((current) => ({ ...current, dateFrom: event.target.value }))
								}
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								aria-label="Tanggal pembayaran dari"
							/>
							<input
								type="date"
								value={filters.dateTo}
								onChange={(event) =>
									setFilters((current) => ({ ...current, dateTo: event.target.value }))
								}
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								aria-label="Tanggal pembayaran sampai"
							/>
							<div className="flex flex-wrap gap-2 md:justify-end">
								<button
									type="button"
									onClick={() => void loadData(filters)}
									disabled={loading}
									className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
								>
									Terapkan
								</button>
								<button
									type="button"
									onClick={() => {
										setFilters(defaultFilters);
										void loadData(defaultFilters);
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
						<div className="border-b border-slate-100 px-4 py-3">
							<h2 className="text-lg font-semibold text-slate-900">Konfirmasi Pembayaran Transfer</h2>
							<p className="mt-1 text-sm text-slate-500">
								Periksa nominal dan referensi transfer sebelum mengonfirmasi pembayaran.
							</p>
						</div>
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-4 py-3">Pembayaran</th>
									<th className="px-4 py-3">Invoice</th>
									<th className="px-4 py-3">Toko</th>
									<th className="px-4 py-3">Tanggal</th>
									<th className="px-4 py-3">Referensi</th>
									<th className="px-4 py-3 text-right">Nominal</th>
									<th className="px-4 py-3">Catatan</th>
									<th className="px-4 py-3 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{loading ? (
									<tr>
										<td className="px-4 py-4 text-slate-600" colSpan={8}>
											Memuat pembayaran menunggu konfirmasi...
										</td>
									</tr>
								) : pendingPayments.length === 0 ? (
									<tr>
										<td className="px-4 py-4 text-slate-600" colSpan={8}>
											Tidak ada pembayaran transfer yang menunggu konfirmasi.
										</td>
									</tr>
								) : (
									pendingPayments.map((payment) => (
										<tr key={payment.id}>
											<td className="px-4 py-3 font-medium text-slate-900">
												{payment.paymentNumber ?? payment.id}
											</td>
											<td className="px-4 py-3 text-slate-700">
												{payment.invoice?.invoiceNumber ?? payment.invoiceId}
											</td>
											<td className="px-4 py-3 text-slate-700">
												{payment.invoice?.storeNameSnapshot ?? "-"}
											</td>
											<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
											<td className="px-4 py-3 text-slate-700">
												{payment.referenceNo ?? payment.referenceNumber ?? "-"}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-slate-900">
												{formatRupiah(payment.amount)}
											</td>
											<td className="px-4 py-3 text-slate-700">{payment.notes || "-"}</td>
											<td className="px-4 py-3 text-right">
												<button
													type="button"
													onClick={() => void handleVerifyPayment(payment)}
													disabled={verifyingPaymentId === payment.id}
													className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
												>
													{verifyingPaymentId === payment.id ? "Memproses..." : "Konfirmasi"}
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
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
									? "bg-slate-900 text-white"
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
							setFilters((current) => ({ ...current, search: event.target.value }))
						}
					/>
					<select
						value={filters.filterMode}
						onChange={(event) =>
							setFilters((current) => ({
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
							setFilters((current) => ({ ...current, dateFrom: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal invoice dari"
					/>
					<input
						type="date"
						value={filters.dateTo}
						onChange={(event) =>
							setFilters((current) => ({ ...current, dateTo: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal invoice sampai"
					/>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<button
							type="button"
							onClick={() => {
								setPage(1);
								void loadData(filters);
							}}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Terapkan
						</button>
						<button
							type="button"
							onClick={() => {
								setPage(1);
								setFilters(defaultFilters);
								void loadData(defaultFilters);
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
						Halaman {currentPage} / {totalPages}
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Tanggal Invoice</th>
							<th className="px-4 py-3">Metode</th>
							<th className="px-4 py-3 text-right">Jumlah Cicilan</th>
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
							paginatedRows.map((row) => (
								<tr key={row.invoice.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{row.invoice.invoiceNumber}</div>
										<div className="text-xs text-slate-500">
											Pembayaran terakhir: {dateOnly(row.lastPaymentDate)}
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{row.invoice.storeNameSnapshot}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(row.invoice.invoiceDate)}</td>
									<td className="px-4 py-3 text-slate-700">{row.methodSummary}</td>
									<td className="px-4 py-3 text-right text-slate-900">{row.paymentCount}</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(row.totalPaidVerified)}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(row.remainingAmount)}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{toUiLabel(row.invoice.status, invoiceStatusLabel)}
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
				</>
			) : null}

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => setSelectedRow(null)}
				title="Detail Invoice Pembayaran"
			>
				{selectedRow ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 md:grid-cols-2">
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
								<div className="mt-2 font-medium text-slate-900">
									{toUiLabel(selectedRow.invoice.status, invoiceStatusLabel)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Metode Pembayaran</div>
								<div className="mt-2 font-medium text-slate-900">{selectedRow.methodSummary}</div>
							</div>
						</div>

						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Tagihan</div>
								<div className="mt-2 font-medium text-slate-900">
									{formatRupiah(selectedRow.invoice.totalAmount)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Terbayar</div>
								<div className="mt-2 font-medium text-emerald-700">
									{formatRupiah(selectedRow.totalPaidVerified)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sisa Tagihan</div>
								<div className="mt-2 font-medium text-rose-700">
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
											<th className="px-4 py-3 text-right">Nominal</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3">Referensi</th>
											<th className="px-4 py-3">Catatan</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{selectedRow.payments.map((payment) => (
											<tr key={payment.id}>
												<td className="px-4 py-3">
													<div className="font-medium text-slate-900">
														{payment.paymentNumber ?? payment.id}
													</div>
												</td>
												<td className="px-4 py-3 text-slate-700">
													{dateOnly(payment.paymentDate)}
												</td>
												<td className="px-4 py-3 text-slate-700">
													{toUiLabel(payment.method, paymentMethodLabel)}
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
