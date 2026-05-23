"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatPercent, formatRupiah, resolveChartColor, withAlpha } from "@/components/dashboard/chart-utils";

export interface SalesRankingPoint {
	id: string;
	label: string;
	subtitle?: string;
	totalSalesAmount: number;
	storeCount: number;
	salesShare: number;
	monthlySales: Array<{
		monthNumber: number;
		monthLabel: string;
		salesAmount: number;
		invoiceCount: number;
	}>;
}

const SERIES_COLORS = [
	"bg-slate-900",
	"bg-sky-500",
	"bg-emerald-500",
	"bg-amber-500",
	"bg-rose-500",
	"bg-indigo-500",
	"bg-cyan-500",
	"bg-lime-500",
	"bg-orange-500",
	"bg-fuchsia-500",
];

export default function SalesRankingChartCard({
	title,
	helper,
	items,
	selectedYear,
	availableYears,
	onSelectedYearChange,
	footer,
	onPointClick,
	className,
}: {
	title: string;
	helper: string;
	items: SalesRankingPoint[];
	selectedYear: number;
	availableYears: number[];
	onSelectedYearChange: (year: number) => void;
	footer?: string;
	onPointClick?: (item: SalesRankingPoint) => void;
	className?: string;
}) {
	const filteredMonthNumbers = useMemo(
		() => items[0]?.monthlySales.map((month) => month.monthNumber) ?? [],
		[items],
	);

	const filteredMonthLabels = useMemo(() => {
		const monthLabelMap = new Map(
			(items[0]?.monthlySales ?? []).map((month) => [month.monthNumber, month.monthLabel]),
		);
		return filteredMonthNumbers.map((monthNumber) => monthLabelMap.get(monthNumber) ?? `Bulan ${monthNumber}`);
	}, [filteredMonthNumbers, items]);

	const rankingMatrix = useMemo(() => {
		if (items.length === 0 || filteredMonthNumbers.length === 0) return [];

		return filteredMonthNumbers.map((monthNumber) => {
			const monthItems = items.map((item) => {
				const monthData = item.monthlySales.find((month) => month.monthNumber === monthNumber) ?? null;
				return {
					id: item.id,
					label: item.label,
					subtitle: item.subtitle,
					storeCount: item.storeCount,
					salesShare: item.salesShare,
					totalSalesAmount: item.totalSalesAmount,
					salesAmount: monthData?.salesAmount ?? 0,
					invoiceCount: monthData?.invoiceCount ?? 0,
					monthLabel: monthData?.monthLabel ?? `Bulan ${monthNumber}`,
				};
			});

			const sortedMonthItems = [...monthItems].sort((left, right) => {
				if (right.salesAmount !== left.salesAmount) {
					return right.salesAmount - left.salesAmount;
				}
				return right.totalSalesAmount - left.totalSalesAmount;
			});

			return sortedMonthItems.map((item, index) => ({
				...item,
				rank: index + 1,
			}));
		});
	}, [filteredMonthNumbers, items]);

	const rankedItems = useMemo(
		() =>
			items
				.filter((item) => item.monthlySales.length > 0)
				.sort((left, right) => right.totalSalesAmount - left.totalSalesAmount),
		[items],
	);

	const hasData = useMemo(
		() =>
			rankedItems.some((item) =>
				item.monthlySales.some((month) =>
					filteredMonthNumbers.includes(month.monthNumber) && (month.salesAmount > 0 || month.invoiceCount > 0),
				),
			),
		[filteredMonthNumbers, rankedItems],
	);

	const chartHeight = useMemo(() => Math.max(380, rankedItems.length * 58), [rankedItems.length]);

	const series = useMemo(
		() =>
			rankedItems.map((item, index) => {
				const colorClass = SERIES_COLORS[index % SERIES_COLORS.length];
				return {
					name: item.label,
					type: "line" as const,
					smooth: false,
					symbol: "circle",
					symbolSize: 10,
					lineStyle: {
						width: 3,
						color: resolveChartColor(colorClass),
					},
					itemStyle: {
						color: resolveChartColor(colorClass),
						borderColor: "#ffffff",
						borderWidth: 2,
					},
					emphasis: {
						focus: "series" as const,
						lineStyle: {
							width: 4,
							shadowBlur: 18,
							shadowColor: withAlpha(colorClass, 0.28),
						},
						itemStyle: {
							shadowBlur: 18,
							shadowColor: withAlpha(colorClass, 0.28),
						},
					},
					data: filteredMonthNumbers.map((monthNumber) => {
						const rankedMonth = rankingMatrix
							.find((monthRanks, monthIndex) => filteredMonthNumbers[monthIndex] === monthNumber)
							?.find((monthItem) => monthItem.id === item.id);
						return {
							value: rankedMonth?.rank ?? null,
							salesAmount: rankedMonth?.salesAmount ?? 0,
							invoiceCount: rankedMonth?.invoiceCount ?? 0,
							storeCount: rankedMonth?.storeCount ?? item.storeCount,
							salesShare: rankedMonth?.salesShare ?? item.salesShare,
							monthLabel: rankedMonth?.monthLabel ?? `Bulan ${monthNumber}`,
							totalSalesAmount: item.totalSalesAmount,
							itemId: item.id,
							itemLabel: item.label,
							itemSubtitle: item.subtitle,
						};
					}),
				};
			}),
		[filteredMonthNumbers, rankedItems, rankingMatrix],
	);

	const option = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 700,
			grid: {
				left: 18,
				right: 20,
				top: 36,
				bottom: 18,
				containLabel: true,
			},
			legend: {
				top: 0,
				type: "scroll",
				icon: "circle",
				textStyle: { color: "#475569", fontSize: 12 },
			},
			tooltip: {
				trigger: "item",
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
				formatter: (params: unknown) => {
					const point = params as {
						seriesName?: string;
						name?: string;
						data?: {
							value?: number | null;
							salesAmount?: number;
							invoiceCount?: number;
							storeCount?: number;
							salesShare?: number;
							monthLabel?: string;
							totalSalesAmount?: number;
						};
					};
					const data = point.data;
					if (!data || typeof data.value !== "number") return "";
					return `<div style="min-width:240px">
						<div style="margin-bottom:8px;font-weight:600">${point.seriesName ?? "-"} - ${data.monthLabel ?? point.name ?? "-"}</div>
						<div style="display:flex;justify-content:space-between;gap:16px;">
							<span>Peringkat</span>
							<strong>#${data.value}</strong>
						</div>
						<div style="display:flex;justify-content:space-between;gap:16px;">
							<span>Omzet Bulan Ini</span>
							<strong>${formatRupiah(data.salesAmount ?? 0)}</strong>
						</div>
						<div style="display:flex;justify-content:space-between;gap:16px;">
							<span>Invoice</span>
							<strong>${Number(data.invoiceCount ?? 0).toLocaleString("id-ID")}</strong>
						</div>
						<div style="display:flex;justify-content:space-between;gap:16px;">
							<span>Toko</span>
							<strong>${Number(data.storeCount ?? 0).toLocaleString("id-ID")}</strong>
						</div>
						<div style="margin-top:8px;color:#cbd5e1">Share tahunan ${formatPercent(data.salesShare ?? 0)} • total ${formatRupiah(data.totalSalesAmount ?? 0)}</div>
					</div>`;
				},
			},
			xAxis: {
				type: "category",
				axisTick: { show: false },
				axisLine: { lineStyle: { color: "#cbd5e1" } },
				axisLabel: { color: "#64748b" },
				data: filteredMonthLabels,
			},
			yAxis: {
				type: "value",
				min: 1,
				max: Math.max(rankedItems.length, 1),
				inverse: true,
				interval: 1,
				axisLabel: {
					color: "#64748b",
					formatter: (value: number) => `#${value}`,
				},
				splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
			},
			series,
		};
	}, [filteredMonthLabels, rankedItems.length, series]);

	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="mt-1 text-sm text-slate-500">{helper}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<select
						value={selectedYear}
						onChange={(event) => onSelectedYearChange(Number(event.target.value))}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
					>
						{availableYears.map((year) => (
							<option key={year} value={year}>
								Tahun {year}
							</option>
						))}
					</select>
				</div>
			</div>

			{rankedItems.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data peringkat sales untuk ditampilkan.
				</div>
			) : !hasData ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada transaksi sales pada periode yang dipilih.
				</div>
			) : (
				<>
					<EChart
						option={option}
						height={chartHeight}
						className="mt-5"
						onClick={
							onPointClick
								? (params) => {
										const seriesName = (params as { seriesName?: string }).seriesName;
										if (!seriesName) return;
										const item = rankedItems.find((entry) => entry.label === seriesName);
										if (!item) return;
										onPointClick(item);
								  }
								: undefined
						}
					/>
					{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
				</>
			)}
		</div>
	);
}
