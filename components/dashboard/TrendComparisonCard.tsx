"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function TrendComparisonCard({
	title,
	helper,
	data,
	primaryLabel,
	secondaryLabel,
	primaryKey,
	secondaryKey,
	embedded = false,
}: {
	title: string;
	helper: string;
	data: Array<Record<string, number | string>>;
	primaryLabel: string;
	secondaryLabel: string;
	primaryKey: string;
	secondaryKey: string;
	embedded?: boolean;
}) {
	const option = useMemo<EChartsOption>(() => {
		const chartData = data.map((item) => {
			const primaryValue = Number(item[primaryKey] ?? 0);
			const secondaryValue = Number(item[secondaryKey] ?? 0);
			return {
				label: String(item.label ?? item.monthLabel ?? item.year ?? ""),
				primaryValue,
				secondaryValue,
				collectionRate: primaryValue > 0 ? (secondaryValue / primaryValue) * 100 : 0,
			};
		});

		return {
			animationDuration: 650,
			grid: {
				left: 12,
				right: 16,
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
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
			},
			xAxis: {
				type: "category",
				axisTick: { show: false },
				axisLine: { lineStyle: { color: "#cbd5e1" } },
				axisLabel: { color: "#64748b" },
				data: chartData.map((item) => item.label),
			},
			yAxis: [
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
					min: 0,
					max: 100,
					axisLabel: {
						color: "#94a3b8",
						formatter: (value: number) => `${value}%`,
					},
					splitLine: { show: false },
				},
			],
			series: [
				{
					name: primaryLabel,
					type: "bar",
					barMaxWidth: 28,
					itemStyle: { color: "#0f172a", borderRadius: [10, 10, 0, 0] },
					data: chartData.map((item) => item.primaryValue),
				},
				{
					name: secondaryLabel,
					type: "bar",
					barMaxWidth: 28,
					itemStyle: { color: "#10b981", borderRadius: [10, 10, 0, 0] },
					data: chartData.map((item) => item.secondaryValue),
				},
				{
					name: "Rasio Tertagih",
					type: "line",
					yAxisIndex: 1,
					smooth: true,
					symbolSize: 8,
					lineStyle: { width: 3, color: "#f59e0b" },
					itemStyle: { color: "#f59e0b" },
					data: chartData.map((item) => Number(item.collectionRate.toFixed(1))),
				},
			],
		};
	}, [data, primaryKey, primaryLabel, secondaryKey, secondaryLabel]);

	return (
		<div className={embedded ? "" : "rounded-2xl border border-slate-200 bg-white p-5"}>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="mt-1 text-sm text-slate-500">{helper}</p>
				</div>

				<div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
						{primaryLabel}
					</div>
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
						{secondaryLabel}
					</div>
				</div>
			</div>

			{data.length === 0 ? (
				<div className={`mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 ${embedded ? "bg-slate-50" : ""}`}>
					Belum ada data tren untuk ditampilkan.
				</div>
			) : (
				<EChart option={option} height={320} className="mt-6" />
			)}
		</div>
	);
}
