"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatPercent, formatRupiah, withAlpha } from "@/components/dashboard/chart-utils";

export interface BrandPerformanceItem {
	id: string;
	label: string;
	salesAmount: number;
	salesShare: number;
	growthRate: number;
}

export default function BrandPerformanceHeatmapCard({
	title,
	helper,
	items,
	footer,
	onPointClick,
	className,
}: {
	title: string;
	helper: string;
	items: BrandPerformanceItem[];
	footer?: string;
	onPointClick?: (item: BrandPerformanceItem) => void;
	className?: string;
}) {
	const rankedItems = useMemo(() => [...items].sort((a, b) => b.salesAmount - a.salesAmount).slice(0, 10), [items]);

	const option = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 650,
			grid: {
				left: 12,
				right: 24,
				top: 32,
				bottom: 12,
				containLabel: true,
			},
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
				formatter: (params: unknown) => {
					const rows = Array.isArray(params) ? params : [params];
					const first = rows[0] as { dataIndex?: number } | undefined;
					const item =
						typeof first?.dataIndex === "number" ? rankedItems[first.dataIndex] : undefined;
					if (!item) return "";
					return `<div style="min-width:200px">
						<div style="font-weight:600;margin-bottom:6px">${item.label}</div>
						<div>Omzet: ${formatRupiah(item.salesAmount)}</div>
						<div style="margin-top:4px">Share: ${formatPercent(item.salesShare)}</div>
						<div style="margin-top:4px">Growth: ${formatPercent(item.growthRate)}</div>
					</div>`;
				},
			},
			xAxis: {
				type: "value",
				axisTick: { show: false },
				axisLine: { lineStyle: { color: "#cbd5e1" } },
				axisLabel: {
					color: "#64748b",
					formatter: (value: number) => formatRupiah(value),
				},
				splitLine: { lineStyle: { color: "#e2e8f0" } },
			},
			yAxis: {
				type: "category",
				inverse: true,
				data: rankedItems.map((item) => item.label),
				axisTick: { show: false },
				axisLine: { show: false },
				axisLabel: { color: "#0f172a", fontWeight: 600, width: 140, overflow: "truncate" },
			},
			series: [
				{
					type: "bar",
					barMaxWidth: 18,
					label: {
						show: true,
						color: "#334155",
						fontWeight: 600,
						position: "right",
						formatter: (params: unknown) => {
							const point = params as { dataIndex?: number };
							const item =
								typeof point.dataIndex === "number" ? rankedItems[point.dataIndex] : undefined;
							return item ? formatPercent(item.growthRate) : "";
						},
					},
					itemStyle: {
						borderRadius: 999,
						color: (params: unknown) => {
							const point = params as { dataIndex?: number };
							const item =
								typeof point.dataIndex === "number" ? rankedItems[point.dataIndex] : undefined;
							if (!item) return withAlpha("bg-slate-900", 0.85);
							if (item.growthRate > 0) return withAlpha("bg-emerald-500", 0.9);
							if (item.growthRate < 0) return withAlpha("bg-rose-500", 0.85);
							return withAlpha("bg-amber-500", 0.85);
						},
					},
					emphasis: {
						itemStyle: {
							shadowBlur: 14,
							shadowColor: withAlpha("bg-slate-900", 0.18),
						},
					},
					data: rankedItems.map((item) => item.salesAmount),
				},
			],
		};
	}, [rankedItems]);

	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
			<h2 className="text-base font-semibold text-slate-900">{title}</h2>
			<p className="mt-1 text-sm text-slate-500">{helper}</p>

			{rankedItems.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data brand untuk ditampilkan.
				</div>
			) : (
				<>
					<EChart
						option={option}
						height={280}
						className="mt-5"
						onClick={
							onPointClick
								? (params) => {
										const dataIndex = (params as { dataIndex?: number }).dataIndex;
										if (typeof dataIndex !== "number") return;
										const item = rankedItems[dataIndex];
										if (!item) return;
										onPointClick(item);
								  }
								: undefined
						}
					/>
					<div className="mt-5 overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-4 py-3">Brand</th>
									<th className="px-4 py-3 text-right">Omzet</th>
									<th className="px-4 py-3 text-right">Share</th>
									<th className="px-4 py-3 text-right">Growth</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{rankedItems.map((item) => (
									<tr key={item.id}>
										<td className="px-4 py-3 font-medium text-slate-900">{item.label}</td>
										<td className="px-4 py-3 text-right text-slate-700">{formatRupiah(item.salesAmount)}</td>
										<td className="px-4 py-3 text-right text-slate-700">{formatPercent(item.salesShare)}</td>
										<td
											className={`px-4 py-3 text-right font-medium ${
												item.growthRate > 0
													? "text-emerald-600"
													: item.growthRate < 0
														? "text-rose-600"
														: "text-slate-700"
											}`}
										>
											{formatPercent(item.growthRate)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
				</>
			)}
		</div>
	);
}
