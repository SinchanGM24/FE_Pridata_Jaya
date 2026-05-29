"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AgingReceivableDetailModal, {
	type AgingReceivableGroup,
} from "@/components/akuntan/AgingReceivableDetailModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { printAgingReceivableGroup } from "@/lib/aging-receivable-print";
import { formatLocalDateInput, toIsoEndOfLocalDay, toIsoStartOfLocalDay } from "@/lib/datetime";
import { invoiceStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { receivableService, type ReceivableRow } from "@/services/receivable";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

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

const daysOverdue = (row: ReceivableRow, referenceTime: number) => {
	if (!row.dueDate) return 0;
	const dueDate = new Date(row.dueDate);
	if (Number.isNaN(dueDate.getTime())) return 0;
	return Math.max(0, Math.floor((referenceTime - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
};

const riskTone = (overdueDays: number) => {
	if (overdueDays > 90) return "bg-rose-100 text-rose-700";
	if (overdueDays > 30) return "bg-amber-100 text-amber-700";
	return "bg-emerald-100 text-emerald-700";
};

const riskLabel = (overdueDays: number) => {
	if (overdueDays > 90) return "Risiko Tinggi";
	if (overdueDays > 30) return "Risiko Sedang";
	return "Risiko Rendah";
};

const inDateRange = (row: ReceivableRow, from: string, to: string) => {
	if (!from && !to) return true;
	const dueValue = String(row.dueDate || "").slice(0, 10);
	if (!dueValue) return false;
	if (from && dueValue < from) return false;
	if (to && dueValue > to) return false;
	return true;
};

const buildGroupedRows = (rows: ReceivableRow[], referenceTime: number): AgingReceivableGroup[] => {
	const grouped = new Map<string, ReceivableRow[]>();

	for (const row of rows) {
		const key = row.storeId ?? row.store?.id ?? row.storeNameSnapshot ?? row.customerName ?? row.id;
		const current = grouped.get(key) ?? [];
		current.push(row);
		grouped.set(key, current);
	}

	return Array.from(grouped.entries())
		.map(([storeId, items]) => {
			const maxOverdueDays = items.reduce(
				(max, item) => Math.max(max, daysOverdue(item, referenceTime)),
				0,
			);
			return {
				storeId,
				storeName:
					items[0]?.customerName ?? items[0]?.storeNameSnapshot ?? items[0]?.store?.name ?? "Toko",
				totalOutstandingAmount: items.reduce((sum, item) => sum + item.remainingAmount, 0),
				totalInvoiceCount: items.length,
				overdueCount: items.filter((item) => daysOverdue(item, referenceTime) > 0).length,
				maxOverdueDays,
				riskLabel: riskLabel(maxOverdueDays),
				riskTone: riskTone(maxOverdueDays),
				items: items.sort((a, b) => String(b.dueDate || "").localeCompare(String(a.dueDate || ""))),
			};
		})
		.sort((a, b) => b.totalOutstandingAmount - a.totalOutstandingAmount);
};

export default function AgingPiutangPage() {
	const searchParams = useSearchParams();
	const initialSearch = searchParams.get("search") ?? "";
	const initialOverdueOnly = searchParams.get("overdueOnly") === "1";
	const [rows, setRows] = useState<ReceivableRow[]>([]);
	const [referenceTime] = useState(() => Date.now());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [filters, setFilters] = useState<FilterState>(() => ({
		...defaultFilters,
		search: initialSearch,
		overdueOnly: initialOverdueOnly,
	}));
	const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
	const [selectedGroup, setSelectedGroup] = useState<AgingReceivableGroup | null>(null);
	const [expandedStoreIds, setExpandedStoreIds] = useState<string[]>([]);

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

	const buildExportFilters = (source: FilterState) => ({
		search: source.search || undefined,
		status: source.status === "ALL" ? undefined : source.status,
		overdueOnly: source.overdueOnly ? true : undefined,
		dueDateFrom: source.dueDateFrom ? toIsoStartOfLocalDay(source.dueDateFrom) : undefined,
		dueDateTo: source.dueDateTo ? toIsoEndOfLocalDay(source.dueDateTo) : undefined,
		sortBy: "dueDate",
		sortOrder: "asc" as const,
	});

	const handleExport = async (format: "pdf" | "csv") => {
		setExporting(format);
		setError("");
		try {
			const blob = await receivableService.exportReceivables(format, buildExportFilters(filters));
			const dateSuffix = formatLocalDateInput().replaceAll("-", "");
			downloadBlob(blob, `aging-piutang-${dateSuffix}.${format}`);
		} catch (loadError: unknown) {
			setError(getErrorMessage(loadError, "Gagal export aging piutang."));
		} finally {
			setExporting(null);
		}
	};

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const result = await receivableService.listAllReceivables({
				sortBy: "dueDate",
				sortOrder: "asc",
			});
			setRows(result);
		} catch (loadError: unknown) {
			setError(getErrorMessage(loadError, "Gagal memuat aging piutang."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, []);

	const filteredRows = useMemo(() => {
		const query = filters.search.trim().toLowerCase();
		return rows.filter((row) => {
			const matchesSearch =
				!query ||
				row.invoiceNumber.toLowerCase().includes(query) ||
				String(row.customerName ?? row.storeNameSnapshot ?? row.store?.name ?? "")
					.toLowerCase()
					.includes(query) ||
				String(row.storeId ?? "").toLowerCase().includes(query);
			const matchesStatus = filters.status === "ALL" || row.status === filters.status;
			const matchesOverdue = !filters.overdueOnly || daysOverdue(row, referenceTime) > 0;
			return matchesSearch && matchesStatus && matchesOverdue && inDateRange(row, filters.dueDateFrom, filters.dueDateTo);
		});
	}, [filters, referenceTime, rows]);

	const groupedRows = useMemo(
		() => buildGroupedRows(filteredRows, referenceTime),
		[filteredRows, referenceTime],
	);

	const summary = useMemo(() => {
		const totalOutstandingAmount = filteredRows.reduce((sum, row) => sum + row.remainingAmount, 0);
		const overdueCount = filteredRows.filter((row) => daysOverdue(row, referenceTime) > 0).length;
		const buckets = {
			current: filteredRows.filter((row) => daysOverdue(row, referenceTime) === 0),
			days1To30: filteredRows.filter((row) => {
				const days = daysOverdue(row, referenceTime);
				return days >= 1 && days <= 30;
			}),
			days31To60: filteredRows.filter((row) => {
				const days = daysOverdue(row, referenceTime);
				return days >= 31 && days <= 60;
			}),
			days61To90: filteredRows.filter((row) => {
				const days = daysOverdue(row, referenceTime);
				return days >= 61 && days <= 90;
			}),
			daysOver90: filteredRows.filter((row) => daysOverdue(row, referenceTime) > 90),
		};
		return {
			totalReceivables: filteredRows.length,
			totalOutstandingAmount,
			overdueCount,
			buckets,
		};
	}, [filteredRows, referenceTime]);

	const toggleExpanded = (storeId: string) => {
		setExpandedStoreIds((current) =>
			current.includes(storeId) ? current.filter((value) => value !== storeId) : [...current, storeId],
		);
	};

	const bucketCards = [
		["Lancar", summary.buckets.current],
		["1-30 Hari", summary.buckets.days1To30],
		["31-60 Hari", summary.buckets.days31To60],
		["61-90 Hari", summary.buckets.days61To90],
		[">90 Hari", summary.buckets.daysOver90],
	] as const;

	return (
		<FeaturePage
			title="Aging Piutang"
			description="Tampilan FE2 ini dirapikan mengikuti FE1: fokus per toko, ada aksi detail dan cetak PDF, sehingga akuntan lebih mudah menilai risiko penagihan dan mengecek dokumen yang menumpuk."
			actions={[
				{
					label: exporting === "pdf" ? "Ekspor PDF..." : "Ekspor PDF",
					onClick: () => {
						if (exporting) return;
						void handleExport("pdf");
					},
				},
				{
					label: exporting === "csv" ? "Ekspor CSV..." : "Ekspor CSV",
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
						{formatRupiah(summary.totalOutstandingAmount)}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Invoice Berjalan</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalReceivables}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Lewat Jatuh Tempo</p>
					<p className="mt-2 text-3xl font-semibold text-rose-600">{summary.overdueCount}</p>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-5">
				{bucketCards.map(([label, bucket]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">{label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{bucket.length}</p>
						<p className="mt-1 text-sm text-slate-600">
							{formatRupiah(bucket.reduce((sum, row) => sum + row.remainingAmount, 0))}
						</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_170px_170px_auto]">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari invoice, nama toko, atau ID toko"
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
						<option value="UNPAID">Belum Lunas</option>
						<option value="PARTIAL">Bayar Sebagian</option>
					</select>
					<input
						type="date"
						value={filters.dueDateFrom}
						onChange={(event) =>
							setFilters((prev) => ({ ...prev, dueDateFrom: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal jatuh tempo dari"
					/>
					<input
						type="date"
						value={filters.dueDateTo}
						onChange={(event) =>
							setFilters((prev) => ({ ...prev, dueDateTo: event.target.value }))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Tanggal jatuh tempo sampai"
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
							<span>Jatuh tempo saja</span>
						</label>
						<button
							type="button"
							onClick={() => {
								setFilters(defaultFilters);
							}}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
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
					<p>Menampilkan {groupedRows.length} toko dengan {summary.totalReceivables} invoice piutang.</p>
					<p>{loading ? "Memuat..." : "Siap ditinjau per toko"}</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3 w-12" />
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3 text-right">Invoice</th>
							<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							<th className="px-4 py-3">Risiko</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Memuat piutang...
								</td>
							</tr>
						) : groupedRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Tidak ada piutang pada filter ini.
								</td>
							</tr>
						) : (
							groupedRows.map((group) => {
								const expanded = expandedStoreIds.includes(group.storeId);
								return (
									<Fragment key={group.storeId}>
										<tr className="hover:bg-slate-50">
											<td className="px-4 py-3 text-center">
												<button
													type="button"
													onClick={() => toggleExpanded(group.storeId)}
													className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
												>
													{expanded ? "−" : "+"}
												</button>
											</td>
											<td className="px-4 py-3">
												<div className="font-medium text-slate-900">{group.storeName}</div>
												<div className="text-xs text-slate-500">{group.storeId}</div>
											</td>
											<td className="px-4 py-3 text-right text-slate-700">{group.totalInvoiceCount}</td>
											<td className="px-4 py-3 text-right font-semibold text-rose-700">
												{formatRupiah(group.totalOutstandingAmount)}
											</td>
											<td className="px-4 py-3">
												<span className={`rounded-full px-3 py-1 text-xs font-semibold ${group.riskTone}`}>
													{group.riskLabel}
												</span>
											</td>
											<td className="px-4 py-3">
												<div className="flex justify-end gap-2">
													<button
														type="button"
														onClick={() => setSelectedGroup(group)}
														className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
													>
														Detail
													</button>
													<button
														type="button"
														onClick={() =>
															printAgingReceivableGroup({
																storeId: group.storeId,
																storeName: group.storeName,
																totalOutstandingAmount: group.totalOutstandingAmount,
																totalInvoiceCount: group.totalInvoiceCount,
																items: group.items.map((item) => ({
																	invoiceNumber: item.invoiceNumber,
																	invoiceDate: item.invoiceDate,
																	dueDate: item.dueDate,
																	status: toUiLabel(item.status, invoiceStatusLabel),
																	totalAmount: item.amount ?? item.totalAmount ?? 0,
																	remainingAmount: item.remainingAmount,
																	overdueDays: daysOverdue(item, referenceTime),
																})),
															})
														}
														className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
													>
														Cetak
													</button>
												</div>
											</td>
										</tr>
										{expanded ? (
											<tr className="bg-slate-50">
												<td colSpan={6} className="p-0">
													<div className="overflow-x-auto px-4 py-3">
														<table className="min-w-full text-xs">
															<thead className="text-left text-slate-500">
																<tr className="border-b border-slate-200">
																	<th className="px-2 py-2">Invoice</th>
																	<th className="px-2 py-2">Jatuh Tempo</th>
																	<th className="px-2 py-2 text-right">Total</th>
																	<th className="px-2 py-2 text-right">Sisa</th>
																	<th className="px-2 py-2 text-center">Telat</th>
																	<th className="px-2 py-2">Status</th>
																</tr>
															</thead>
															<tbody>
																{group.items.map((item) => (
																	<tr key={item.id} className="border-b border-slate-200/80">
																		<td className="px-2 py-2 text-slate-700">{item.invoiceNumber}</td>
																		<td className="px-2 py-2 text-slate-700">{dateOnly(item.dueDate)}</td>
																		<td className="px-2 py-2 text-right text-slate-700">
																			{formatRupiah(item.amount ?? item.totalAmount ?? 0)}
																		</td>
																		<td className="px-2 py-2 text-right font-semibold text-rose-700">
																			{formatRupiah(item.remainingAmount)}
																		</td>
																		<td className="px-2 py-2 text-center text-slate-700">
																			{daysOverdue(item, referenceTime) > 0 ? `${daysOverdue(item, referenceTime)} hari` : "-"}
																		</td>
																		<td className="px-2 py-2 text-slate-700">
																			{toUiLabel(item.status, invoiceStatusLabel)}
																		</td>
																	</tr>
																))}
															</tbody>
														</table>
													</div>
												</td>
											</tr>
										) : null}
									</Fragment>
								);
							})
						)}
					</tbody>
				</table>
			</section>

			<AgingReceivableDetailModal
				group={selectedGroup}
				referenceTime={referenceTime}
				onClose={() => setSelectedGroup(null)}
				onPrint={(group) =>
					printAgingReceivableGroup({
						storeId: group.storeId,
						storeName: group.storeName,
						totalOutstandingAmount: group.totalOutstandingAmount,
						totalInvoiceCount: group.totalInvoiceCount,
						items: group.items.map((item) => ({
							invoiceNumber: item.invoiceNumber,
							invoiceDate: item.invoiceDate,
							dueDate: item.dueDate,
							status: toUiLabel(item.status, invoiceStatusLabel),
							totalAmount: item.amount ?? item.totalAmount ?? 0,
							remainingAmount: item.remainingAmount,
							overdueDays: daysOverdue(item, referenceTime),
						})),
					})
				}
			/>
		</FeaturePage>
	);
}
