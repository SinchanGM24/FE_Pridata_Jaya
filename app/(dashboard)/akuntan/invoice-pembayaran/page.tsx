"use client";

import { useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import { useServerValue } from "@/hooks/useServerValue";
import { getApiErrorMessage } from "@/lib/api-errors";
import { witaDayEndIso, witaDayStartIso } from "@/lib/datetime";
import {
	invoiceStatusLabel,
	paymentMethodLabel,
	paymentStatusLabel,
	toUiLabel,
} from "@/lib/ui-labels";
import {
	invoicesService,
	type InvoiceFilterParams,
	type InvoiceListItem,
	type InvoiceStatus,
} from "@/services/invoices";
import { paymentsService, type Payment, type PaymentFilterParams } from "@/services/payments";
import { formatRupiah } from "@/lib/format";


const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

type FilterMode = "all" | "partial" | "paid";
type QuickDeskMode = "all" | "cash" | "transfer";
type PageMode = "verification" | "data";
type InvoicePayment = NonNullable<InvoiceListItem["payments"]>[number];

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

const PAGE_SIZE = 20;

// Invoice batal tidak pernah punya pembayaran; daftar eksplisit tetap menutupnya.
const STATUS_BY_MODE: Record<FilterMode, InvoiceStatus | InvoiceStatus[]> = {
	all: ["UNPAID", "PARTIAL", "PAID"],
	partial: "PARTIAL",
	paid: "PAID",
};

const PAYMENT_METHOD_BY_MODE = { all: undefined, cash: "CASH", transfer: "NON_CASH" } as const;

/** Angka headline: "—" selama ringkasan belum ada (memuat atau gagal), bukan 0 yang menyesatkan. */
const headline = (value: number | undefined, format: (value: number) => string | number = (v) => v) =>
	value === undefined ? "—" : format(value);

const resolveMethodSummary = (payments: Array<Pick<Payment, "method">>) => {
	const methods = Array.from(new Set(payments.map((payment) => payment.method)));
	if (methods.length === 0) return "-";
	return methods.map((method) => toUiLabel(method, paymentMethodLabel)).join(", ");
};

const submissionSourceLabel: Record<string, string> = {
	STORE_SELF: "Toko sendiri",
	STORE_SELF_SERVICE: "Toko sendiri",
	SALES_REPRESENTED: "Diwakilkan sales",
	SALES_REPRESENTATIVE: "Diwakilkan sales",
	INTERNAL_BACKOFFICE: "Backoffice",
};

const invoiceStatusTone: Record<InvoiceStatus, string> = {
	UNPAID: "border-amber-200 bg-amber-50 text-amber-700",
	PARTIAL: "border-sky-200 bg-sky-50 text-sky-700",
	PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
	CANCELLED: "border-slate-200 bg-slate-50 text-slate-600",
};

/** Pembayaran baris yang sesuai mode cepat; server sudah memilih invoice yang punya minimal satu. */
const buildPaymentScope = (invoice: InvoiceListItem, mode: QuickDeskMode) => {
	const all = invoice.payments ?? [];
	const payments: InvoicePayment[] =
		mode === "all"
			? all
			: all.filter((payment) => (mode === "cash") === (payment.method === "CASH"));
	return {
		totalPaid: payments.reduce((sum, payment) => sum + payment.amount, 0),
		lastPaymentDate: payments[0]?.paymentDate ?? null,
		methodSummary: resolveMethodSummary(payments),
	};
};

export default function InvoicePembayaranPage() {
	const [actionError, setActionError] = useState("");
	const [success, setSuccess] = useState("");
	const [filters, setFilters] = useState<Filters>(defaultFilters);
	const [pageMode, setPageMode] = useState<PageMode>("verification");
	const [quickDeskMode, setQuickDeskMode] = useState<QuickDeskMode>("all");
	const [selectedRow, setSelectedRow] = useState<InvoiceListItem | null>(null);
	const [selectedPendingPayment, setSelectedPendingPayment] = useState<Payment | null>(null);
	const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);

	const debouncedSearch = useDebouncedValue(filters.search.trim());
	const search = debouncedSearch || undefined;
	const dateFrom = witaDayStartIso(filters.dateFrom);
	const dateTo = witaDayEndIso(filters.dateTo);
	const sharedKey = `${debouncedSearch}|${filters.dateFrom}|${filters.dateTo}`;

	// Konfirmasi: tanggal = tanggal pembayaran, seperti sebelumnya.
	const pendingFilters: PaymentFilterParams = {
		status: "PENDING",
		verificationTarget: "ACCOUNTANT",
		dateFrom,
		dateTo,
		search,
	};
	const pendingList = usePagedList(
		(page, limit) =>
			paymentsService.list({ ...pendingFilters, page, limit, sortBy: "paymentDate", sortOrder: "desc" }),
		{ filterKey: sharedKey, errorMessage: "Gagal memuat pembayaran menunggu konfirmasi.", pageSize: PAGE_SIZE },
	);
	const pendingSummary = useServerValue(() => paymentsService.summary(pendingFilters), {
		key: sharedKey,
		errorMessage: "Gagal memuat ringkasan konfirmasi pembayaran.",
	});

	// Data: satu pasang tanggal menyaring invoiceDate DAN paymentDate pembayaran terverifikasi,
	// sama seperti halaman lama (invoice dan pembayaran dulu diambil dengan rentang yang sama).
	const invoiceFilters: InvoiceFilterParams = {
		hasVerifiedPayment: true,
		paymentMethod: PAYMENT_METHOD_BY_MODE[quickDeskMode],
		status: STATUS_BY_MODE[filters.filterMode],
		dateFrom,
		dateTo,
		paymentDateFrom: dateFrom,
		paymentDateTo: dateTo,
		search,
	};
	const dataKey = `${sharedKey}|${filters.filterMode}|${quickDeskMode}`;
	const dataList = usePagedList(
		(page, limit) =>
			// R31: invoice yang baru dibayar naik ke atas.
			invoicesService.list({ ...invoiceFilters, page, limit, sortBy: "updatedAt", sortOrder: "desc" }),
		{ filterKey: dataKey, errorMessage: "Gagal memuat invoice pembayaran.", pageSize: PAGE_SIZE },
	);
	const dataSummary = useServerValue(() => invoicesService.summary(invoiceFilters), {
		key: dataKey,
		errorMessage: "Gagal memuat ringkasan invoice pembayaran.",
	});

	const loadError = pendingList.error || pendingSummary.error || dataList.error || dataSummary.error;
	const retryLoad = () => {
		if (pendingList.error) pendingList.reload();
		if (pendingSummary.error) pendingSummary.reload();
		if (dataList.error) dataList.reload();
		if (dataSummary.error) dataSummary.reload();
	};

	const handleVerifyPayment = async (payment: Payment) => {
		setVerifyingPaymentId(payment.id);
		setActionError("");
		setSuccess("");
		try {
			await paymentsService.verify(payment.id);
			pendingList.reload();
			pendingSummary.reload();
			dataList.reload();
			dataSummary.reload();
			setSuccess(`Pembayaran ${payment.paymentNumber ?? "-"} berhasil dikonfirmasi.`);
		} catch (error: unknown) {
			setActionError(getApiErrorMessage(error, "Gagal mengonfirmasi pembayaran."));
		} finally {
			setVerifyingPaymentId(null);
		}
	};

	const pendingPayments = pendingList.items;
	const invoiceRows = dataList.items;
	const verificationSummary = pendingSummary.data;
	const summary = dataSummary.data;
	const selectedScope = selectedRow ? buildPaymentScope(selectedRow, "all") : null;

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
				error={actionError || loadError}
				success={success}
				// Galat muat tidak bisa ditutup: tanpanya tabel tampak kosong atau angka tampak "—" tanpa sebab.
				onDismissError={actionError ? () => setActionError("") : undefined}
				onDismissSuccess={() => setSuccess("")}
				onRetry={actionError ? undefined : retryLoad}
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
							<p className="mt-2 text-3xl font-semibold text-slate-900">{headline(verificationSummary?.count)}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<p className="text-sm text-slate-500">Total Nominal</p>
							<p className="mt-2 text-2xl font-semibold text-emerald-600">
								{headline(verificationSummary?.totalAmount, formatRupiah)}
							</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<p className="text-sm text-slate-500">Jumlah Toko</p>
							<p className="mt-2 text-3xl font-semibold text-slate-900">{headline(verificationSummary?.distinctStores)}</p>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								placeholder="Cari invoice, toko, pembayaran, atau referensi"
								maxLength={100}
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
									onClick={() => {
										setFilters(defaultFilters);
									}}
									disabled={pendingList.loading}
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
								<p>Menampilkan {pendingPayments.length} dari {pendingList.totalItems} pembayaran.</p>
								<p>Halaman {pendingList.page} dari {pendingList.totalPages}</p>
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
								{pendingPayments.length === 0 ? (
									<tr>
										<td className="px-4 py-4 text-slate-600" colSpan={7}>
											{pendingList.loading
												? "Memuat pembayaran menunggu konfirmasi..."
												: pendingList.error
													? "Pembayaran gagal dimuat."
													: "Tidak ada pembayaran yang menunggu konfirmasi."}
										</td>
									</tr>
								) : (
									pendingPayments.map((payment) => (
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
							currentPage={pendingList.page}
							totalPages={pendingList.totalPages}
							totalItems={pendingList.totalItems}
							currentItemCount={pendingPayments.length}
							pageSize={PAGE_SIZE}
							itemLabel="pembayaran"
							loading={pendingList.loading}
							onPageChange={pendingList.setPage}
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
							onClick={() => setQuickDeskMode(value as QuickDeskMode)}
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
					<p className="mt-2 text-3xl font-semibold text-slate-900">{headline(summary?.totalInvoices)}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Jumlah Cicilan</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{headline(summary?.verifiedPayments.count)}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Total Terbayar</p>
					<p className="mt-2 text-2xl font-semibold text-emerald-600">
						{headline(summary?.verifiedPayments.totalAmount, formatRupiah)}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Sisa Tagihan</p>
					<p className="mt-2 text-2xl font-semibold text-rose-600">
						{headline(summary?.totalRemainingAmount, formatRupiah)}
					</p>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4">
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari invoice, toko, pembayaran, atau referensi"
						maxLength={100}
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
								setFilters(defaultFilters);
							}}
							disabled={dataList.loading}
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
						Menampilkan {invoiceRows.length} invoice dari {dataList.totalItems} hasil filter.
					</p>
					<p>
						Halaman {dataList.page} dari {dataList.totalPages}
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
						{invoiceRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={9}>
									{dataList.loading
										? "Memuat invoice pembayaran..."
										: dataList.error
											? "Invoice pembayaran gagal dimuat."
											: "Tidak ada invoice pembayaran terkonfirmasi pada filter ini."}
								</td>
							</tr>
						) : (
							invoiceRows.map((row) => {
								const paymentScope = buildPaymentScope(row, quickDeskMode);
								return (
									<tr key={row.id}>
										<td className="px-4 py-3">
											<div className="font-medium text-slate-900">{row.invoiceNumber}</div>
										</td>
										<td className="px-4 py-3 text-slate-700">{row.storeNameSnapshot}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(paymentScope.lastPaymentDate)}</td>
										<td className="px-4 py-3 text-slate-700">{paymentScope.methodSummary}</td>
										<td className="px-4 py-3 text-right font-semibold text-slate-900">
											{formatRupiah(row.totalAmount)}
										</td>
										<td className="px-4 py-3 text-right text-slate-900">
											{formatRupiah(paymentScope.totalPaid)}
										</td>
										<td className="px-4 py-3 text-right text-slate-900">
											{formatRupiah(row.remainingAmount)}
										</td>
										<td className="px-4 py-3">
											<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceStatusTone[row.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
												{toUiLabel(row.status, invoiceStatusLabel)}
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
					currentPage={dataList.page}
					totalPages={dataList.totalPages}
					totalItems={dataList.totalItems}
					currentItemCount={invoiceRows.length}
					pageSize={PAGE_SIZE}
					itemLabel="invoice"
					loading={dataList.loading}
					onPageChange={dataList.setPage}
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
									{selectedRow.invoiceNumber}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Toko</div>
								<div className="mt-2 font-medium text-slate-900">
									{selectedRow.storeNameSnapshot}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Tanggal Invoice</div>
								<div className="mt-2 font-medium text-slate-900">
									{dateOnly(selectedRow.invoiceDate)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Jatuh Tempo</div>
								<div className="mt-2 font-medium text-slate-900">
									{dateOnly(selectedRow.dueDate)}
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status Invoice</div>
								<div className="mt-2">
									<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceStatusTone[selectedRow.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
									{toUiLabel(selectedRow.status, invoiceStatusLabel)}
									</span>
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Metode Pembayaran</div>
								<div className="mt-2 font-medium text-slate-900">{selectedScope?.methodSummary}</div>
							</div>
						</div>

						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Tagihan</div>
								<div className="mt-2 text-lg font-semibold text-slate-900">
									{formatRupiah(selectedRow.totalAmount)}
								</div>
							</div>
							<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Terbayar</div>
								<div className="mt-2 text-lg font-semibold text-emerald-700">
									{formatRupiah(selectedScope?.totalPaid ?? 0)}
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
										{(selectedRow.payments ?? []).map((payment) => (
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
													{payment.referenceNo ?? "-"}
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

						{selectedRow.notes ? (
							<div className="rounded-xl border border-slate-200 p-3">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan Invoice</div>
								<div className="mt-2 text-slate-700">{selectedRow.notes}</div>
							</div>
						) : null}
					</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
