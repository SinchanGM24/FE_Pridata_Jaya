"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { ExportTriggerButton } from "@/components/reports/ExportTriggerButton";
import {
	reportsService,
	type PaginationMeta,
	type SalesReportFilters,
	type SalesReportInvoice,
	type SalesReportSummary,
} from "@/services/reports";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

const emptySummary: SalesReportSummary = {
	totalInvoices: 0,
	totalAmount: 0,
	totalPaidAmount: 0,
	totalRemainingAmount: 0,
	byStatus: {},
};

type FilterState = {
	search: string;
	status: "ALL" | "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";
	dateFrom: string;
	dateTo: string;
};

const defaultFilters: FilterState = {
	search: "",
	status: "ALL",
	dateFrom: "",
	dateTo: "",
};

export default function DashboardPenjualanPage() {
	const [rows, setRows] = useState<SalesReportInvoice[]>([]);
	const [summary, setSummary] = useState<SalesReportSummary>(emptySummary);
	const [meta, setMeta] = useState<PaginationMeta | undefined>(undefined);
	const [filters, setFilters] = useState<FilterState>(defaultFilters);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

	const toIsoStartOfDay = (date: string) => `${date}T00:00:00.000Z`;
	const toIsoEndOfDay = (date: string) => `${date}T23:59:59.999Z`;

	const buildFilters = (
		source: FilterState,
		pageNumber: number,
	): SalesReportFilters => ({
		page: pageNumber,
		limit: 50,
		sortBy: "invoiceDate",
		sortOrder: "desc",
		search: source.search || undefined,
		status: source.status === "ALL" ? undefined : source.status,
		dateFrom: source.dateFrom ? toIsoStartOfDay(source.dateFrom) : undefined,
		dateTo: source.dateTo ? toIsoEndOfDay(source.dateTo) : undefined,
	});

	const load = async (nextFilters = filters, nextPage = page) => {
		setLoading(true);
		setError("");
		try {
			const result = await reportsService.getSales(buildFilters(nextFilters, nextPage));
			setRows(result.items);
			setSummary(result.summary ?? emptySummary);
			setMeta(result.meta);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat laporan penjualan.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load(defaultFilters, 1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleExport = async (format: "pdf" | "csv") => {
		setExporting(format);
		setError("");
		try {
			const blob = await reportsService.exportSales(format, buildFilters(filters, 1));
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `dashboard-penjualan-${new Date().toISOString().slice(0, 10)}.${format}`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.URL.revokeObjectURL(url);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal export laporan penjualan.");
		} finally {
			setExporting(null);
		}
	};

	const statusCards = useMemo(
		() => [
			{ label: "Unpaid", value: summary.byStatus.UNPAID ?? 0 },
			{ label: "Partial", value: summary.byStatus.PARTIAL ?? 0 },
			{ label: "Paid", value: summary.byStatus.PAID ?? 0 },
			{ label: "Cancelled", value: summary.byStatus.CANCELLED ?? 0 },
		],
		[summary],
	);

	return (
		<FeaturePage
			title="Dashboard Penjualan"
			description="Laporan penjualan akuntan berbasis invoice final. Summary, list transaksi, dan export memakai filter yang sama agar pembacaan angka lebih konsisten."
			actions={[
				{
					label: exporting === "pdf" ? "Export PDF..." : "Export PDF",
					onClick: () => {
						if (exporting) return;
						void handleExport("pdf");
					},
				},
				{
					label: exporting === "csv" ? "Export CSV..." : "Export CSV",
					onClick: () => {
						if (exporting) return;
						void handleExport("csv");
					},
				},
			]}
		>
			<div className="flex justify-end">
				<ExportTriggerButton
					reportType="sales"
					filters={{ ...buildFilters(filters, 1) } as Record<string, unknown>}
					filterSummary={[
						filters.dateFrom && filters.dateTo
							? `Periode: ${filters.dateFrom} s/d ${filters.dateTo}`
							: "Periode: Semua",
						`Status: ${filters.status === "ALL" ? "Semua" : filters.status}`,
						filters.search ? `Pencarian: ${filters.search}` : null,
					]
						.filter(Boolean)
						.join(" • ")}
				/>
			</div>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Total Invoice</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalInvoices}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Nilai Penjualan</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">
						{formatRupiah(summary.totalAmount)}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Terbayar</p>
					<p className="mt-2 text-2xl font-semibold text-emerald-600">
						{formatRupiah(summary.totalPaidAmount)}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Outstanding</p>
					<p className="mt-2 text-2xl font-semibold text-rose-600">
						{formatRupiah(summary.totalRemainingAmount)}
					</p>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-4">
				{statusCards.map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">{item.label}</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari nomor invoice atau toko"
						value={filters.search}
						onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
					/>
					<select
						value={filters.status}
						onChange={(event) =>
							setFilters((prev) => ({
								...prev,
								status: event.target.value as FilterState["status"],
							}))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Status</option>
						<option value="UNPAID">UNPAID</option>
						<option value="PARTIAL">PARTIAL</option>
						<option value="PAID">PAID</option>
						<option value="CANCELLED">CANCELLED</option>
					</select>
					<input
						type="date"
						value={filters.dateFrom}
						onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
					<input
						type="date"
						value={filters.dateTo}
						onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
					<div className="flex flex-wrap items-center gap-2 lg:justify-end">
						<button
							type="button"
							onClick={() => {
								setPage(1);
								void load(filters, 1);
							}}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Terapkan
						</button>
						<button
							type="button"
							onClick={() => {
								setFilters(defaultFilters);
								setPage(1);
								void load(defaultFilters, 1);
							}}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Reset
						</button>
					</div>
				</div>
			</section>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
					<p>
						Menampilkan {rows.length} invoice dari {meta?.totalItems ?? 0} total data.
					</p>
					<p>
						Halaman {meta?.currentPage ?? 1} / {meta?.totalPages ?? 1}
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Sales</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Terbayar</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={7}>
									Memuat laporan penjualan...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={7}>
									Tidak ada invoice pada filter ini.
								</td>
							</tr>
						) : (
							rows.map((invoice) => (
								<tr key={invoice.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{invoice.invoiceNumber}</div>
										<div className="text-xs text-slate-500">
											{dateOnly(invoice.invoiceDate)} • jatuh tempo {dateOnly(invoice.dueDate)}
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{invoice.storeNameSnapshot || "-"}</td>
									<td className="px-4 py-3 text-slate-700">
										{invoice.store?.assignedSalesUser?.name ?? "Belum ditugaskan"}
									</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
											{invoice.status}
										</span>
									</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(invoice.totalAmount)}
									</td>
									<td className="px-4 py-3 text-right text-emerald-700">
										{formatRupiah(invoice.paidAmount)}
									</td>
									<td className="px-4 py-3 text-right font-medium text-rose-700">
										{formatRupiah(invoice.remainingAmount)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
				<div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
					<button
						type="button"
						onClick={() => {
							const nextPage = Math.max(1, page - 1);
							setPage(nextPage);
							void load(filters, nextPage);
						}}
						disabled={loading || page <= 1}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Sebelumnya
					</button>
					<button
						type="button"
						onClick={() => {
							const totalPages = meta?.totalPages ?? 1;
							const nextPage = Math.min(totalPages, page + 1);
							setPage(nextPage);
							void load(filters, nextPage);
						}}
						disabled={loading || page >= (meta?.totalPages ?? 1)}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Berikutnya
					</button>
				</div>
			</section>
		</FeaturePage>
	);
}
