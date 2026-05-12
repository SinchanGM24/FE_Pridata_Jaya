"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	reportsService,
	type SalesReportFilters,
	type SalesReportInvoice,
} from "@/services/reports";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

interface SalesPerformanceRow {
	key: string;
	salesName: string;
	salesEmail: string;
	invoiceCount: number;
	totalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	stores: Set<string>;
}

type FilterState = {
	status: "ALL" | "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";
	dateFrom: string;
	dateTo: string;
};

const defaultFilters: FilterState = {
	status: "ALL",
	dateFrom: "",
	dateTo: "",
};

const PAGE_LIMIT = 12;

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

export default function KelolaSalesPage() {
	const [invoices, setInvoices] = useState<SalesReportInvoice[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterState>(defaultFilters);
	const [page, setPage] = useState(1);
	const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

	const downloadBlob = (blob: Blob, filename: string) => {
		const url = window.URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		window.URL.revokeObjectURL(url);
	};

	const toIsoStartOfDay = (date: string) => `${date}T00:00:00.000Z`;
	const toIsoEndOfDay = (date: string) => `${date}T23:59:59.999Z`;

	const buildFilters = (source: FilterState): Omit<SalesReportFilters, "page" | "limit"> => {
		return {
			sortBy: "invoiceDate",
			sortOrder: "desc",
			status: source.status === "ALL" ? undefined : source.status,
			dateFrom: source.dateFrom ? toIsoStartOfDay(source.dateFrom) : undefined,
			dateTo: source.dateTo ? toIsoEndOfDay(source.dateTo) : undefined,
		};
	};

	const handleExport = async (format: "pdf" | "csv") => {
		setExporting(format);
		setError("");
		try {
			const blob = await reportsService.exportSales(format, buildFilters(filters));
			const dateSuffix = new Date().toISOString().slice(0, 10).replaceAll("-", "");
			downloadBlob(blob, `sales-report-${dateSuffix}.${format}`);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal export laporan sales."));
		} finally {
			setExporting(null);
		}
	};

	const load = async (nextFilters = filters) => {
		setLoading(true);
		setError("");
		try {
			const result = await reportsService.listAllSales(buildFilters(nextFilters));
			setInvoices(result);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat data performa sales."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load(defaultFilters);
		}, 0);

		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const rows = useMemo(() => {
		const grouped = new Map<string, SalesPerformanceRow>();

		for (const invoice of invoices) {
			const assignedSales = invoice.store?.assignedSalesUser;
			const key = assignedSales?.id ?? "unassigned";
			const current =
				grouped.get(key) ??
				({
					key,
					salesName: assignedSales?.name ?? "Belum ditugaskan",
					salesEmail: assignedSales?.email ?? "-",
					invoiceCount: 0,
					totalAmount: 0,
					paidAmount: 0,
					remainingAmount: 0,
					stores: new Set<string>(),
				} satisfies SalesPerformanceRow);

			current.invoiceCount += 1;
			current.totalAmount += invoice.totalAmount ?? 0;
			current.paidAmount += invoice.paidAmount ?? 0;
			current.remainingAmount += invoice.remainingAmount ?? 0;
			current.stores.add(invoice.store?.name ?? invoice.storeNameSnapshot ?? invoice.storeId);
			grouped.set(key, current);
		}

		return Array.from(grouped.values()).sort((a, b) => b.totalAmount - a.totalAmount);
	}, [invoices]);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return rows;
		return rows.filter(
			(row) =>
				row.salesName.toLowerCase().includes(query) ||
				row.salesEmail.toLowerCase().includes(query) ||
				Array.from(row.stores).some((store) => store.toLowerCase().includes(query)),
		);
	}, [rows, search]);

	const totals = useMemo(
		() => ({
			salesCount: filteredRows.filter((row) => row.key !== "unassigned").length,
			invoiceCount: filteredRows.reduce((sum, row) => sum + row.invoiceCount, 0),
			totalAmount: filteredRows.reduce((sum, row) => sum + row.totalAmount, 0),
			remainingAmount: filteredRows.reduce((sum, row) => sum + row.remainingAmount, 0),
		}),
		[filteredRows],
	);

	const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_LIMIT));
	const currentPage = Math.min(page, totalPages);
	const paginatedRows = useMemo(() => {
		const start = (currentPage - 1) * PAGE_LIMIT;
		return filteredRows.slice(start, start + PAGE_LIMIT);
	}, [currentPage, filteredRows]);

	return (
		<FeaturePage
			title="Kelola Sales"
			description="Ringkasan performa sales dari laporan penjualan BE2. Data dikelompokkan berdasarkan sales yang ditugaskan pada toko."
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
			<section className="grid gap-4 md:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Sales Aktif</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{totals.salesCount}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Invoice</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{totals.invoiceCount}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Total Penjualan</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">
						{formatRupiah(totals.totalAmount)}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Outstanding</p>
					<p className="mt-2 text-2xl font-semibold text-rose-600">
						{formatRupiah(totals.remainingAmount)}
					</p>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-md"
						placeholder="Cari nama sales, email, atau toko"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
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
						onChange={(event) =>
							setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Invoice date from"
					/>
					<input
						type="date"
						value={filters.dateTo}
						onChange={(event) =>
							setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Invoice date to"
					/>
					<div className="flex flex-wrap items-center gap-2 lg:justify-end">
						<button
							type="button"
							onClick={() => {
								setPage(1);
								void load(filters);
							}}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Terapkan
						</button>
						<button
							type="button"
							onClick={() => {
								setSearch("");
								setFilters(defaultFilters);
								setPage(1);
								void load(defaultFilters);
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
						Menampilkan {paginatedRows.length} sales dari {filteredRows.length} hasil filter.
					</p>
					<p>
						Halaman {currentPage} / {totalPages}
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Sales</th>
							<th className="px-4 py-3 text-right">Toko</th>
							<th className="px-4 py-3 text-right">Invoice</th>
							<th className="px-4 py-3 text-right">Penjualan</th>
							<th className="px-4 py-3 text-right">Terbayar</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Memuat performa sales...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Tidak ada data sales pada filter ini.
								</td>
							</tr>
						) : (
							paginatedRows.map((row) => (
								<tr key={row.key}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{row.salesName}</div>
										<div className="text-xs text-slate-500">{row.salesEmail}</div>
									</td>
									<td className="px-4 py-3 text-right text-slate-700">{row.stores.size}</td>
									<td className="px-4 py-3 text-right text-slate-700">{row.invoiceCount}</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(row.totalAmount)}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(row.paidAmount)}
									</td>
									<td className="px-4 py-3 text-right font-medium text-slate-900">
										{formatRupiah(row.remainingAmount)}
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
		</FeaturePage>
	);
}
