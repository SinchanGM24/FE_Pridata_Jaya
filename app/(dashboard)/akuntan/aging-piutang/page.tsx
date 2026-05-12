"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { receivableService, type ReceivableAging, type ReceivableRow } from "@/services/receivable";
import type { PaginationMeta } from "@/services/reports";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const emptyAging: ReceivableAging = {
	current: { count: 0, amount: 0 },
	days1To30: { count: 0, amount: 0 },
	days31To60: { count: 0, amount: 0 },
	days61To90: { count: 0, amount: 0 },
	daysOver90: { count: 0, amount: 0 },
	totalReceivables: 0,
	totalOutstandingAmount: 0,
	overdueCount: 0,
};

type FilterState = {
	search: string;
	status: "ALL" | "UNPAID" | "PARTIAL";
	overdueOnly: boolean;
	dueDateFrom: string;
	dueDateTo: string;
};

const defaultFilters: FilterState = {
	search: "",
	status: "ALL",
	overdueOnly: false,
	dueDateFrom: "",
	dueDateTo: "",
};

const PAGE_LIMIT = 50;

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

export default function AgingPiutangPage() {
	const [aging, setAging] = useState<ReceivableAging>(emptyAging);
	const [rows, setRows] = useState<ReceivableRow[]>([]);
	const [meta, setMeta] = useState<PaginationMeta | undefined>(undefined);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
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

	const buildFilters = (source: FilterState) => ({
		search: source.search || undefined,
		status: source.status === "ALL" ? undefined : source.status,
		overdueOnly: source.overdueOnly ? true : undefined,
		dueDateFrom: source.dueDateFrom ? toIsoStartOfDay(source.dueDateFrom) : undefined,
		dueDateTo: source.dueDateTo ? toIsoEndOfDay(source.dueDateTo) : undefined,
	});

	const buildQuery = (source: FilterState, pageNumber: number) => ({
		page: pageNumber,
		limit: PAGE_LIMIT,
		sortBy: "dueDate",
		sortOrder: "asc" as const,
		...buildFilters(source),
	});

	const handleExport = async (format: "pdf" | "csv") => {
		setExporting(format);
		setError("");
		try {
			const blob = await receivableService.exportReceivables(format, {
				...buildFilters(filters),
				sortBy: "dueDate",
				sortOrder: "asc",
			});
			const dateSuffix = new Date().toISOString().slice(0, 10).replaceAll("-", "");
			downloadBlob(blob, `aging-piutang-${dateSuffix}.${format}`);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal export aging piutang."));
		} finally {
			setExporting(null);
		}
	};

	const load = async (nextFilters = filters, nextPage = page) => {
		setLoading(true);
		setError("");
		try {
			const receivablesResult = await receivableService.listReceivables(
				buildQuery(nextFilters, nextPage),
			);
			setRows(receivablesResult.data ?? []);
			setMeta(receivablesResult.meta);

			const summary = receivablesResult.summary;
			if (summary?.aging) {
				setAging({
					current: summary.aging.current,
					days1To30: summary.aging.days1To30,
					days31To60: summary.aging.days31To60,
					days61To90: summary.aging.days61To90,
					daysOver90: summary.aging.daysOver90,
					totalReceivables: summary.totalReceivables,
					totalOutstandingAmount: summary.totalOutstandingAmount,
					overdueCount: summary.overdueCount,
				});
			} else {
				setAging(emptyAging);
			}
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat aging piutang."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load(defaultFilters, 1);
		}, 0);

		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const buckets = [
		["Lancar", aging.current],
		["1-30 Hari", aging.days1To30],
		["31-60 Hari", aging.days31To60],
		["61-90 Hari", aging.days61To90],
		[">90 Hari", aging.daysOver90],
	] as const;

	return (
		<FeaturePage
			title="Aging Piutang"
			description="Pantauan piutang dari BE2 untuk melihat nominal outstanding, invoice jatuh tempo, dan risiko penagihan per bucket aging."
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
			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Total Piutang</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">
						{formatRupiah(aging.totalOutstandingAmount)}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Invoice Outstanding</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{aging.totalReceivables}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Lewat Jatuh Tempo</p>
					<p className="mt-2 text-3xl font-semibold text-rose-600">{aging.overdueCount}</p>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-5">
				{buckets.map(([label, bucket]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">{label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{bucket.count}</p>
						<p className="mt-1 text-sm text-slate-600">{formatRupiah(bucket.amount)}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari invoice atau toko"
						value={filters.search}
						onChange={(event) =>
							setFilters((prev) => ({ ...prev, search: event.target.value }))
						}
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
					</select>
					<input
						type="date"
						value={filters.dueDateFrom}
						onChange={(event) =>
							setFilters((prev) => ({ ...prev, dueDateFrom: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Due date from"
					/>
					<input
						type="date"
						value={filters.dueDateTo}
						onChange={(event) =>
							setFilters((prev) => ({ ...prev, dueDateTo: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Due date to"
					/>
					<div className="flex flex-wrap items-center gap-2 lg:justify-end">
						<label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={filters.overdueOnly}
								onChange={(event) =>
									setFilters((prev) => ({
										...prev,
										overdueOnly: event.target.checked,
									}))
								}
								className="h-4 w-4 rounded border-slate-300 text-slate-900"
							/>
							<span>Overdue saja</span>
						</label>
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
						Menampilkan {rows.length} piutang dari {meta?.totalItems ?? 0} total data.
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
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
							<th className="px-4 py-3">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Memuat piutang...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Tidak ada piutang pada filter ini.
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<tr key={row.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{row.invoiceNumber}</td>
									<td className="px-4 py-3 text-slate-700">
										{row.customerName ?? row.storeNameSnapshot ?? row.store?.name ?? "-"}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{String(row.dueDate || "").slice(0, 10) || "-"}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(row.amount ?? row.totalAmount ?? 0)}
									</td>
									<td className="px-4 py-3 text-right font-medium text-slate-900">
										{formatRupiah(row.remainingAmount)}
									</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
											{row.status}
										</span>
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
