"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/shared/Modal";
import PaginationControls from "@/components/shared/PaginationControls";
import { formatLocalDateInput } from "@/lib/datetime";
import {
	deliveryOrderStatusLabel,
	invoiceStatusLabel,
	paymentMethodLabel,
	paymentStatusLabel,
	toUiLabel,
} from "@/lib/ui-labels";
import { gradeService, type StoreGradeItem } from "@/services/grade";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";
import { paymentsService, type Payment } from "@/services/payments";

type DetailSource = "grade" | "sales" | "toko";
type ViewMode = "summary" | "detail";
type StatusFilter = "ALL" | "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";

interface StoreGradeTransactionPageProps {
	storeId: string;
	source?: DetailSource;
}

interface TransactionRow {
	id: string;
	order: OrderListItem;
	invoice: InvoiceListItem | null;
	payments: Payment[];
	documentNumber: string;
	documentDate: string;
	dueDate?: string | null;
	totalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	itemCount: number;
	statusKey: StatusFilter;
	statusLabel: string;
	deliveryStatusLabel: string;
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

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

const getTimestamp = (value?: string | null) => {
	const timestamp = new Date(String(value || "")).getTime();
	return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getYear = (value?: string | null) => {
	const date = new Date(String(value || ""));
	return Number.isNaN(date.getTime()) ? null : date.getFullYear();
};

const gradeTone = (grade?: StoreGradeItem["grade"]) => {
	if (grade === "N") return "bg-violet-100 text-violet-700";
	if (grade === "A+") return "border border-emerald-300 bg-emerald-100 text-emerald-800";
	if (grade === "A") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
	if (grade === "B+") return "border border-sky-300 bg-sky-100 text-sky-800";
	if (grade === "B") return "bg-sky-100 text-sky-700";
	if (grade === "C+") return "border border-amber-300 bg-amber-100 text-amber-800";
	if (grade === "C") return "border border-amber-200 bg-amber-50 text-amber-700";
	return "border border-rose-200 bg-rose-50 text-rose-700";
};

const statusTone: Record<StatusFilter, string> = {
	ALL: "border border-slate-200 bg-slate-50 text-slate-700",
	OPEN: "border border-amber-200 bg-amber-50 text-amber-700",
	PAID: "border border-emerald-200 bg-emerald-50 text-emerald-700",
	OVERDUE: "border border-rose-200 bg-rose-50 text-rose-700",
	CANCELLED: "bg-slate-200 text-slate-600",
};

const PAGE_SIZE = 10;

const backHrefBySource: Record<DetailSource, string> = {
	grade: "/grade-toko",
	sales: "/sales/grade-toko",
	toko: "/toko/grade-saya",
};

const resolveStatus = (invoice: InvoiceListItem): {
	statusKey: StatusFilter;
	statusLabel: string;
} => {
	if (invoice.status === "CANCELLED") {
		return { statusKey: "CANCELLED", statusLabel: "Dibatalkan" };
	}
	if (invoice.status === "PAID") {
		return { statusKey: "PAID", statusLabel: "Lunas" };
	}
	if (invoice.dueDate && invoice.remainingAmount > 0 && dateOnly(invoice.dueDate) < formatLocalDateInput()) {
		return { statusKey: "OVERDUE", statusLabel: "Lewat Jatuh Tempo" };
	}
	return { statusKey: "OPEN", statusLabel: toUiLabel(invoice.status, invoiceStatusLabel) };
};

export default function StoreGradeTransactionPage({
	storeId,
	source = "grade",
}: StoreGradeTransactionPageProps) {
	const [grade, setGrade] = useState<StoreGradeItem | null>(null);
	const [rows, setRows] = useState<TransactionRow[]>([]);
	const [viewMode, setViewMode] = useState<ViewMode>("summary");
	const [search, setSearch] = useState("");
	const [selectedYear, setSelectedYear] = useState<number | "ALL">("ALL");
	const [selectedMonth, setSelectedMonth] = useState<number | "ALL">("ALL");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
	const [detailPage, setDetailPage] = useState(1);
	const [selectedRow, setSelectedRow] = useState<TransactionRow | null>(null);
	const [showAllPayments, setShowAllPayments] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const gradeRows =
				source === "toko"
					? await gradeService.listForToko()
					: source === "sales"
						? await gradeService.listForSales()
						: await gradeService.list();
			const selectedGrade = gradeRows.find((item) => item.storeId === storeId) ?? gradeRows[0] ?? null;
			setGrade(selectedGrade);

			const [orderRows, invoiceRows, paymentRows] = source === "toko"
				? await Promise.all([
						ordersService.listAllForToko({ sortBy: "documentDate", sortOrder: "desc" }),
						invoicesService.listAllForToko({ sortBy: "invoiceDate", sortOrder: "desc" }),
						paymentsService.listAllForToko({ sortBy: "paymentDate", sortOrder: "desc" }),
					])
				: source === "sales"
					? await Promise.all([
							ordersService.listAllForSales({ storeId, sortBy: "documentDate", sortOrder: "desc" }),
							invoicesService.listAllForSales({ storeId, sortBy: "invoiceDate", sortOrder: "desc" }),
							paymentsService.listAllForSales({ storeId, sortBy: "paymentDate", sortOrder: "desc" }),
						])
					: await Promise.all([
							ordersService.listAll({ storeId }),
							invoicesService.listAll({ storeId, sortBy: "invoiceDate", sortOrder: "desc" }),
							paymentsService.listAll({ storeId, sortBy: "paymentDate", sortOrder: "desc" }),
						]);

			const ordersById = new Map(orderRows.map((order) => [order.id, order]));
			const paymentsByInvoice = paymentRows.reduce<Record<string, Payment[]>>((acc, payment) => {
				acc[payment.invoiceId] = [...(acc[payment.invoiceId] ?? []), payment];
				return acc;
			}, {});

			const nextRows = invoiceRows
				.flatMap((invoice): TransactionRow[] => {
					const order =
						ordersById.get(invoice.orderId) ??
						(invoice.order
							? ({
									id: invoice.order.id,
									orderNumber: invoice.order.orderNumber,
									documentDate: invoice.order.documentDate,
									status: invoice.order.status as OrderListItem["status"],
									storeId: invoice.storeId,
									storeNameSnapshot: invoice.storeNameSnapshot,
									totalAmount: invoice.totalAmount,
									items: [],
								} satisfies OrderListItem)
							: null);

					if (!order || order.status === "CANCELLED" || invoice.status === "CANCELLED") {
						return [];
					}

					const payments = paymentsByInvoice[invoice.id] ?? [];
					const paidAmount = invoice.paidAmount;
					const totalAmount = invoice.totalAmount;
					const remainingAmount = invoice.remainingAmount;
					const status = resolveStatus(invoice);

					return [{
						id: invoice.id,
						order,
						invoice,
						payments,
						documentNumber: invoice.invoiceNumber,
						documentDate: invoice.invoiceDate,
						dueDate: invoice.dueDate ?? null,
						totalAmount,
						paidAmount,
						remainingAmount,
						itemCount: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
						statusKey: status.statusKey,
						statusLabel: status.statusLabel,
						deliveryStatusLabel: invoice.deliveryOrder?.status
							? toUiLabel(invoice.deliveryOrder.status, deliveryOrderStatusLabel)
							: "-",
					} satisfies TransactionRow];
				})
				.sort((left, right) => getTimestamp(right.documentDate) - getTimestamp(left.documentDate));

			setRows(nextRows);
		} catch {
			setError("Gagal memuat detail transaksi toko.");
		} finally {
			setLoading(false);
		}
	}, [source, storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const availableYears = useMemo(() => {
		const years = Array.from(new Set(rows.map((row) => getYear(row.documentDate)).filter(Boolean) as number[]));
		return years.sort((left, right) => right - left);
	}, [rows]);

	const monthOptions = useMemo(() => {
		const formatter = new Intl.DateTimeFormat("id-ID", { month: "long" });
		return Array.from({ length: 12 }, (_, index) => ({
			value: index + 1,
			label: formatter.format(new Date(2000, index, 1)),
		}));
	}, []);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return rows.filter((row) => {
			const date = new Date(row.documentDate);
			const matchYear = selectedYear === "ALL" || getYear(row.documentDate) === selectedYear;
			const matchMonth =
				selectedMonth === "ALL" ||
				(!Number.isNaN(date.getTime()) && date.getMonth() + 1 === selectedMonth);
			const matchStatus = statusFilter === "ALL" || row.statusKey === statusFilter;
			const matchSearch =
				!query ||
				row.documentNumber.toLowerCase().includes(query) ||
				row.order.orderNumber.toLowerCase().includes(query) ||
				row.order.items?.some((item) =>
					(item.product?.name || item.productId).toLowerCase().includes(query),
				) ||
				row.payments.some((payment) =>
					(payment.paymentNumber || payment.referenceNo || payment.id).toLowerCase().includes(query),
				);
			return matchYear && matchMonth && matchStatus && matchSearch;
		});
	}, [rows, search, selectedMonth, selectedYear, statusFilter]);
	const detailTotalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
	const detailCurrentPage = Math.min(detailPage, detailTotalPages);
	const paginatedDetailRows = useMemo(() => {
		const start = (detailCurrentPage - 1) * PAGE_SIZE;
		return filteredRows.slice(start, start + PAGE_SIZE);
	}, [detailCurrentPage, filteredRows]);

	const selectedPayments = useMemo(() => {
		if (!selectedRow) return [];
		return [...selectedRow.payments].sort(
			(left, right) => getTimestamp(right.paymentDate) - getTimestamp(left.paymentDate),
		);
	}, [selectedRow]);

	const summary = useMemo(() => {
		const totalNilai = filteredRows.reduce((sum, row) => sum + row.totalAmount, 0);
		const totalTerbayar = filteredRows.reduce((sum, row) => sum + row.paidAmount, 0);
		const totalSisa = filteredRows.reduce((sum, row) => sum + row.remainingAmount, 0);
		const totalItem = filteredRows.reduce((sum, row) => sum + row.itemCount, 0);
		return {
			totalTransaksi: filteredRows.length,
			totalNilai,
			totalTerbayar,
			totalSisa,
			totalItem,
			terlambat: filteredRows.filter((row) => row.statusKey === "OVERDUE").length,
			lunas: filteredRows.filter((row) => row.statusKey === "PAID").length,
		};
	}, [filteredRows]);

	const monthlyRows = useMemo(() => {
		const targetYear = selectedYear === "ALL" ? availableYears[0] ?? new Date().getFullYear() : selectedYear;
		return monthOptions.map((month) => {
			const monthRows = rows.filter((row) => {
				const date = new Date(row.documentDate);
				return (
					!Number.isNaN(date.getTime()) &&
					date.getFullYear() === targetYear &&
					date.getMonth() + 1 === month.value
				);
			});
			return {
				...month,
				totalTransaksi: monthRows.length,
				totalNilai: monthRows.reduce((sum, row) => sum + row.totalAmount, 0),
				totalSisa: monthRows.reduce((sum, row) => sum + row.remainingAmount, 0),
			};
		}).filter((row) => row.totalTransaksi > 0 || row.totalNilai > 0);
	}, [availableYears, monthOptions, rows, selectedYear]);

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

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Total Transaksi", value: summary.totalTransaksi },
					{ label: "Total Nilai", value: formatRupiah(summary.totalNilai) },
					{ label: "Total Item", value: summary.totalItem },
					{ label: "Sisa Tagihan", value: formatRupiah(summary.totalSisa) },
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
						onChange={(event) => {
							setSearch(event.target.value);
							setDetailPage(1);
						}}
						placeholder="Cari nomor dokumen, barang, referensi pembayaran"
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500"
					/>
					<select
						value={selectedYear}
						onChange={(event) => {
							setSelectedYear(event.target.value === "ALL" ? "ALL" : Number(event.target.value));
							setDetailPage(1);
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
						onChange={(event) => {
							setSelectedMonth(event.target.value === "ALL" ? "ALL" : Number(event.target.value));
							setDetailPage(1);
						}}
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Bulan</option>
						{monthOptions.map((month) => (
							<option key={month.value} value={month.value}>{month.label}</option>
						))}
					</select>
					<select
						value={statusFilter}
						onChange={(event) => {
							setStatusFilter(event.target.value as StatusFilter);
							setDetailPage(1);
						}}
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
							Menampilkan {filteredRows.length} transaksi dari total {rows.length} transaksi toko ini.
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
								onClick={() => {
									setViewMode(mode.key);
									if (mode.key === "detail") setDetailPage(1);
								}}
								className={`rounded-xl px-4 py-2 text-sm font-semibold ${
									viewMode === mode.key
										? "bg-indigo-600 text-white"
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
								{ label: "Terbayar", value: formatRupiah(summary.totalTerbayar) },
								{ label: "Piutang", value: formatRupiah(summary.totalSisa) },
								{ label: "Jumlah Transaksi", value: summary.totalTransaksi },
								{ label: "Transaksi Lunas", value: summary.lunas },
								{ label: "Lewat Jatuh Tempo", value: summary.terlambat },
							].map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
									<p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
								</div>
							))}
						</div>
						<div className="overflow-x-auto rounded-xl border border-slate-200">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-4 py-3">Bulan</th>
										<th className="px-4 py-3 text-right">Transaksi</th>
										<th className="px-4 py-3 text-right">Nilai</th>
										<th className="px-4 py-3 text-right">Sisa</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{loading ? (
										<tr><td className="px-4 py-5 text-slate-500" colSpan={4}>Memuat ringkasan...</td></tr>
									) : monthlyRows.length ? (
										monthlyRows.map((row) => (
											<tr key={row.value}>
												<td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
												<td className="px-4 py-3 text-right text-slate-700">{row.totalTransaksi}</td>
												<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(row.totalNilai)}</td>
												<td className="px-4 py-3 text-right text-rose-700">{formatRupiah(row.totalSisa)}</td>
											</tr>
										))
									) : (
										<tr><td className="px-4 py-5 text-slate-500" colSpan={4}>Tidak ada transaksi pada periode ini.</td></tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				) : null}

				{viewMode === "detail" ? (
					<div>
						<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
							<p>
								Menampilkan {paginatedDetailRows.length} dari {filteredRows.length} transaksi.
							</p>
							<p>
								Halaman {detailCurrentPage} dari {detailTotalPages}
							</p>
						</div>
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-4 py-3">Dokumen</th>
										<th className="px-4 py-3">Tanggal</th>
										<th className="px-4 py-3 text-right">Total</th>
										<th className="px-4 py-3 text-right">Sisa</th>
										<th className="px-4 py-3">Status</th>
										<th className="px-4 py-3 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{loading ? (
										<tr><td className="px-4 py-5 text-slate-500" colSpan={6}>Memuat transaksi...</td></tr>
									) : filteredRows.length ? (
										paginatedDetailRows.map((row) => (
											<tr key={row.id}>
												<td className="px-4 py-3">
													<p className="font-semibold text-slate-900">{row.documentNumber}</p>
												</td>
												<td className="px-4 py-3 text-slate-700">
													<p>{formatDate(row.documentDate)}</p>
												</td>
												<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(row.totalAmount)}</td>
												<td className="px-4 py-3 text-right font-semibold text-rose-700">{formatRupiah(row.remainingAmount)}</td>
												<td className="px-4 py-3">
													<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[row.statusKey]}`}>
														{row.statusLabel}
													</span>
												</td>
												<td className="px-4 py-3 text-right">
													<button
														type="button"
														onClick={() => {
															setSelectedRow(row);
															setShowAllPayments(false);
														}}
														className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
													>
														Detail Item
													</button>
												</td>
											</tr>
										))
									) : (
										<tr><td className="px-4 py-5 text-slate-500" colSpan={6}>Tidak ada transaksi sesuai filter.</td></tr>
									)}
								</tbody>
							</table>
						</div>
						<PaginationControls
							currentPage={detailCurrentPage}
							totalPages={detailTotalPages}
							totalItems={filteredRows.length}
							currentItemCount={paginatedDetailRows.length}
							pageSize={PAGE_SIZE}
							itemLabel="transaksi"
							loading={loading}
							onPageChange={setDetailPage}
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
							<p><span className="font-semibold">Pesanan:</span> {selectedRow.order.orderNumber}</p>
							<p>
								<span className="font-semibold">Pengiriman:</span>{" "}
								{selectedRow.deliveryStatusLabel === "-" ? "Belum ada pengiriman" : selectedRow.deliveryStatusLabel}
							</p>
						</div>

						<div className="overflow-x-auto rounded-xl border border-slate-200">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-4 py-3">Barang</th>
										<th className="px-4 py-3 text-right">Qty</th>
										<th className="px-4 py-3 text-right">Harga</th>
										<th className="px-4 py-3 text-right">Subtotal</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{(selectedRow.order.items ?? []).map((item) => (
										<tr key={item.id}>
											<td className="px-4 py-3 font-medium text-slate-900">{item.product?.name || "Produk"}</td>
											<td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
											<td className="px-4 py-3 text-right text-slate-700">{formatRupiah(item.unitPriceSnapshot)}</td>
											<td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(item.subtotal)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

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
											: `Lihat riwayat pembayaran (${selectedPayments.length})`}
									</button>
									{!selectedPayments.length ? (
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
											{selectedPayments.map((payment) => (
												<tr key={payment.id}>
													<td className="px-4 py-3 font-medium text-slate-900">
														{payment.paymentNumber ?? "-"}
													</td>
													<td className="px-4 py-3 text-slate-700">{formatDate(payment.paymentDate)}</td>
													<td className="px-4 py-3 text-slate-700">
														{toUiLabel(payment.method, paymentMethodLabel)}
													</td>
													<td className="px-4 py-3 text-right font-semibold text-slate-900">
														{formatRupiah(payment.amount)}
													</td>
													<td className="px-4 py-3">
														<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
															payment.status === "VERIFIED"
																? "bg-emerald-50 text-emerald-700"
																: payment.status === "CANCELLED"
																	? "bg-rose-50 text-rose-700"
																	: "bg-amber-50 text-amber-700"
														}`}>
															{toUiLabel(payment.status, paymentStatusLabel)}
														</span>
													</td>
													<td className="px-4 py-3 text-slate-700">
														{payment.referenceNo ?? payment.referenceNumber ?? "-"}
													</td>
													<td className="px-4 py-3 text-slate-700">{payment.notes || payment.proofNotes || "-"}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						) : null}
					</div>
				) : null}
			</Modal>
		</div>
	);
}
