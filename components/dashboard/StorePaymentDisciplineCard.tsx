"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatPercent, formatRupiah, resolveChartColor } from "@/components/dashboard/chart-utils";
import type {
	OwnerAnalyticsStorePaymentDiscipline,
	OwnerAnalyticsStorePaymentDisciplineInvoice,
} from "@/services/dashboard";

type DisciplineStatus = "LANCAR" | "NUNGGAK";

const PAGE_SIZE = 10;

const STATUS_META: Record<
	DisciplineStatus,
	{ label: string; color: string; badgeClassName: string; emptyMessage: string }
> = {
	LANCAR: {
		label: "Lancar",
		color: "bg-emerald-500",
		badgeClassName: "bg-emerald-50 text-emerald-700",
		emptyMessage: "Belum ada toko lancar pada periode ini.",
	},
	NUNGGAK: {
		label: "Nunggak",
		color: "bg-rose-500",
		badgeClassName: "bg-rose-50 text-rose-700",
		emptyMessage: "Belum ada toko yang menunggak pada periode ini.",
	},
};

export default function StorePaymentDisciplineCard({
	title,
	helper,
	items,
	footer,
	className,
}: {
	title: string;
	helper: string;
	items: OwnerAnalyticsStorePaymentDiscipline[];
	footer?: string;
	className?: string;
}) {
	const [selectedStatus, setSelectedStatus] = useState<DisciplineStatus | null>(null);
	const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [page, setPage] = useState(1);

	const summaryItems = useMemo(
		() =>
			(["LANCAR", "NUNGGAK"] as DisciplineStatus[]).map((status) => ({
				status,
				label: STATUS_META[status].label,
				value: items.filter((item) => item.disciplineLabel === status).length,
				color: STATUS_META[status].color,
				badgeClassName: STATUS_META[status].badgeClassName,
			})),
		[items],
	);
	const totalStores = summaryItems.reduce((sum, item) => sum + item.value, 0);

	const option = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 450,
			grid: {
				left: 12,
				right: 16,
				top: 12,
				bottom: 8,
				containLabel: true,
			},
			tooltip: {
				trigger: "item",
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
				formatter: (params: unknown) => {
					const point = params as { name?: string; value?: number };
					const count = point.value ?? 0;
					return `<div style="display:flex;justify-content:space-between;gap:16px;min-width:150px;">
						<span>${point.name ?? "-"}</span>
						<strong>${formatPercent(totalStores > 0 ? count / totalStores : 0)} • ${count.toLocaleString("id-ID")} toko</strong>
					</div>`;
				},
			},
			xAxis: {
				type: "value",
				max: totalStores || 1,
				axisLabel: { show: false },
				axisTick: { show: false },
				axisLine: { show: false },
				splitLine: { show: false },
			},
			yAxis: {
				type: "category",
				data: ["Status"],
				axisLabel: { show: false },
				axisTick: { show: false },
				axisLine: { show: false },
			},
			series: summaryItems.map((item) => ({
				name: item.label,
				type: "bar",
				stack: "total",
				barWidth: 26,
				label: { show: false },
				itemStyle: {
					color: resolveChartColor(item.color),
					borderRadius: 999,
				},
				emphasis: { focus: "series" },
				data: [item.value],
			})),
		};
	}, [summaryItems, totalStores]);

	const filteredStores = useMemo(() => {
		const normalizedSearch = searchTerm.trim().toLowerCase();
		const nextItems = items
			.filter((item) => !selectedStatus || item.disciplineLabel === selectedStatus)
			.filter((item) => {
				if (!normalizedSearch) return true;
				return `${item.storeName} ${item.salesUserName}`.toLowerCase().includes(normalizedSearch);
			})
			.sort((left, right) => {
				if ((selectedStatus ?? left.disciplineLabel) === "NUNGGAK") {
					return (
						right.maxOverdueDays - left.maxOverdueDays ||
						right.overdueAmount - left.overdueAmount ||
						right.outstandingAmount - left.outstandingAmount ||
						left.storeName.localeCompare(right.storeName)
					);
				}
				return (
					right.collectionRate - left.collectionRate ||
					right.paidAmount - left.paidAmount ||
					left.storeName.localeCompare(right.storeName)
				);
			});
		return nextItems;
	}, [items, searchTerm, selectedStatus]);
	const totalPages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));
	const paginatedStores = useMemo(
		() => filteredStores.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
		[filteredStores, page],
	);
	const selectedStore = useMemo(
		() => items.find((item) => item.storeId === selectedStoreId) ?? null,
		[items, selectedStoreId],
	);

	const handleStatusClick = (label: string) => {
		const status = label === "Lancar" ? "LANCAR" : label === "Nunggak" ? "NUNGGAK" : null;
		if (!status) return;
		setSelectedStatus(status);
		setSelectedStoreId(null);
		setSearchTerm("");
		setPage(1);
	};
	const renderInvoiceStatus = (invoice: OwnerAnalyticsStorePaymentDisciplineInvoice) => {
		if (invoice.overdueDays > 0 && invoice.remainingAmount > 0) {
			return {
				label: `Terlambat ${invoice.overdueDays} hari`,
				className: "bg-rose-50 text-rose-700",
			};
		}
		if (invoice.remainingAmount > 0) {
			return {
				label: "Piutang Berjalan",
				className: "bg-sky-50 text-sky-700",
			};
		}
		return {
			label: "Lunas",
			className: "bg-emerald-50 text-emerald-700",
		};
	};

	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className ?? ""}`}>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="mt-1 text-sm text-slate-500">{helper}</p>
				</div>
			</div>

			{items.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data disiplin pembayaran toko.
				</div>
			) : (
				<>
					<EChart
						option={option}
						height={84}
						className="mt-4"
						onClick={(params) => {
							const label = (params as { seriesName?: string }).seriesName;
							if (!label) return;
							handleStatusClick(label);
						}}
					/>
					<div className="mt-5 space-y-3">
						{summaryItems.map((item) => {
							const ratio = totalStores > 0 ? item.value / totalStores : 0;
							return (
								<div key={item.status} className="flex items-start justify-between gap-4">
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
											<p className="text-sm font-medium text-slate-800">{item.label}</p>
										</div>
									</div>
									<div className="text-right">
										<p className="text-sm font-semibold text-slate-900">{item.value.toLocaleString("id-ID")} toko</p>
										<p className="text-xs text-slate-500">{formatPercent(ratio)}</p>
									</div>
								</div>
							);
						})}
					</div>
				</>
			)}

			{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}

			{selectedStatus ? (
				<div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
					{selectedStore ? (
						<div className="space-y-4">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
								<div>
									<h3 className="text-sm font-semibold text-slate-900">{selectedStore.storeName}</h3>
									<p className="mt-1 text-xs text-slate-500">{selectedStore.salesUserName}</p>
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => setSelectedStoreId(null)}
										className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
									>
										Kembali ke Daftar
									</button>
									<button
										type="button"
										onClick={() => {
											setSelectedStoreId(null);
											setSelectedStatus(null);
											setSearchTerm("");
											setPage(1);
										}}
										className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
									>
										Tutup Detail
									</button>
								</div>
							</div>
							<div className="grid gap-3 md:grid-cols-3">
								<div className="rounded-xl border border-slate-200 bg-white p-4">
									<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Sudah Dibayar</p>
									<p className="mt-2 text-lg font-semibold text-emerald-700">{formatRupiah(selectedStore.paidAmount)}</p>
								</div>
								<div className="rounded-xl border border-slate-200 bg-white p-4">
									<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Piutang Berjalan</p>
									<p className="mt-2 text-lg font-semibold text-sky-700">
										{formatRupiah(selectedStore.currentOutstandingAmount)}
									</p>
								</div>
								<div className="rounded-xl border border-slate-200 bg-white p-4">
									<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Tunggakan</p>
									<p className="mt-2 text-lg font-semibold text-rose-700">{formatRupiah(selectedStore.overdueAmount)}</p>
								</div>
							</div>
							<div className="rounded-xl border border-slate-200 bg-white p-4">
								<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Kolektibilitas</p>
								<p className="mt-2 text-sm text-slate-700">
									Tingkat tertagih saat ini {formatPercent(selectedStore.collectionRate)} dengan total piutang{" "}
									{formatRupiah(selectedStore.outstandingAmount)}.
								</p>
							</div>
							<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
								<div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] gap-3 border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid">
									<span>Invoice</span>
									<span>Jatuh Tempo</span>
									<span>Sisa Tagihan</span>
									<span>Status</span>
								</div>
								{selectedStore.invoices.length > 0 ? (
									<div className="divide-y divide-slate-100">
										{selectedStore.invoices.map((invoice) => {
											const invoiceStatus = renderInvoiceStatus(invoice);
											const dueDateLabel = invoice.dueDate
												? new Date(invoice.dueDate).toLocaleDateString("id-ID")
												: "-";
											return (
												<div key={invoice.invoiceId}>
													<div className="space-y-3 px-4 py-3 md:hidden">
														<div className="flex items-start justify-between gap-3">
															<div>
																<p className="font-medium text-slate-900">{invoice.invoiceNumber}</p>
																<p className="mt-1 text-xs text-slate-500">Jatuh tempo {dueDateLabel}</p>
															</div>
															<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${invoiceStatus.className}`}>
																{invoiceStatus.label}
															</span>
														</div>
														<div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
															<div>
																<p className="uppercase tracking-[0.14em] text-slate-400">Sisa Tagihan</p>
																<p className="mt-1 text-sm text-slate-700">{formatRupiah(invoice.remainingAmount)}</p>
															</div>
															<div>
																<p className="uppercase tracking-[0.14em] text-slate-400">Sudah Dibayar</p>
																<p className="mt-1 text-sm text-slate-700">{formatRupiah(invoice.paidAmount)}</p>
															</div>
														</div>
													</div>
													<div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] gap-3 px-4 py-3 text-sm text-slate-700 md:grid">
														<span className="font-medium text-slate-900">{invoice.invoiceNumber}</span>
														<span>{dueDateLabel}</span>
														<span>{formatRupiah(invoice.remainingAmount)}</span>
														<span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${invoiceStatus.className}`}>
															{invoiceStatus.label}
														</span>
													</div>
												</div>
											);
										})}
									</div>
								) : (
									<div className="px-4 py-10 text-center text-sm text-slate-500">
										Belum ada invoice untuk toko ini pada periode yang terbaca.
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="space-y-4">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
								<div>
									<h3 className="text-sm font-semibold text-slate-900">
										Daftar Toko {STATUS_META[selectedStatus].label}
									</h3>
									<p className="mt-1 text-xs text-slate-500">
										Klik nama toko untuk melihat ringkasan pembayaran, piutang berjalan, dan tunggakannya.
									</p>
								</div>
								<button
									type="button"
									onClick={() => {
										setSelectedStatus(null);
										setSearchTerm("");
										setPage(1);
									}}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
								>
									Tutup Detail
								</button>
							</div>
							<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
								<input
									type="search"
									value={searchTerm}
									onChange={(event) => {
										setSearchTerm(event.target.value);
										setPage(1);
									}}
									placeholder="Cari nama toko"
									className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 lg:max-w-sm"
								/>
								<div className="flex items-center gap-2 text-sm text-slate-600">
									<button
										type="button"
										onClick={() => setPage((current) => Math.max(1, current - 1))}
										disabled={page <= 1}
										className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
									>
										Prev
									</button>
									<span>
										Halaman {page} / {totalPages}
									</span>
									<button
										type="button"
										onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
										disabled={page >= totalPages}
										className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
									>
										Next
									</button>
								</div>
							</div>
							<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
								<div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid">
									<span>Toko</span>
									<span>Sales</span>
									<span>Status</span>
									<span>Preview</span>
								</div>
								{paginatedStores.length > 0 ? (
									<div className="divide-y divide-slate-100">
										{paginatedStores.map((item) => (
											<button
												type="button"
												key={item.storeId}
												onClick={() => setSelectedStoreId(item.storeId)}
												className="block w-full text-left transition hover:bg-slate-50"
											>
												<div className="space-y-3 px-4 py-3 md:hidden">
													<div className="flex items-start justify-between gap-3">
														<div>
															<p className="font-medium text-slate-900">{item.storeName}</p>
															<p className="mt-1 text-xs text-slate-500">{item.salesUserName}</p>
														</div>
														<span
															className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[item.disciplineLabel].badgeClassName}`}
														>
															{STATUS_META[item.disciplineLabel].label}
														</span>
													</div>
													<p className="text-sm text-slate-600">
														{item.disciplineLabel === "NUNGGAK"
															? item.maxOverdueDays > 0
																? `Terlambat ${item.maxOverdueDays} hari`
																: `Tunggakan ${formatRupiah(item.overdueAmount)}`
															: `Tertagih ${formatPercent(item.collectionRate)}`}
													</p>
												</div>
												<div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 px-4 py-3 text-sm text-slate-700 md:grid">
													<span className="font-medium text-slate-900">{item.storeName}</span>
													<span>{item.salesUserName}</span>
													<span
														className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[item.disciplineLabel].badgeClassName}`}
													>
														{STATUS_META[item.disciplineLabel].label}
													</span>
													<span>
														{item.disciplineLabel === "NUNGGAK"
															? item.maxOverdueDays > 0
																? `${item.maxOverdueDays} hari`
																: formatRupiah(item.overdueAmount)
															: formatPercent(item.collectionRate)}
													</span>
												</div>
											</button>
										))}
									</div>
								) : (
									<div className="px-4 py-10 text-center text-sm text-slate-500">
										{STATUS_META[selectedStatus].emptyMessage}
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}
