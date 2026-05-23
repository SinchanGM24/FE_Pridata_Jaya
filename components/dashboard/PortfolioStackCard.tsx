"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { resolveChartColor } from "@/components/dashboard/chart-utils";

const formatPercent = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(value);

export default function PortfolioStackCard({
	title,
	helper,
	items,
	footer,
	valueFormatter,
	variant = "band",
	className,
	onPointClick,
	detailPanel,
}: {
	title: string;
	helper: string;
	items: Array<{
		label: string;
		value: number;
		helper?: string;
		color: string;
	}>;
	footer?: string;
	valueFormatter?: (value: number) => string;
	variant?: "band" | "donut";
	className?: string;
	onPointClick?: (label: string) => void;
	detailPanel?: React.ReactNode;
}) {
	const total = items.reduce((sum, item) => sum + item.value, 0);
	const option = useMemo<EChartsOption>(() => {
		if (variant === "band") {
			const ratioItems = items.map((item) => ({
				...item,
				ratio: total > 0 ? item.value / total : 0,
			}));
			return {
				animationDuration: 450,
				grid: {
					left: 12,
					right: 12,
					top: 14,
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
						const rows = Array.isArray(params) ? params : [];
						return rows
							.map((row) => {
								const point = row as { seriesName?: string; value?: number };
								const item = ratioItems.find((entry) => entry.label === point.seriesName);
								if (!item) return "";
								return `<div style="display:flex;justify-content:space-between;gap:16px;">
									<span>${item.label}</span>
									<strong>${formatPercent(item.ratio)}</strong>
								</div>`;
							})
							.join("");
					},
				},
				xAxis: {
					type: "value",
					max: 1,
					axisLabel: { show: false },
					axisTick: { show: false },
					axisLine: { show: false },
					splitLine: { show: false },
				},
				yAxis: {
					type: "category",
					data: ["Komposisi"],
					axisLabel: { show: false },
					axisTick: { show: false },
					axisLine: { show: false },
				},
				series: ratioItems.map((item) => ({
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
					data: [item.ratio],
				})),
			};
		}

		return {
			animationDuration: 500,
			tooltip: {
				trigger: "item",
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
				formatter: (params: unknown) => {
					const point = params as { name?: string; value?: number; percent?: number };
					const value = point.value ?? 0;
					return `
						<div style="min-width:160px">
							<div style="font-weight:600;margin-bottom:6px">${point.name ?? "-"}</div>
							<div>${valueFormatter ? valueFormatter(value) : value.toLocaleString("id-ID")}</div>
							<div style="margin-top:4px;color:#cbd5e1">${formatPercent((point.percent ?? 0) / 100)}</div>
						</div>
					`;
				},
			},
			graphic: total
				? [
						{
							type: "text",
							left: "center",
							top: "42%",
							style: {
								text: valueFormatter ? valueFormatter(total) : total.toLocaleString("id-ID"),
								textAlign: "center",
								fill: "#0f172a",
								fontWeight: 700,
								fontSize: 18,
							},
						},
						{
							type: "text",
							left: "center",
							top: "52%",
							style: {
								text: "Total",
								textAlign: "center",
								fill: "#64748b",
								fontSize: 11,
							},
						},
					]
				: undefined,
			series: [
				{
					type: "pie",
					radius: ["52%", "74%"],
					center: ["50%", "50%"],
					label: { show: false },
					labelLine: { show: false },
					itemStyle: {
						borderColor: "#fff",
						borderWidth: 3,
					},
					data: items.map((item) => ({
						name: item.label,
						value: item.value,
						itemStyle: { color: resolveChartColor(item.color) },
					})),
				},
			],
		};
	}, [items, total, valueFormatter, variant]);

	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className ?? ""}`}>
			<h2 className="text-base font-semibold text-slate-900">{title}</h2>
			<p className="mt-1 text-sm text-slate-500">{helper}</p>

			{items.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data komposisi untuk ditampilkan.
				</div>
			) : (
				<EChart
					option={option}
					height={variant === "band" ? 84 : 280}
					className="mt-4"
					onClick={
						onPointClick
							? (params) => {
									const seriesName = (params as { seriesName?: string }).seriesName;
									const pointName = (params as { name?: string }).name;
									const label = variant === "band" ? seriesName : pointName;
									if (!label) return;
									onPointClick(label);
							  }
							: undefined
					}
				/>
			)}

			<div className="mt-5 space-y-3">
				{items.map((item) => {
					const ratio = total > 0 ? item.value / total : 0;
					return (
						<div key={item.label} className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
									<p className="text-sm font-medium text-slate-800">{item.label}</p>
								</div>
								{item.helper ? <p className="mt-1 text-xs text-slate-500">{item.helper}</p> : null}
							</div>
							<div className="text-right">
								<p className="text-sm font-semibold text-slate-900">
									{valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString()}
								</p>
								<p className="text-xs text-slate-500">{formatPercent(ratio)}</p>
							</div>
						</div>
					);
				})}
			</div>

			{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
			{detailPanel ? <div className="mt-4">{detailPanel}</div> : null}
		</div>
	);
}
