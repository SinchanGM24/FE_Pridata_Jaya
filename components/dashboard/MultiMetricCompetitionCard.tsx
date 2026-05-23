"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { resolveChartColor, withAlpha } from "@/components/dashboard/chart-utils";

export interface CompetitionMetric {
	key: string;
	label: string;
	color: string;
	type?: "bar" | "line";
	axis?: "currency" | "count";
}

export interface CompetitionItem {
	id: string;
	label: string;
	subtitle?: string;
	badge?: string;
	values: Record<string, number>;
}

const formatCompactCurrency = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 1,
		notation: "compact",
	}).format(value);

const wrapAxisLabel = (value: string, maxLineLength = 16) => {
	const words = value.split(/\s+/).filter(Boolean);
	if (words.length === 0) return value;

	const lines: string[] = [];
	let currentLine = "";

	words.forEach((word) => {
		if (word.length > maxLineLength) {
			if (currentLine) {
				lines.push(currentLine);
				currentLine = "";
			}
			for (let index = 0; index < word.length; index += maxLineLength) {
				lines.push(word.slice(index, index + maxLineLength));
			}
			return;
		}

		if (!currentLine) {
			currentLine = word;
			return;
		}

		if (`${currentLine} ${word}`.length <= maxLineLength) {
			currentLine = `${currentLine} ${word}`;
			return;
		}

		lines.push(currentLine);
		currentLine = word;
	});

	if (currentLine) lines.push(currentLine);
	return lines.join("\n");
};

export default function MultiMetricCompetitionCard({
	title,
	helper,
	items,
	metrics,
	defaultSortKey,
	valueFormatter,
	footer,
	maxItems = 8,
	className,
	controls,
	embedded = false,
	onItemClick,
	selectedItemId,
	paginationPageSize,
	paginationItemLabel = "item",
	chartHeight = 320,
	orientation = "horizontal",
	wrapCategoryLabels = false,
	barGap = "16%",
	barCategoryGap = "22%",
}: {
	title: string;
	helper: string;
	items: CompetitionItem[];
	metrics: CompetitionMetric[];
	defaultSortKey: string;
	valueFormatter: (value: number, metricKey: string) => string;
	footer?: string;
	maxItems?: number;
	className?: string;
	controls?: ReactNode;
	embedded?: boolean;
	onItemClick?: (item: CompetitionItem) => void;
	selectedItemId?: string;
	paginationPageSize?: number;
	paginationItemLabel?: string;
	chartHeight?: number;
	orientation?: "horizontal" | "vertical";
	wrapCategoryLabels?: boolean;
	barGap?: string;
	barCategoryGap?: string;
}) {
	const [page, setPage] = useState(1);
	const sortedAllItems = useMemo(() => {
		return [...items].sort((left, right) => (right.values[defaultSortKey] ?? 0) - (left.values[defaultSortKey] ?? 0));
	}, [defaultSortKey, items]);
	const pageSize = paginationPageSize ?? maxItems;
	const totalPages = paginationPageSize ? Math.max(1, Math.ceil(sortedAllItems.length / paginationPageSize)) : 1;
	const activePage = Math.min(page, totalPages);
	const sortedItems = useMemo(() => {
		if (!paginationPageSize) return sortedAllItems.slice(0, maxItems);
		return sortedAllItems.slice((activePage - 1) * pageSize, activePage * pageSize);
	}, [activePage, maxItems, pageSize, paginationPageSize, sortedAllItems]);
	const visibleStart = sortedAllItems.length === 0 ? 0 : (activePage - 1) * pageSize + 1;
	const visibleEnd = Math.min(activePage * pageSize, sortedAllItems.length);

	const option = useMemo<EChartsOption>(() => {
		const isVertical = orientation === "vertical";
		const metricSeries = metrics.map((metric) => {
			const data = sortedItems.map((item) => ({
				value: item.values[metric.key] ?? 0,
				itemStyle: {
					color: resolveChartColor(metric.color),
					borderRadius: 8,
					opacity: selectedItemId && item.id !== selectedItemId ? 0.38 : 1,
					borderColor: selectedItemId === item.id ? "#0f172a" : "transparent",
					borderWidth: selectedItemId === item.id ? 1 : 0,
				},
			}));

			if (metric.type === "line") {
				return {
					name: metric.label,
					type: "line" as const,
					...(isVertical
						? { yAxisIndex: metric.axis === "count" ? 1 : 0 }
						: { xAxisIndex: metric.axis === "count" ? 1 : 0 }),
					z: 2,
					emphasis: {
						focus: "series" as const,
					},
					data,
				};
			}

			return {
				name: metric.label,
				type: "bar" as const,
				...(isVertical
					? { yAxisIndex: metric.axis === "count" ? 1 : 0 }
					: { xAxisIndex: metric.axis === "count" ? 1 : 0 }),
				z: 2,
				emphasis: {
					focus: "series" as const,
					itemStyle: {
						shadowBlur: 16,
						shadowColor: withAlpha(metric.color, 0.28),
					},
				},
				barMaxWidth: 18,
				barGap,
				barCategoryGap,
				data,
			};
		});

		return {
			animationDuration: 600,
			grid: {
				left: 12,
				right: 18,
				top: 56,
				bottom: isVertical && wrapCategoryLabels ? 88 : 12,
				containLabel: true,
			},
			legend: {
				top: 0,
				data: metrics.map((metric) => metric.label),
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
					const rows = (Array.isArray(params) ? params : [params]).filter((row) => {
						const point = row as { seriesId?: string };
						return point.seriesId !== "sales-row-click-target";
					});
					const first = rows[0] as { name?: string } | undefined;
					const body = rows
						.map((row) => {
							const point = row as { seriesName?: string; value?: number; color?: string };
							return `<div style="display:flex;justify-content:space-between;gap:16px;">
								<span><span style="display:inline-block;margin-right:8px;border-radius:999px;width:8px;height:8px;background:${point.color ?? "#fff"}"></span>${point.seriesName ?? "-"}</span>
								<strong>${valueFormatter(point.value ?? 0, metrics.find((metric) => metric.label === point.seriesName)?.key ?? "")}</strong>
							</div>`;
						})
						.join("");
					return `<div style="min-width:180px"><div style="margin-bottom:8px;font-weight:600">${first?.name ?? "-"}</div>${body}</div>`;
				},
			},
			xAxis: isVertical
				? {
						type: "category",
						triggerEvent: Boolean(onItemClick),
						axisTick: { show: false },
						axisLine: { show: false },
						axisLabel: {
							color: "#0f172a",
							fontWeight: 600,
							width: wrapCategoryLabels ? 132 : 96,
							overflow: wrapCategoryLabels ? "break" : "truncate",
							interval: 0,
							rotate: wrapCategoryLabels ? 0 : sortedItems.length > 6 ? 28 : 0,
							hideOverlap: !wrapCategoryLabels,
							formatter: wrapCategoryLabels ? (value: string) => wrapAxisLabel(value, 16) : undefined,
						},
						data: sortedItems.map((item) => item.label),
					}
				: [
						{
							type: "value",
							axisLabel: {
								color: "#64748b",
								formatter: (value: number) => formatCompactCurrency(value),
							},
							splitLine: { lineStyle: { color: "#e2e8f0" } },
						},
						{
							type: "value",
							position: "top",
							axisLabel: {
								color: "#94a3b8",
								formatter: (value: number) => value.toLocaleString("id-ID"),
							},
							splitLine: { show: false },
						},
					],
			yAxis: isVertical
				? [
						{
							type: "value",
							axisLabel: {
								color: "#64748b",
								formatter: (value: number) => formatCompactCurrency(value),
							},
							splitLine: { lineStyle: { color: "#e2e8f0" } },
						},
						{
							type: "value",
							position: "right",
							axisLabel: {
								color: "#94a3b8",
								formatter: (value: number) => value.toLocaleString("id-ID"),
							},
							splitLine: { show: false },
						},
					]
				: {
						type: "category",
						inverse: true,
						triggerEvent: Boolean(onItemClick),
						axisTick: { show: false },
						axisLine: { show: false },
						axisLabel: {
							color: "#0f172a",
							fontWeight: 600,
							width: 140,
							overflow: "truncate",
						},
						data: sortedItems.map((item) => item.label),
					},
			series: metricSeries,
		};
	}, [barCategoryGap, barGap, metrics, onItemClick, orientation, selectedItemId, sortedItems, valueFormatter, wrapCategoryLabels]);

	const content = (
		<>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="mt-1 text-sm text-slate-500">{helper}</p>
				</div>
				{controls}
			</div>

			{sortedAllItems.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data untuk ditampilkan.
				</div>
			) : (
				<>
					<EChart
						option={option}
						height={chartHeight}
						className="mt-5"
						onClick={
							onItemClick
								? (params) => {
										const point = params as {
											componentType?: string;
											dataIndex?: number;
											seriesId?: string;
											value?: string;
										};
										const item =
											point.componentType === (orientation === "vertical" ? "xAxis" : "yAxis")
												? sortedItems.find((candidate) => candidate.label === point.value)
												: null;
										if (item) onItemClick(item);
									}
								: undefined
						}
						onChartAreaClick={
							onItemClick
								? ({ offsetX, offsetY, chart }) => {
										if (!chart.containPixel({ gridIndex: 0 }, [offsetX, offsetY])) return;
										const converted = chart.convertFromPixel({ gridIndex: 0 }, [offsetX, offsetY]);
										const categoryIndex = Array.isArray(converted)
											? Math.round(Number(orientation === "vertical" ? converted[0] : converted[1]))
											: NaN;
										const item = Number.isFinite(categoryIndex) ? sortedItems[categoryIndex] : null;
										if (item) onItemClick(item);
									}
								: undefined
						}
					/>
					{paginationPageSize ? (
						<div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
							<span>
								Menampilkan {visibleStart}-{visibleEnd} dari {sortedAllItems.length.toLocaleString("id-ID")} {paginationItemLabel}
							</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setPage((current) => Math.max(1, current - 1))}
									disabled={activePage <= 1}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Prev
								</button>
								<span>
									Halaman {activePage} / {totalPages}
								</span>
								<button
									type="button"
									onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
									disabled={activePage >= totalPages}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
						</div>
					) : null}
					{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
				</>
			)}
		</>
	);

	if (embedded) {
		return <div className={className}>{content}</div>;
	}

	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className ?? ""}`}>
			{content}
		</div>
	);
}
