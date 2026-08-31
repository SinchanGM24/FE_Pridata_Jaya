"use client";

export const dynamic = "force-dynamic";
import { Suspense, Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AgingReceivableDetailModal, {
	type AgingReceivableGroup,
} from "@/components/akuntan/AgingReceivableDetailModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { printAgingReceivableGroup } from "@/lib/aging-receivable-print";
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
	ageBucket: AgeBucket;
};

type AgeBucket = "ALL" | "0_30" | "31_60" | "61_90" | "91_120" | "OVER_120";

const defaultFilters: FilterState = {
	search: "",
	status: "ALL",
	ageBucket: "ALL",
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

const receivableAgeDays = (row: ReceivableRow, referenceTime: number) => {
	if (!row.invoiceDate) return 0;
	const invoiceDate = new Date(row.invoiceDate);
	if (Number.isNaN(invoiceDate.getTime())) return 0;
	return Math.max(0, Math.floor((referenceTime - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)));
};

const riskTone = (ageDays: number) => {
	if (ageDays > 90) return "border border-rose-200 bg-rose-50 text-rose-700";
	if (ageDays > 30) return "border border-amber-200 bg-amber-50 text-amber-700";
	return "border border-emerald-200 bg-emerald-50 text-emerald-700";
};

const riskLabel = (ageDays: number) => {
	if (ageDays > 90) return "Perlu Prioritas";
	if (ageDays > 30) return "Perlu Ditagih";
	return "Masih Baru";
};

const ageBucketOptions: Array<{ value: AgeBucket; label: string }> = [
	{ value: "ALL", label: "Semua Umur Piutang" },
	{ value: "0_30", label: "0-30 Hari" },
	{ value: "31_60", label: "31-60 Hari" },
	{ value: "61_90", label: "61-90 Hari" },
	{ value: "91_120", label: "91-120 Hari" },
	{ value: "OVER_120", label: ">120 Hari" },
];

const matchesAgeBucket = (ageDays: number, bucket: AgeBucket) => {
	if (bucket === "ALL") return true;
	if (bucket === "0_30") return ageDays <= 30;
	if (bucket === "31_60") return ageDays >= 31 && ageDays <= 60;
	if (bucket === "61_90") return ageDays >= 61 && ageDays <= 90;
	if (bucket === "91_120") return ageDays >= 91 && ageDays <= 120;
	return ageDays > 120;
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
			const maxAgeDays = items.reduce(
				(max, item) => Math.max(max, receivableAgeDays(item, referenceTime)),
				0,
			);
			return {
				storeId,
				storeName:
					items[0]?.customerName ?? items[0]?.storeNameSnapshot ?? items[0]?.store?.name ?? "Toko",
				totalOutstandingAmount: items.reduce((sum, item) => sum + item.remainingAmount, 0),
				totalInvoiceCount: items.length,
				attentionCount: items.filter((item) => receivableAgeDays(item, referenceTime) > 30).length,
				maxAgeDays,
				riskLabel: riskLabel(maxAgeDays),
				riskTone: riskTone(maxAgeDays),
				items: items.sort((a, b) => String(a.invoiceDate || "").localeCompare(String(b.invoiceDate || ""))),
			};
		})
		.sort((a, b) => b.totalOutstandingAmount - a.totalOutstandingAmount);
};

function AgingPiutangPageContent() {
	const searchParams = useSearchParams();
	const initialSearch = searchParams.get("search") ?? "";
	const initialAgeBucket: AgeBucket =
		searchParams.get("olderThan30DaysOnly") === "1" || searchParams.get("overdueOnly") === "1"
			? "31_60"
			: "ALL";
	const [rows, setRows] = useState<ReceivableRow[]>([]);
	const [referenceTime] = useState(() => Date.now());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [filters, setFilters] = useState<FilterState>(() => ({
		...defaultFilters,
		search: initialSearch,
		ageBucket: initialAgeBucket,
	}));
	const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
	const [selectedGroup, setSelectedGroup] = useState<AgingReceivableGroup | null>(null);
	const [expandedStoreIds, setExpandedStoreIds] = useState<string[]>([]);

	const buildExportFilters = (source: FilterState) => ({
		search: source.search || undefined,
		status: source.status === "ALL" ? undefined : source.status,
		sortBy: "invoiceDate",
		sortOrder: "asc" as const,
	});

	const handleExport = async (format: "pdf" | "csv") => {
		setExporting(format);
		setError("");
		try {
			await receivableService.exportReceivables(format, buildExportFilters(filters));
			setError("Export aging piutang dibuat. Cek status dan download di menu Log Ekspor.");
		} catch (loadError: unknown) {
			setError(getErrorMessage(loadError, "Gagal membuat export aging piutang."));
		} finally {
			setExporting(null);
		}
	};

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const result = await receivableService.listAllReceivables({
				sortBy: "invoiceDate",
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

	const rowsAfterTextAndStatusFilter = useMemo(() => {
		const query = filters.search.trim().toLowerCase();
		return rows.filter((row) => {
			const matchesSearch =
				!query ||
				row.invoiceNumber.toLowerCase().includes(query) ||
				String(row.customerName ?? row.storeNameSnapshot ?? row.store?.name ?? "")
					.toLowerCase()
					.includes(query);
			const matchesStatus = filters.status === "ALL" || row.status === filters.status;
			return matchesSearch && matchesStatus;
		});
	}, [filters.search, filters.status, rows]);

	const filteredRows = useMemo(
		() =>
			rowsAfterTextAndStatusFilter.filter((row) =>
				matchesAgeBucket(receivableAgeDays(row, referenceTime), filters.ageBucket),
			),
		[filters.ageBucket, referenceTime, rowsAfterTextAndStatusFilter],
	);

	const groupedRows = useMemo(
		() => buildGroupedRows(filteredRows, referenceTime),
		[filteredRows, referenceTime],
	);

	const summary = useMemo(() => {
		const totalOutstandingAmount = filteredRows.reduce((sum, row) => sum + row.remainingAmount, 0);
		const attentionCount = filteredRows.filter((row) => receivableAgeDays(row, referenceTime) > 30).length;
		const buckets = {
			current: rowsAfterTextAndStatusFilter.filter((row) => receivableAgeDays(row, referenceTime) <= 30),
			days31To60: rowsAfterTextAndStatusFilter.filter((row) => {
				const days = receivableAgeDays(row, referenceTime);
				return days >= 31 && days <= 60;
			}),
			days61To90: rowsAfterTextAndStatusFilter.filter((row) => {
				const days = receivableAgeDays(row, referenceTime);
				return days >= 61 && days <= 90;
			}),
			days91To120: rowsAfterTextAndStatusFilter.filter((row) => {
				const days = receivableAgeDays(row, referenceTime);
				return days >= 91 && days <= 120;
			}),
			daysOver120: rowsAfterTextAndStatusFilter.filter((row) => receivableAgeDays(row, referenceTime) > 120),
		};
		return {
			totalReceivables: filteredRows.length,
			totalOutstandingAmount,
			attentionCount,
			buckets,
		};
	}, [filteredRows, referenceTime, rowsAfterTextAndStatusFilter]);

	const toggleExpanded = (storeId: string) => {
		setExpandedStoreIds((current) =>
			current.includes(storeId) ? current.filter((value) => value !== storeId) : [...current, storeId],
		);
	};

	const bucketCards = [
		["0-30 Hari", summary.buckets.current],
		["31-60 Hari", summary.buckets.days31To60],
		["61-90 Hari", summary.buckets.days61To90],
		["91-120 Hari", summary.buckets.days91To120],
		[">120 Hari", summary.buckets.daysOver120],
	] as const;

	return (
		<FeaturePage
			title="Aging Piutang"
			description="Pantau umur piutang toko berdasarkan tanggal invoice agar penagihan bisa diprioritaskan secara berkala."
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
					<p className="text-sm text-slate-500">Perlu Ditagih (&gt;30 Hari)</p>
					<p className="mt-2 text-3xl font-semibold text-rose-600">{summary.attentionCount}</p>
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
				<div className="grid gap-3 md:grid-cols-3">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari invoice atau nama toko"
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
					<select
						value={filters.ageBucket}
						onChange={(event) =>
							setFilters((prev) => ({
								...prev,
								ageBucket: event.target.value as AgeBucket,
							}))
						}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					>
						{ageBucketOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
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
											</td>
											<td className="px-4 py-3 text-right text-slate-700">{group.totalInvoiceCount}</td>
											<td className="px-4 py-3 text-right font-semibold text-rose-700">
												{formatRupiah(group.totalOutstandingAmount)}
											</td>
											<td className="px-4 py-3">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${group.riskTone}`}>
													{group.riskLabel}
												</span>
											</td>
							<td className="px-4 py-3">
								<div className="flex justify-end gap-2">
									<button
										type="button"
										onClick={() => setSelectedGroup(group)}
										className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
									>
										Detail
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
																	<th className="px-2 py-2">Tanggal Invoice</th>
																	<th className="px-2 py-2 text-right">Total</th>
																	<th className="px-2 py-2 text-right">Sisa</th>
																	<th className="px-2 py-2 text-center">Umur</th>
																	<th className="px-2 py-2">Status</th>
																</tr>
															</thead>
															<tbody>
																{group.items.map((item) => (
																	<tr key={item.id} className="border-b border-slate-200/80">
																		<td className="px-2 py-2 text-slate-700">{item.invoiceNumber}</td>
																		<td className="px-2 py-2 text-slate-700">{dateOnly(item.invoiceDate)}</td>
																		<td className="px-2 py-2 text-right text-slate-700">
																			{formatRupiah(item.amount ?? item.totalAmount ?? 0)}
																		</td>
																		<td className="px-2 py-2 text-right font-semibold text-rose-700">
																			{formatRupiah(item.remainingAmount)}
																		</td>
																		<td className="px-2 py-2 text-center text-slate-700">
																			{receivableAgeDays(item, referenceTime)} hari
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
						attentionCount: group.attentionCount,
						maxAgeDays: group.maxAgeDays,
						riskLabel: group.riskLabel,
						items: group.items.map((item) => ({
							invoiceNumber: item.invoiceNumber,
							invoiceDate: item.invoiceDate,
							status: toUiLabel(item.status, invoiceStatusLabel),
							totalAmount: item.amount ?? item.totalAmount ?? 0,
							remainingAmount: item.remainingAmount,
							ageDays: receivableAgeDays(item, referenceTime),
						})),
					})
				}
			/>
		</FeaturePage>
	);
}

export default function AgingPiutangPage() {
	return (
		<Suspense fallback={null}>
			<AgingPiutangPageContent />
		</Suspense>
	);
}
