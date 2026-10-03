"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import { useServerValue } from "@/hooks/useServerValue";
import { getApiErrorMessage } from "@/lib/api-errors";
import { witaDayStartIso, witaPeriodRange } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import { logError } from "@/lib/log";
import {
	deliveryOrderStatusLabel,
	invoiceStatusLabel,
	paymentMethodLabel,
	paymentStatusLabel,
	statusTone as semanticStatusTone,
	toUiLabel,
	type StatusTone,
} from "@/lib/ui-labels";
import { gradeService, type StoreGradeItem } from "@/services/grade";
import {
	invoicesService,
	type InvoiceFilterParams,
	type InvoiceListItem,
	type InvoiceStatus,
} from "@/services/invoices";
import type { OrderItem } from "@/services/orders";
import { paymentsService, type Payment } from "@/services/payments";

type DetailSource = "grade" | "sales" | "toko";
type ViewMode = "summary" | "detail";
type StatusKey = "OPEN" | "PAID" | "OVERDUE";
type StatusFilter = "ALL" | StatusKey;

interface StoreGradeTransactionPageProps {
	/** Kosong untuk toko: server mengunci ke tokonya sendiri. */
	storeId: string;
	source?: DetailSource;
}

interface TransactionRow {
	id: string;
	orderNumber: string;
	items: OrderItem[];
	documentNumber: string;
	documentDate: string;
	totalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	statusKey: StatusKey;
	statusLabel: string;
	deliveryStatusLabel: string;
}

const formatDate = (value?: string | null) => {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
	return new Intl.DateTimeFormat("id-ID", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date);
};

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

/** Angka headline: "—" selama ringkasan belum ada (memuat atau gagal), bukan 0 yang menyesatkan. */
const headline = (value: number | undefined, format: (value: number) => string | number = (v) => v) =>
	value === undefined ? "—" : format(value);

const gradeTone = (grade?: StoreGradeItem["grade"]) => {
	if (grade === "N") return "bg-brand-100 text-brand-700";
	if (grade === "A+") return "border border-emerald-300 bg-emerald-100 text-emerald-800";
	if (grade === "A") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
	if (grade === "B+") return "border border-sky-300 bg-sky-100 text-sky-800";
	if (grade === "B") return "bg-sky-100 text-sky-700";
	if (grade === "C+") return "border border-amber-300 bg-amber-100 text-amber-800";
	if (grade === "C") return "border border-amber-200 bg-amber-50 text-amber-700";
	return "border border-rose-200 bg-rose-50 text-rose-700";
};

const statusTone: Record<StatusKey, StatusTone> = {
	OPEN: "warning",
	PAID: "success",
	OVERDUE: "danger",
};

const PAGE_SIZE = 20;
// Invoice batal tidak pernah masuk laporan transaksi toko.
const ACTIVE_STATUSES: InvoiceStatus[] = ["UNPAID", "PARTIAL", "PAID"];
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) =>
	new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(2000, index, 1)),
);

const backHrefBySource: Record<DetailSource, string> = {
	grade: "/grade-toko",
	sales: "/sales/grade-toko",
	toko: "/toko/grade-saya",
};

/**
 * Lencana per baris saja; filter dan hitungan OVERDUE diputuskan server (`paymentState`).
 * Aturannya sama dengan server: sisa > 0 dan jatuh tempo sebelum 00:00 WITA hari ini.
 */
const resolveStatus = (invoice: InvoiceListItem, overdueBefore?: string): { statusKey: StatusKey; statusLabel: string } => {
	if (invoice.status === "PAID") return { statusKey: "PAID", statusLabel: "Lunas" };
	if (overdueBefore && invoice.dueDate && invoice.remainingAmount > 0 && new Date(invoice.dueDate).getTime() < Date.parse(overdueBefore)) {
		return { statusKey: "OVERDUE", statusLabel: "Lewat Jatuh Tempo" };
	}
	return { statusKey: "OPEN", statusLabel: toUiLabel(invoice.status, invoiceStatusLabel) };
};

const toRow = (invoice: InvoiceListItem, overdueBefore?: string): TransactionRow => {
	const items = invoice.order?.items ?? [];
	return {
		id: invoice.id,
		orderNumber: invoice.order?.orderNumber ?? "-",
		items,
		documentNumber: invoice.invoiceNumber,
		documentDate: invoice.invoiceDate,
		totalAmount: invoice.totalAmount,
		paidAmount: invoice.paidAmount,
		remainingAmount: invoice.remainingAmount,
		...resolveStatus(invoice, overdueBefore),
		deliveryStatusLabel: invoice.deliveryOrder?.status
			? toUiLabel(invoice.deliveryOrder.status, deliveryOrderStatusLabel)
			: "-",
	};
};

export default function StoreGradeTransactionPage({
	storeId,
	source = "grade",
}: StoreGradeTransactionPageProps) {
	const [grade, setGrade] = useState<StoreGradeItem | null>(null);
	const [gradeError, setGradeError] = useState("");
	const [gradeTick, setGradeTick] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("summary");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search.trim());
	const [selectedYear, setSelectedYear] = useState<number | "ALL">("ALL");
	const [selectedMonth, setSelectedMonth] = useState<number | "ALL">("ALL");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
	const [selectedRow, setSelectedRow] = useState<TransactionRow | null>(null);
	const [showAllPayments, setShowAllPayments] = useState(false);

	useEffect(() => {
		let active = true;
		(source === "toko"
			? gradeService.listForToko()
			: source === "sales"
				? gradeService.listForSales()
				: gradeService.list()
		)
			.then((gradeRows) => {
				if (!active) return;
				setGrade(gradeRows.find((item) => item.storeId === storeId) ?? gradeRows[0] ?? null);
				setGradeError("");
			})
			.catch((cause: unknown) => {
				if (!active) return;
				setGradeError(getApiErrorMessage(cause, "Gagal memuat grade toko."));
				logError("Gagal memuat grade toko.", cause);
			});
		return () => { active = false; };
	}, [gradeTick, source, storeId]);

	// StoreScope di server: toko dikunci ke tokonya, sales hanya toko yang di-assign.
	const storeParam = storeId || undefined;
	// R32: bulan selalu bersama tahun; "Semua tahun" menonaktifkan pilihan bulan.
	const period =
		selectedYear === "ALL"
			? {}
			: witaPeriodRange(selectedYear, selectedMonth === "ALL" ? undefined : selectedMonth);
	const rowFilters: InvoiceFilterParams = {
		storeId: storeParam,
		status: ACTIVE_STATUSES,
		paymentState: statusFilter === "ALL" ? undefined : statusFilter,
		...period,
		search: debouncedSearch || undefined,
	};
	const filterKey = `${storeId}|${debouncedSearch}|${selectedYear}|${selectedMonth}|${statusFilter}`;

	const list = usePagedList(
		async (page, limit) => {
			const result = await invoicesService.list({ ...rowFilters, page, limit, sortBy: "invoiceDate", sortOrder: "desc" });
			const overdueBefore = witaDayStartIso(new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10));
			return { ...result, items: result.items.map((invoice) => toRow(invoice, overdueBefore)) };
		},
		{ filterKey, errorMessage: "Gagal memuat detail transaksi toko.", pageSize: PAGE_SIZE },
	);
	const summaryState = useServerValue(() => invoicesService.summary(rowFilters), {
		key: filterKey,
		errorMessage: "Gagal memuat ringkasan transaksi toko.",
	});
	// Grafik bulanan dan pilihan tahun memakai seluruh transaksi toko, bukan hasil filter.
	const overallState = useServerValue(
		() => invoicesService.summary({ storeId: storeParam, status: ACTIVE_STATUSES }),
		{ key: storeId, errorMessage: "Gagal memuat riwayat bulanan toko." },
	);

	// Riwayat pembayaran (semua status) dimuat saat baris dibuka; daftar invoice hanya membawa yang VERIFIED.
	const selectedId = selectedRow?.id ?? "";
	const paymentsState = useServerValue(
		async () =>
			selectedId
				? {
						invoiceId: selectedId,
						// ponytail: satu halaman 100 pembayaran per invoice; paging kalau ada invoice yang melewatinya.
						items: (
							await paymentsService.list({
								invoiceId: selectedId,
								page: 1,
								limit: 100,
								sortBy: "paymentDate",
								sortOrder: "desc",
							})
						).items,
					}
				: null,
		{ key: selectedId, errorMessage: "Gagal memuat riwayat pembayaran invoice." },
	);
	const selectedPayments: Payment[] =
		paymentsState.data?.invoiceId === selectedId ? paymentsState.data.items : [];
	const paymentsReady = paymentsState.data?.invoiceId === selectedId;

	const loadError = list.error || summaryState.error || overallState.error || gradeError;
	const retryLoad = () => {
		if (list.error) list.reload();
		if (summaryState.error) summaryState.reload();
		if (overallState.error) overallState.reload();
		if (gradeError) setGradeTick((tick) => tick + 1);
	};

	const rows = list.items;

	const monthly = useMemo(() => overallState.data?.monthly ?? [], [overallState.data]);
	const availableYears = useMemo(
		() => Array.from(new Set(monthly.map((row) => Number(row.month.slice(0, 4))))).sort((left, right) => right - left),
		[monthly],
	);

	const summary = summaryState.data;

	const monthlyRows = useMemo(() => {
		const targetYear = selectedYear === "ALL" ? availableYears[0] ?? new Date().getFullYear() : selectedYear;
		return monthly
			.filter((row) => row.month.startsWith(`${targetYear}-`))
			.map((row) => {
				const value = Number(row.month.slice(5, 7));
				return {
					value,
					label: MONTH_LABELS[value - 1],
					totalTransaksi: row.totalInvoices,
					totalNilai: row.totalAmount,
					totalSisa: row.totalRemainingAmount,
				};
			});
	}, [availableYears, monthly, selectedYear]);

	const monthlyColumns: ResponsiveColumn<(typeof monthlyRows)[number]>[] = [
		{ key: "label", head: "Bulan", role: "title" },
		{
			key: "totalNilai",
			head: "Nilai",
			role: "amount",
			align: "right",
			render: (row) => formatRupiah(row.totalNilai),
		},
		{ key: "totalTransaksi", head: "Transaksi", align: "right" },
		{
			key: "totalSisa",
			head: "Sisa",
			align: "right",
			render: (row) => (
				<span className="font-semibold text-rose-700">{formatRupiah(row.totalSisa)}</span>
			),
		},
	];

	const detailColumns: ResponsiveColumn<TransactionRow>[] = [
		{ key: "documentNumber", head: "Dokumen", role: "title" },
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (row) => <Badge tone={statusTone[row.statusKey]}>{row.statusLabel}</Badge>,
		},
		{
			key: "remainingAmount",
			head: "Sisa",
			role: "amount",
			align: "right",
			render: (row) => (
				<span className="font-semibold text-rose-700">{formatRupiah(row.remainingAmount)}</span>
			),
		},
		{ key: "documentDate", head: "Tanggal", render: (row) => formatDate(row.documentDate) },
		{
			key: "totalAmount",
			head: "Total",
			align: "right",
			render: (row) => formatRupiah(row.totalAmount),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (row) => (
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						setSelectedRow(row);
						setShowAllPayments(false);
					}}
				>
					Detail Item
				</Button>
			),
		},
	];

	const orderItemColumns: ResponsiveColumn<OrderItem>[] = [
		{
			key: "product",
			head: "Barang",
			role: "title",
			render: (item) => item.productNameSnapshot || item.product?.name || "Produk",
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

	const paymentColumns: ResponsiveColumn<Payment>[] = [
		{
			key: "paymentNumber",
			head: "Pembayaran",
			role: "title",
			render: (payment) => payment.paymentNumber ?? "-",
		},
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (payment) => (
				<Badge tone={semanticStatusTone(payment.status)}>
					{toUiLabel(payment.status, paymentStatusLabel)}
				</Badge>
			),
		},
		{
			key: "amount",
			head: "Nominal",
			role: "amount",
			align: "right",
			render: (payment) => formatRupiah(payment.amount),
		},
		{
			key: "paymentDate",
			head: "Tanggal",
			render: (payment) => formatDate(payment.paymentDate),
		},
		{
			key: "method",
			head: "Metode",
			render: (payment) => toUiLabel(payment.method, paymentMethodLabel),
		},
		{
			key: "reference",
			head: "Referensi",
			render: (payment) => payment.referenceNo ?? payment.referenceNumber ?? "-",
		},
		{
			key: "notes",
			head: "Catatan",
			render: (payment) => payment.notes || payment.proofNotes || "-",
		},
	];

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<Link href={backHrefBySource[source]} className="text-sm font-semibold text-sky-700">
							Kembali ke Grade Toko
						</Link>
						<div className="mt-4 flex flex-wrap items-center gap-3">
							<h1 className="text-2xl font-semibold text-slate-900">
								{grade?.storeName || "Detail Transaksi Toko"}
							</h1>
							<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gradeTone(grade?.grade)}`}>
								Grade {grade?.grade ?? "-"}
							</span>
						</div>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
							Laporan ini menggabungkan pesanan, faktur, pembayaran, pengiriman, dan rincian item agar alur transaksi toko lebih mudah ditelusuri.
						</p>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Periode Evaluasi Grade</p>
							<p className="mt-2 font-semibold text-slate-900">
								{dateOnly(grade?.evaluationWindowStart)} s.d. {dateOnly(grade?.evaluationWindowEnd)}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan Grade</p>
							<p className="mt-2 text-sm font-medium text-slate-700">{grade?.gradeReason ?? "-"}</p>
						</div>
					</div>
				</div>
			</section>

			{/* Galat muat tidak bisa ditutup: tanpanya tabel tampak kosong atau angka tampak "—" tanpa sebab. */}
			<PageFeedback error={loadError} onRetry={retryLoad} />

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Total Transaksi", value: headline(summary?.totalInvoices) },
					{ label: "Total Nilai", value: headline(summary?.totalAmount, formatRupiah) },
					{ label: "Total Item", value: headline(summary?.totalItems) },
					{ label: "Sisa Tagihan", value: headline(summary?.totalRemainingAmount, formatRupiah) },
				].map((item) => (
					<div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-lg font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center">
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Cari nomor dokumen, barang, referensi pembayaran"
						maxLength={100}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500"
					/>
					<select
						value={selectedYear}
						onChange={(event) => {
							const year = event.target.value === "ALL" ? "ALL" : Number(event.target.value);
							setSelectedYear(year);
							if (year === "ALL") setSelectedMonth("ALL");
						}}
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Tahun</option>
						{availableYears.map((year) => (
							<option key={year} value={year}>{year}</option>
						))}
					</select>
					<select
						value={selectedMonth}
						onChange={(event) =>
							setSelectedMonth(event.target.value === "ALL" ? "ALL" : Number(event.target.value))
						}
						// R32: bulan hanya berarti bersama tahun (dateFrom/dateTo).
						disabled={selectedYear === "ALL"}
						title={selectedYear === "ALL" ? "Pilih tahun dulu untuk memfilter bulan" : undefined}
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
					>
						<option value="ALL">Semua Bulan</option>
						{MONTH_LABELS.map((label, index) => (
							<option key={label} value={index + 1}>{label}</option>
						))}
					</select>
					<select
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Status</option>
						<option value="OPEN">Berjalan</option>
						<option value="PAID">Lunas</option>
						<option value="OVERDUE">Lewat Tempo</option>
					</select>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Laporan Transaksi Toko</h2>
						<p className="mt-1 text-sm text-slate-500">
							Menampilkan {list.totalItems} transaksi dari total{" "}
							{headline(overallState.data?.totalInvoices)} transaksi toko ini.
						</p>
					</div>
					<div className="flex gap-2">
						{[
							{ key: "summary" as const, label: "Ringkasan" },
							{ key: "detail" as const, label: "Detail Lengkap" },
						].map((mode) => (
							<button
								key={mode.key}
								type="button"
								onClick={() => setViewMode(mode.key)}
								className={`rounded-xl px-4 py-2 text-sm font-semibold ${
									viewMode === mode.key
										? "bg-brand-700 text-white"
										: "border border-slate-200 text-slate-700 hover:bg-slate-50"
								}`}
							>
								{mode.label}
							</button>
						))}
					</div>
				</div>

				{viewMode === "summary" ? (
					<div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
						<div className="space-y-3">
							{[
								{ label: "Terbayar", value: headline(summary?.totalPaidAmount, formatRupiah) },
								{ label: "Piutang", value: headline(summary?.totalRemainingAmount, formatRupiah) },
								{ label: "Jumlah Transaksi", value: headline(summary?.totalInvoices) },
								{ label: "Transaksi Lunas", value: headline(summary?.paidCount) },
								{ label: "Lewat Jatuh Tempo", value: headline(summary?.overdueCount) },
							].map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
									<p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
								</div>
							))}
						</div>
						<ResponsiveTable
							columns={monthlyColumns}
							data={monthlyRows}
							getRowKey={(row) => String(row.value)}
							loading={overallState.loading}
							skeletonRows={3}
							emptyText={overallState.error ? "Riwayat bulanan gagal dimuat" : "Tidak ada transaksi pada periode ini"}
						/>
					</div>
				) : null}

				{viewMode === "detail" ? (
					<div>
						<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
							<p>
								Menampilkan {rows.length} dari {list.totalItems} transaksi.
							</p>
							<p>
								Halaman {list.page} dari {list.totalPages}
							</p>
						</div>
						<ResponsiveTable
							columns={detailColumns}
							data={rows}
							getRowKey={(row) => row.id}
							loading={list.loading}
							onRowClick={(row) => {
								setSelectedRow(row);
								setShowAllPayments(false);
							}}
							emptyText={list.error ? "Transaksi gagal dimuat" : "Tidak ada transaksi sesuai filter"}
							emptyDescription="Coba ubah periode, status, atau kata kunci pencarian."
						/>
						<PaginationControls
							currentPage={list.page}
							totalPages={list.totalPages}
							totalItems={list.totalItems}
							currentItemCount={rows.length}
							pageSize={PAGE_SIZE}
							itemLabel="transaksi"
							loading={list.loading}
							onPageChange={list.setPage}
						/>
					</div>
				) : null}
			</section>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => {
					setSelectedRow(null);
					setShowAllPayments(false);
				}}
				title="Detail Transaksi"
				maxWidthClassName="max-w-6xl"
			>
				{selectedRow ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
							<p><span className="font-semibold">Faktur:</span> {selectedRow.documentNumber}</p>
							<p><span className="font-semibold">Tanggal:</span> {formatDate(selectedRow.documentDate)}</p>
							<p><span className="font-semibold">Status:</span> {selectedRow.statusLabel}</p>
							<p><span className="font-semibold">Pesanan:</span> {selectedRow.orderNumber}</p>
							<p>
								<span className="font-semibold">Pengiriman:</span>{" "}
								{selectedRow.deliveryStatusLabel === "-" ? "Belum ada pengiriman" : selectedRow.deliveryStatusLabel}
							</p>
						</div>

						<ResponsiveTable
							columns={orderItemColumns}
							data={selectedRow.items}
							getRowKey={(item) => item.id}
							emptyText="Tidak ada item pada transaksi ini"
						/>

						<div className="rounded-xl border border-slate-200 p-4">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ringkasan Nilai</p>
									<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:min-w-[34rem]">
										<div className="rounded-lg bg-slate-50 px-3 py-2">
											<p className="text-xs text-slate-500">Total</p>
											<p className="font-semibold text-slate-900">{formatRupiah(selectedRow.totalAmount)}</p>
										</div>
										<div className="rounded-lg bg-emerald-50 px-3 py-2">
											<p className="text-xs text-emerald-700">Terbayar</p>
											<p className="font-semibold text-emerald-700">{formatRupiah(selectedRow.paidAmount)}</p>
										</div>
										<div className="rounded-lg bg-rose-50 px-3 py-2">
											<p className="text-xs text-rose-700">Sisa</p>
											<p className="font-semibold text-rose-700">{formatRupiah(selectedRow.remainingAmount)}</p>
										</div>
									</div>
								</div>
								<div className="flex flex-col items-start gap-2 lg:items-end">
									<button
										type="button"
										onClick={() => setShowAllPayments((current) => !current)}
										disabled={!selectedPayments.length}
										className="inline-flex w-fit items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{showAllPayments
											? "Tutup riwayat pembayaran"
											: paymentsState.loading
												? "Memuat riwayat pembayaran..."
												: paymentsReady
													? `Lihat riwayat pembayaran (${selectedPayments.length})`
													: "Lihat riwayat pembayaran"}
									</button>
									{paymentsState.error && !paymentsReady ? (
										<p className="text-xs text-rose-700">
											Riwayat pembayaran gagal dimuat.{" "}
											<button type="button" onClick={paymentsState.reload} className="font-semibold underline">
												Coba lagi
											</button>
										</p>
									) : paymentsReady && !selectedPayments.length ? (
										<p className="text-xs text-slate-500">Belum ada pembayaran untuk invoice ini.</p>
									) : null}
								</div>
							</div>
						</div>

						{showAllPayments && selectedPayments.length ? (
							<div className="rounded-xl border border-slate-200">
								<div className="border-b border-slate-100 px-4 py-3">
									<h3 className="font-medium text-slate-900">Riwayat Pembayaran Invoice</h3>
									<p className="mt-1 text-xs text-slate-500">
										Menampilkan semua pembayaran yang merujuk ke invoice {selectedRow.documentNumber}.
									</p>
								</div>
								<ResponsiveTable
									columns={paymentColumns}
									data={selectedPayments}
									getRowKey={(payment) => payment.id}
									emptyText="Belum ada pembayaran"
								/>
							</div>
						) : null}
					</div>
				) : null}
			</Modal>
		</div>
	);
}
