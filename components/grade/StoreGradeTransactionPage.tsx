"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/shared/Modal";
import {
	deliveryOrderStatusLabel,
	invoiceStatusLabel,
	orderStatusLabel,
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
	if (grade === "A") return "bg-emerald-100 text-emerald-700";
	if (grade === "B") return "bg-sky-100 text-sky-700";
	if (grade === "C") return "bg-amber-100 text-amber-700";
	if (grade === "D") return "bg-orange-100 text-orange-700";
	return "bg-rose-100 text-rose-700";
};

const statusTone: Record<StatusFilter, string> = {
	ALL: "bg-slate-100 text-slate-700",
	OPEN: "bg-amber-100 text-amber-700",
	PAID: "bg-emerald-100 text-emerald-700",
	OVERDUE: "bg-rose-100 text-rose-700",
	CANCELLED: "bg-slate-200 text-slate-600",
};

const backHrefBySource: Record<DetailSource, string> = {
	grade: "/grade-toko",
	sales: "/sales/grade-toko",
	toko: "/toko/grade-saya",
};

const resolveStatus = (order: OrderListItem, invoice: InvoiceListItem | null): {
	statusKey: StatusFilter;
	statusLabel: string;
} => {
	if (order.status === "CANCELLED" || invoice?.status === "CANCELLED") {
		return { statusKey: "CANCELLED", statusLabel: "Dibatalkan" };
	}
	if (invoice?.status === "PAID") {
		return { statusKey: "PAID", statusLabel: "Lunas" };
	}
	if (invoice?.dueDate && invoice.remainingAmount > 0 && dateOnly(invoice.dueDate) < dateOnly(new Date().toISOString())) {
		return { statusKey: "OVERDUE", statusLabel: "Lewat Jatuh Tempo" };
	}
	if (invoice) {
		return { statusKey: "OPEN", statusLabel: toUiLabel(invoice.status, invoiceStatusLabel) };
	}
	return { statusKey: "OPEN", statusLabel: toUiLabel(order.status, orderStatusLabel) };
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
	const [selectedRow, setSelectedRow] = useState<TransactionRow | null>(null);
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

			const [orderRows, invoiceRows, paymentRows] =
				source === "toko"
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

			const invoicesByOrder = new Map(invoiceRows.map((invoice) => [invoice.orderId, invoice]));
			const paymentsByInvoice = paymentRows.reduce<Record<string, Payment[]>>((acc, payment) => {
				acc[payment.invoiceId] = [...(acc[payment.invoiceId] ?? []), payment];
				return acc;
			}, {});

			const nextRows = orderRows
				.map((order) => {
					const invoice = invoicesByOrder.get(order.id) ?? null;
					const payments = invoice ? paymentsByInvoice[invoice.id] ?? [] : [];
					const paidAmount = invoice?.paidAmount ?? payments
						.filter((payment) => payment.status === "VERIFIED")
						.reduce((sum, payment) => sum + payment.amount, 0);
					const totalAmount = invoice?.totalAmount ?? order.totalAmount;
					const remainingAmount = invoice?.remainingAmount ?? Math.max(0, totalAmount - paidAmount);
					const status = resolveStatus(order, invoice);

					return {
						id: order.id,
						order,
						invoice,
						payments,
						documentNumber: invoice?.invoiceNumber ?? order.orderNumber,
						documentDate: invoice?.invoiceDate ?? order.documentDate,
						dueDate: invoice?.dueDate ?? null,
						totalAmount,
						paidAmount,
						remainingAmount,
						itemCount: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
						statusKey: status.statusKey,
						statusLabel: status.statusLabel,
						deliveryStatusLabel: invoice?.deliveryOrder?.status
							? toUiLabel(invoice.deliveryOrder.status, deliveryOrderStatusLabel)
							: "-",
					} satisfies TransactionRow;
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
							<span className={`rounded-full px-3 py-1 text-xs font-semibold ${gradeTone(grade?.grade)}`}>
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
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Cari nomor dokumen, barang, referensi pembayaran"
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500"
					/>
					<select
						value={selectedYear}
						onChange={(event) => setSelectedYear(event.target.value === "ALL" ? "ALL" : Number(event.target.value))}
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Tahun</option>
						{availableYears.map((year) => (
							<option key={year} value={year}>{year}</option>
						))}
					</select>
					<select
						value={selectedMonth}
						onChange={(event) => setSelectedMonth(event.target.value === "ALL" ? "ALL" : Number(event.target.value))}
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Bulan</option>
						{monthOptions.map((month) => (
							<option key={month.value} value={month.value}>{month.label}</option>
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
						<option value="CANCELLED">Dibatalkan</option>
					</select>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Muat Ulang
					</button>
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
								onClick={() => setViewMode(mode.key)}
								className={`rounded-xl px-4 py-2 text-sm font-semibold ${
									viewMode === mode.key
										? "bg-slate-900 text-white"
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
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-4 py-3">Dokumen</th>
									<th className="px-4 py-3">Tanggal</th>
									<th className="px-4 py-3">Item</th>
									<th className="px-4 py-3 text-right">Total</th>
									<th className="px-4 py-3 text-right">Terbayar</th>
									<th className="px-4 py-3 text-right">Sisa</th>
									<th className="px-4 py-3">Status</th>
									<th className="px-4 py-3 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{loading ? (
									<tr><td className="px-4 py-5 text-slate-500" colSpan={8}>Memuat transaksi...</td></tr>
								) : filteredRows.length ? (
									filteredRows.map((row) => (
										<tr key={row.id}>
											<td className="px-4 py-3">
												<p className="font-semibold text-slate-900">{row.documentNumber}</p>
												<p className="text-xs text-slate-500">Pesanan: {row.order.orderNumber}</p>
											</td>
											<td className="px-4 py-3 text-slate-700">
												<p>{formatDate(row.documentDate)}</p>
												<p className="text-xs text-slate-500">Jatuh tempo: {formatDate(row.dueDate)}</p>
											</td>
											<td className="px-4 py-3 text-slate-700">
												{(row.order.items ?? []).slice(0, 2).map((item) => item.product?.name || item.productId).join(", ") || "-"}
												{(row.order.items ?? []).length > 2 ? ` +${(row.order.items ?? []).length - 2} item` : ""}
											</td>
											<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(row.totalAmount)}</td>
											<td className="px-4 py-3 text-right text-emerald-700">{formatRupiah(row.paidAmount)}</td>
											<td className="px-4 py-3 text-right font-semibold text-rose-700">{formatRupiah(row.remainingAmount)}</td>
											<td className="px-4 py-3">
												<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[row.statusKey]}`}>
													{row.statusLabel}
												</span>
												<p className="mt-1 text-xs text-slate-500">DO: {row.deliveryStatusLabel}</p>
											</td>
											<td className="px-4 py-3 text-right">
												<button
													type="button"
													onClick={() => setSelectedRow(row)}
													className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
												>
													Detail Item
												</button>
											</td>
										</tr>
									))
								) : (
									<tr><td className="px-4 py-5 text-slate-500" colSpan={8}>Tidak ada transaksi sesuai filter.</td></tr>
								)}
							</tbody>
						</table>
					</div>
				) : null}
			</section>

			<Modal isOpen={Boolean(selectedRow)} onClose={() => setSelectedRow(null)} title="Detail Transaksi">
				{selectedRow ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
							<p><span className="font-semibold">Dokumen:</span> {selectedRow.documentNumber}</p>
							<p><span className="font-semibold">Tanggal:</span> {formatDate(selectedRow.documentDate)}</p>
							<p><span className="font-semibold">Status:</span> {selectedRow.statusLabel}</p>
							<p><span className="font-semibold">Pesanan:</span> {selectedRow.order.orderNumber}</p>
							<p><span className="font-semibold">Faktur:</span> {selectedRow.invoice?.invoiceNumber ?? "-"}</p>
							<p><span className="font-semibold">Pengiriman:</span> {selectedRow.deliveryStatusLabel}</p>
						</div>

						<div className="overflow-x-auto rounded-xl border border-slate-200">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-4 py-3">Barang</th>
										<th className="px-4 py-3">Kondisi</th>
										<th className="px-4 py-3 text-right">Qty</th>
										<th className="px-4 py-3 text-right">Harga</th>
										<th className="px-4 py-3 text-right">Subtotal</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{(selectedRow.order.items ?? []).map((item) => (
										<tr key={item.id}>
											<td className="px-4 py-3 font-medium text-slate-900">{item.product?.name || item.productId}</td>
											<td className="px-4 py-3 text-slate-700">{item.condition}</td>
											<td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
											<td className="px-4 py-3 text-right text-slate-700">{formatRupiah(item.unitPriceSnapshot)}</td>
											<td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(item.subtotal)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ringkasan Nilai</p>
								<div className="mt-3 space-y-2">
									<p className="flex justify-between"><span>Total</span><span className="font-semibold">{formatRupiah(selectedRow.totalAmount)}</span></p>
									<p className="flex justify-between"><span>Terbayar</span><span className="font-semibold text-emerald-700">{formatRupiah(selectedRow.paidAmount)}</span></p>
									<p className="flex justify-between"><span>Sisa</span><span className="font-semibold text-rose-700">{formatRupiah(selectedRow.remainingAmount)}</span></p>
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Riwayat Pembayaran</p>
								<div className="mt-3 space-y-2">
									{selectedRow.payments.length ? selectedRow.payments.map((payment) => (
										<div key={payment.id} className="rounded-lg bg-slate-50 px-3 py-2">
											<p className="font-semibold text-slate-900">{formatRupiah(payment.amount)}</p>
											<p className="text-xs text-slate-500">
												{formatDate(payment.paymentDate)} - {toUiLabel(payment.method, paymentMethodLabel)} - {toUiLabel(payment.status, paymentStatusLabel)}
											</p>
											<p className="text-xs text-slate-500">Referensi: {payment.referenceNo || payment.referenceNumber || "-"}</p>
										</div>
									)) : (
										<p className="text-slate-500">Belum ada pembayaran.</p>
									)}
								</div>
							</div>
						</div>
					</div>
				) : null}
			</Modal>
		</div>
	);
}
