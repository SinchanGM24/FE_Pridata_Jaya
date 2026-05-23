"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatRupiah, resolveChartColor, withAlpha } from "@/components/dashboard/chart-utils";

export interface TopCustomerDebtPoint {
	id: string;
	label: string;
	outstandingAmount: number;
	overdueAmount: number;
	invoiceCount: number;
	overdueCount: number;
}

export default function TopCustomerDebtChartCard({
	title,
	helper,
	items,
	footer,
	onPointClick,
}: {
	title: string;
	helper: string;
	items: TopCustomerDebtPoint[];
	footer?: string;
	onPointClick?: (item: TopCustomerDebtPoint) => void;
}) {
	const rankedItems = useMemo(
		() => [...items].sort((left, right) => right.overdueAmount - left.overdueAmount).slice(0, 8),
		[items],
	);

	const option = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 650,
			grid: {
				left: 12,
				right: 18,
				top: 56,
				bottom: 12,
				containLabel: true,
			},
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
					const rows = Array.isArray(params) ? params : [params];
					const first = rows[0] as { name?: string; dataIndex?: number } | undefined;
					const current = typeof first?.dataIndex === "number" ? rankedItems[first.dataIndex] : null;
					const body = rows
						.map((row) => {
							const point = row as { seriesName?: string; value?: number };
							if (point.seriesName === "Invoice Aktif" || point.seriesName === "Invoice Overdue") {
								return `<div style="display:flex;justify-content:space-between;gap:16px;">
									<span>${point.seriesName}</span>
									<strong>${Number(point.value ?? 0).toLocaleString("id-ID")}</strong>
								</div>`;
							}
							return `<div style="display:flex;justify-content:space-between;gap:16px;">
								<span>${point.seriesName ?? "-"}</span>
								<strong>${formatRupiah(Number(point.value ?? 0))}</strong>
							</div>`;
						})
						.join("");
					const extra = current
						? `<div style="margin-top:8px;color:#cbd5e1">${current.overdueCount.toLocaleString("id-ID")} invoice overdue dari ${current.invoiceCount.toLocaleString("id-ID")} invoice aktif</div>`
						: "";
					return `<div style="min-width:220px"><div style="margin-bottom:8px;font-weight:600">${first?.name ?? "-"}</div>${body}${extra}</div>`;
				},
			},
			xAxis: [
				{
					type: "value",
					axisLabel: {
						color: "#64748b",
						formatter: (value: number) => formatRupiah(value),
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
			yAxis: {
				type: "category",
				inverse: true,
				axisTick: { show: false },
				axisLine: { show: false },
				axisLabel: {
					color: "#0f172a",
					fontWeight: 600,
					width: 140,
					overflow: "truncate",
				},
				data: rankedItems.map((item) => item.label),
			},
			series: [
				{
					name: "Outstanding",
					type: "bar",
					barMaxWidth: 18,
					itemStyle: {
						color: resolveChartColor("bg-amber-500"),
						borderRadius: 8,
					},
					emphasis: {
						itemStyle: {
							shadowBlur: 16,
							shadowColor: withAlpha("bg-amber-500", 0.28),
						},
					},
					data: rankedItems.map((item) => item.outstandingAmount),
				},
				{
					name: "Overdue",
					type: "bar",
					barGap: "-55%",
					barMaxWidth: 12,
					itemStyle: {
						color: resolveChartColor("bg-rose-500"),
						borderRadius: 8,
					},
					data: rankedItems.map((item) => item.overdueAmount),
				},
				{
					name: "Invoice Aktif",
					type: "line",
					xAxisIndex: 1,
					smooth: true,
					symbolSize: 8,
					lineStyle: { width: 3, color: resolveChartColor("bg-sky-500") },
					itemStyle: { color: resolveChartColor("bg-sky-500") },
					data: rankedItems.map((item) => item.invoiceCount),
				},
				{
					name: "Invoice Overdue",
					type: "line",
					xAxisIndex: 1,
					smooth: true,
					symbolSize: 7,
					lineStyle: { width: 2, color: resolveChartColor("bg-slate-900"), type: "dashed" },
					itemStyle: { color: resolveChartColor("bg-slate-900") },
					data: rankedItems.map((item) => item.overdueCount),
				},
			],
		};
	}, [rankedItems]);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="text-base font-semibold text-slate-900">{title}</h2>
			<p className="mt-1 text-sm text-slate-500">{helper}</p>

			{rankedItems.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data utang pelanggan untuk ditampilkan.
				</div>
			) : (
				<>
					<EChart
						option={option}
						height={360}
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
					<div className="mt-5 grid gap-3 md:grid-cols-3">
						{rankedItems.slice(0, 3).map((item, index) => (
							<div key={item.id} className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">#{index + 1} Risiko</p>
								<p className="mt-2 text-base font-semibold text-slate-900">{item.label}</p>
								<div className="mt-3 space-y-2 text-sm">
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500">Overdue</span>
										<span className="font-medium text-rose-600">{formatRupiah(item.overdueAmount)}</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500">Outstanding</span>
										<span className="font-medium text-slate-900">{formatRupiah(item.outstandingAmount)}</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500">Invoice overdue</span>
										<span className="font-medium text-slate-900">{item.overdueCount.toLocaleString("id-ID")}</span>
									</div>
								</div>
							</div>
						))}
					</div>
					{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
				</>
			)}
		</div>
	);
}
