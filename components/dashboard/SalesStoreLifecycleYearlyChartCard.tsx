"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { resolveChartColor, withAlpha } from "@/components/dashboard/chart-utils";
import type { LifecycleMetricKey, SalesStoreLifecycleMonthlyItem } from "@/components/dashboard/SalesStoreLifecycleChartCard";

const MONTH_OPTIONS = [
	{ monthNumber: 1, monthLabel: "Jan" },
	{ monthNumber: 2, monthLabel: "Feb" },
	{ monthNumber: 3, monthLabel: "Mar" },
	{ monthNumber: 4, monthLabel: "Apr" },
	{ monthNumber: 5, monthLabel: "Mei" },
	{ monthNumber: 6, monthLabel: "Jun" },
	{ monthNumber: 7, monthLabel: "Jul" },
	{ monthNumber: 8, monthLabel: "Ags" },
	{ monthNumber: 9, monthLabel: "Sep" },
	{ monthNumber: 10, monthLabel: "Okt" },
	{ monthNumber: 11, monthLabel: "Nov" },
	{ monthNumber: 12, monthLabel: "Des" },
];

export interface LifecycleSalesOption {
	id: string;
	label: string;
}

export type LifecycleVerticalMode = "compare_two_sales" | "all_sales_month";

export interface LifecycleYearlyChartClickPayload {
	salesUserId: string;
	salesLabel: string;
	monthNumber: number;
	metric: LifecycleMetricKey;
}

type ChartRow = {
	key: string;
	title: string;
	items: SalesStoreLifecycleMonthlyItem[];
	xAxisLabels: string[];
};

const resolveMetricKey = (seriesName: string | undefined): LifecycleMetricKey => {
	if (seriesName === "Transaksi Pertama") return "firstOrder";
	if (seriesName === "Toko Lama") return "legacyStore";
	if (seriesName === "Repeat Order") return "repeatOrder";
	return "newStore";
};

export default function SalesStoreLifecycleYearlyChartCard({
	title,
	helper,
	items,
	salesOptions,
	mode,
	selectedYear,
	availableYears,
	selectedPrimarySalesUserId,
	selectedSecondarySalesUserId,
	selectedMonth,
	onSelectedYearChange,
	onModeChange,
	onSelectedPrimarySalesUserIdChange,
	onSelectedSecondarySalesUserIdChange,
	onSelectedMonthChange,
	detailPanel,
	onChartPointClick,
}: {
	title: string;
	helper: string;
	items: SalesStoreLifecycleMonthlyItem[];
	salesOptions: LifecycleSalesOption[];
	mode: LifecycleVerticalMode;
	selectedYear: number;
	availableYears: number[];
	selectedPrimarySalesUserId: string;
	selectedSecondarySalesUserId: string;
	selectedMonth: number;
	onSelectedYearChange: (year: number) => void;
	onModeChange: (mode: LifecycleVerticalMode) => void;
	onSelectedPrimarySalesUserIdChange: (salesUserId: string) => void;
	onSelectedSecondarySalesUserIdChange: (salesUserId: string) => void;
	onSelectedMonthChange: (month: number) => void;
	detailPanel?: ReactNode;
	onChartPointClick?: (payload: LifecycleYearlyChartClickPayload) => void;
}) {
	const resolvedPrimarySales = useMemo(
		() => salesOptions.find((option) => option.id === selectedPrimarySalesUserId) ?? salesOptions[0] ?? null,
		[salesOptions, selectedPrimarySalesUserId],
	);
	const resolvedSecondarySales = useMemo(() => {
		const fallback = salesOptions.find((option) => option.id !== resolvedPrimarySales?.id) ?? salesOptions[0] ?? null;
		return salesOptions.find((option) => option.id === selectedSecondarySalesUserId) ?? fallback;
	}, [resolvedPrimarySales?.id, salesOptions, selectedSecondarySalesUserId]);

	const chartRows = useMemo<ChartRow[]>(() => {
		if (mode === "compare_two_sales") {
			const buildSalesYearlyItems = (salesId: string | undefined) =>
				items
					.filter((item) => item.id === salesId)
					.sort((left, right) => left.monthNumber - right.monthNumber);

			return [
				{
					key: resolvedPrimarySales?.id ?? "primary",
					title: resolvedPrimarySales?.label ? `Siklus Tahunan ${resolvedPrimarySales.label}` : "Sales 1",
					items: buildSalesYearlyItems(resolvedPrimarySales?.id),
					xAxisLabels: MONTH_OPTIONS.map((item) => item.monthLabel),
				},
				{
					key: resolvedSecondarySales?.id ?? "secondary",
					title: resolvedSecondarySales?.label ? `Siklus Tahunan ${resolvedSecondarySales.label}` : "Sales 2",
					items: buildSalesYearlyItems(resolvedSecondarySales?.id),
					xAxisLabels: MONTH_OPTIONS.map((item) => item.monthLabel),
				},
			];
		}

		const allSalesItems = items
			.filter((item) => item.monthNumber === selectedMonth)
			.sort((left, right) => left.label.localeCompare(right.label));
		const monthLabel = MONTH_OPTIONS.find((item) => item.monthNumber === selectedMonth)?.monthLabel ?? selectedMonth;
		const chunkSize = 10;
		const rows: ChartRow[] = [];
		for (let index = 0; index < allSalesItems.length; index += chunkSize) {
			const chunk = allSalesItems.slice(index, index + chunkSize);
			rows.push({
				key: `all-sales-${index}`,
				title: `Semua Sales (${monthLabel})${allSalesItems.length > chunkSize ? ` - Bagian ${Math.floor(index / chunkSize) + 1}` : ""}`,
				items: chunk,
				xAxisLabels: chunk.map((item) => item.label),
			});
		}

		return rows.length > 0
			? rows
			: [
					{
						key: "all-sales-empty",
						title: `Semua Sales (${monthLabel})`,
						items: [],
						xAxisLabels: [],
					},
				];
	}, [items, mode, resolvedPrimarySales?.id, resolvedPrimarySales?.label, resolvedSecondarySales?.id, resolvedSecondarySales?.label, selectedMonth]);

	const chartOption = useMemo<EChartsOption>(() => {
		const rowCount = Math.max(chartRows.length, 1);
		const gridHeight = 100 / rowCount;
		const grid = chartRows.map((_, index) => {
			const topPercent = index * gridHeight;
			return {
				left: 12,
				right: 18,
				top: index === 0 ? 48 : `${topPercent + 8}%`,
				bottom: index === rowCount - 1 ? 24 : `${100 - (topPercent + gridHeight) + 8}%`,
				containLabel: true,
			};
		});

		return {
			animationDuration: 700,
			legend: {
				top: 0,
				icon: "roundRect",
				textStyle: { color: "#475569", fontSize: 12 },
			},
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
				formatter: (params: unknown) => {
					const rows = Array.isArray(params) ? params : [];
					const firstRow = rows[0] as { componentSubType?: string; dataIndex?: number; axisIndex?: number } | undefined;
					if (firstRow?.componentSubType !== "bar" || typeof firstRow.dataIndex !== "number") return "";
					const axisIndex = firstRow.axisIndex ?? 0;
					const row = chartRows[axisIndex] ?? chartRows[0];
					const item = row?.items[firstRow.dataIndex];
					if (!item) return "";
					const label = mode === "compare_two_sales" ? item.monthLabel : item.label;
					return [
						`<strong>${label}</strong>`,
						`Toko Baru: ${item.newStoreCount}`,
						`Transaksi Pertama: ${item.firstOrderStoreCount}`,
						`Toko Lama: ${item.legacyStoreCount}`,
						`Repeat Order: ${item.repeatOrderCount}`,
					].join("<br/>");
				},
			},
			grid,
			xAxis: chartRows.map((row, index) => ({
				type: "category" as const,
				gridIndex: index,
				triggerEvent: Boolean(onChartPointClick),
				axisTick: { show: false },
				axisLine: { lineStyle: { color: "#e2e8f0" } },
				axisLabel: {
					color: "#64748b",
					interval: 0,
					rotate: mode === "all_sales_month" ? 24 : 0,
				},
				data: row.xAxisLabels,
			})),
			yAxis: chartRows.map((_, index) => ({
				type: "value" as const,
				gridIndex: index,
				axisLabel: { color: "#64748b" },
				splitLine: { lineStyle: { color: "#e2e8f0" } },
			})),
			graphic: chartRows.map((row, index) => ({
				type: "text",
				left: 16,
				top: index === 0 ? 28 : `${index * gridHeight + 4}%`,
				style: {
					text: row.title,
					fill: "#0f172a",
					fontSize: 12,
					fontWeight: 600,
				},
			})),
			series: chartRows.flatMap((row, index) => [
				{
					name: "Toko Baru",
					type: "bar" as const,
					xAxisIndex: index,
					yAxisIndex: index,
					barMaxWidth: 18,
					itemStyle: {
						color: resolveChartColor("bg-sky-500"),
						borderRadius: [8, 8, 0, 0],
					},
					emphasis: { itemStyle: { shadowBlur: 16, shadowColor: withAlpha("bg-sky-500", 0.28) } },
					data: row.items.map((item) => item.newStoreCount),
				},
				{
					name: "Transaksi Pertama",
					type: "bar" as const,
					xAxisIndex: index,
					yAxisIndex: index,
					barMaxWidth: 18,
					itemStyle: {
						color: resolveChartColor("bg-amber-500"),
						borderRadius: [8, 8, 0, 0],
					},
					emphasis: { itemStyle: { shadowBlur: 16, shadowColor: withAlpha("bg-amber-500", 0.28) } },
					data: row.items.map((item) => item.firstOrderStoreCount),
				},
				{
					name: "Toko Lama",
					type: "bar" as const,
					xAxisIndex: index,
					yAxisIndex: index,
					barMaxWidth: 18,
					itemStyle: {
						color: resolveChartColor("bg-slate-900"),
						borderRadius: [8, 8, 0, 0],
					},
					emphasis: { itemStyle: { shadowBlur: 16, shadowColor: withAlpha("bg-slate-900", 0.2) } },
					data: row.items.map((item) => item.legacyStoreCount),
				},
				{
					name: "Repeat Order",
					type: "bar" as const,
					xAxisIndex: index,
					yAxisIndex: index,
					barMaxWidth: 18,
					itemStyle: {
						color: resolveChartColor("bg-emerald-500"),
						borderRadius: [8, 8, 0, 0],
					},
					emphasis: { itemStyle: { shadowBlur: 16, shadowColor: withAlpha("bg-emerald-500", 0.28) } },
					data: row.items.map((item) => item.repeatOrderCount),
				},
			]),
		};
	}, [chartRows, mode, onChartPointClick]);

	const chartClickRows = chartRows;
	const chartHeight = useMemo(() => {
		if (mode === "compare_two_sales") return 620;
		return Math.max(340, chartRows.length * 280);
	}, [chartRows.length, mode]);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<h2 className="text-base font-semibold text-slate-900">{title}</h2>
						<p className="mt-1 text-sm text-slate-500">{helper}</p>
					</div>
					<div className="inline-flex whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 p-1">
						<button
							type="button"
							onClick={() => onModeChange("compare_two_sales")}
							className={`rounded-md px-3 py-1.5 text-sm ${
								mode === "compare_two_sales" ? "bg-slate-900 text-white" : "text-slate-600"
							}`}
						>
							Bandingkan Sales
						</button>
						<button
							type="button"
							onClick={() => onModeChange("all_sales_month")}
							className={`rounded-md px-3 py-1.5 text-sm ${
								mode === "all_sales_month" ? "bg-slate-900 text-white" : "text-slate-600"
							}`}
						>
							Semua Sales
						</button>
					</div>
				</div>

				<div className="grid gap-3 lg:grid-cols-3">
					{mode === "compare_two_sales" ? (
						<label className="flex items-center gap-2 text-sm text-slate-600">
							<span>Tahun</span>
							<select
								value={selectedYear}
								onChange={(event) => onSelectedYearChange(Number(event.target.value))}
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								{availableYears.map((year) => (
									<option key={year} value={year}>
										{year}
									</option>
								))}
							</select>
						</label>
					) : (
						<label className="flex items-center gap-2 text-sm text-slate-600">
							<span>Bulan</span>
							<select
								value={selectedMonth}
								onChange={(event) => onSelectedMonthChange(Number(event.target.value))}
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								{MONTH_OPTIONS.map((option) => (
									<option key={option.monthNumber} value={option.monthNumber}>
										{option.monthLabel}
									</option>
								))}
							</select>
						</label>
					)}
					{mode === "compare_two_sales" ? (
						<label className="flex items-center gap-2 text-sm text-slate-600">
							<span>Sales 1</span>
							<select
								value={selectedPrimarySalesUserId}
								onChange={(event) => onSelectedPrimarySalesUserIdChange(event.target.value)}
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								{salesOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
						</label>
					) : null}
					{mode === "compare_two_sales" ? (
						<label className="flex items-center gap-2 text-sm text-slate-600">
							<span>Sales 2</span>
							<select
								value={selectedSecondarySalesUserId}
								onChange={(event) => onSelectedSecondarySalesUserIdChange(event.target.value)}
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								{salesOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
						</label>
					) : null}
				</div>
			</div>

			<div className="mt-5 rounded-2xl border border-slate-200 p-4">
				<p className="text-xs text-slate-500">
					{mode === "compare_two_sales"
						? "Chart atas untuk Sales 1 dan chart bawah untuk Sales 2. Keduanya menampilkan perjalanan 12 bulan penuh."
						: "Mode semua sales membatasi tampilan ke satu bulan saja, lalu membagi daftar sales ke dua chart agar tetap mudah dibaca saat jumlah sales banyak."}
				</p>
				{chartRows.some((row) => row.items.length > 0) ? (
					<EChart
						option={chartOption}
						height={chartHeight}
						className="mt-4"
						onClick={
							onChartPointClick
								? (params) => {
										const point = params as {
											componentType?: string;
											dataIndex?: number;
											seriesName?: string;
											seriesIndex?: number;
											componentIndex?: number;
											xAxisIndex?: number;
											xAxisId?: string;
											value?: string;
										};
										const seriesIndex = point.seriesIndex ?? 0;
										const rawAxisIndex =
											typeof point.xAxisIndex === "number" ? point.xAxisIndex : point.componentIndex;
										const rowIndex = typeof rawAxisIndex === "number" ? rawAxisIndex : Math.floor(seriesIndex / 4);
										const row = chartClickRows[rowIndex] ?? chartClickRows[0];
										const dataIndex =
											typeof point.dataIndex === "number"
												? point.dataIndex
												: point.componentType === "xAxis"
													? row?.xAxisLabels.findIndex((label) => label === point.value)
													: undefined;
										if (typeof dataIndex !== "number") return;
										const item = row?.items[dataIndex];
										if (!item) return;
										onChartPointClick({
											salesUserId: item.id,
											salesLabel: item.label,
											monthNumber: item.monthNumber,
											metric: resolveMetricKey(point.seriesName),
										});
								  }
								: undefined
						}
						onChartAreaClick={
							onChartPointClick
								? ({ offsetX, offsetY, chart }) => {
										for (let rowIndex = 0; rowIndex < chartClickRows.length; rowIndex += 1) {
											if (!chart.containPixel({ gridIndex: rowIndex }, [offsetX, offsetY])) continue;
											const converted = chart.convertFromPixel({ gridIndex: rowIndex }, [offsetX, offsetY]);
											const dataIndex = Array.isArray(converted) ? Math.round(Number(converted[0])) : NaN;
											const row = chartClickRows[rowIndex];
											const item = Number.isFinite(dataIndex) ? row?.items[dataIndex] : null;
											if (!item) return;
											onChartPointClick({
												salesUserId: item.id,
												salesLabel: item.label,
												monthNumber: item.monthNumber,
												metric: "newStore",
											});
											return;
										}
									}
								: undefined
						}
					/>
				) : (
					<div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
						Belum ada data siklus tahunan sales untuk ditampilkan.
					</div>
				)}
			</div>

			{detailPanel ? <div className="mt-4">{detailPanel}</div> : null}
		</div>
	);
}
