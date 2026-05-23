"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { resolveChartColor, withAlpha } from "@/components/dashboard/chart-utils";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function AgingDistributionCard({
	title,
	helper,
	items,
	className,
	showBreakdown = true,
	chartHeight = 320,
	embedded = false,
}: {
	title: string;
	helper: string;
	items: Array<{
		label: string;
		amount: number;
		count: number;
		color: string;
	}>;
	className?: string;
	showBreakdown?: boolean;
	chartHeight?: number;
	embedded?: boolean;
}) {
	const option = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 600,
			tooltip: {
				trigger: "item",
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
				formatter: (params: unknown) => {
					const point = params as { name?: string; value?: number; data?: { count?: number } };
					return `
						<div style="min-width:160px">
							<div style="font-weight:600;margin-bottom:6px">${point.name ?? "-"}</div>
							<div>${formatRupiah(point.value ?? 0)}</div>
							<div style="margin-top:4px;color:#cbd5e1">${point.data?.count ?? 0} invoice</div>
						</div>
					`;
				},
			},
			series: [
				{
					type: "pie",
					radius: ["36%", "72%"],
					center: ["50%", "50%"],
					roseType: "radius",
					itemStyle: {
						borderRadius: 10,
						borderColor: "#ffffff",
						borderWidth: 3,
					},
					label: {
						color: "#334155",
						formatter: "{b}",
						fontSize: 11,
					},
					labelLine: {
						lineStyle: { color: "#cbd5e1" },
					},
					data: items.map((item) => ({
						name: item.label,
						value: item.amount,
						count: item.count,
						itemStyle: {
							color: resolveChartColor(item.color),
							shadowBlur: 18,
							shadowColor: withAlpha(item.color, 0.24),
						},
					})),
				},
			],
		};
	}, [items]);

	const containerClassName = embedded
		? className ?? ""
		: `rounded-2xl border border-slate-200 bg-white p-5 ${className ?? ""}`;

	return (
		<div className={containerClassName}>
			<h2 className="text-base font-semibold text-slate-900">{title}</h2>
			<p className="mt-1 text-sm text-slate-500">{helper}</p>

			{items.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data aging untuk ditampilkan.
				</div>
			) : (
				<>
					<EChart option={option} height={chartHeight} className="mt-4" />
					{showBreakdown ? (
						<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
							{items.map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 p-3">
									<div className="flex items-center gap-2">
										<span
											className="h-2.5 w-2.5 rounded-full"
											style={{ backgroundColor: resolveChartColor(item.color) }}
										/>
										<p className="text-sm font-medium text-slate-800">{item.label}</p>
									</div>
									<p className="mt-2 text-sm font-semibold text-slate-900">{formatRupiah(item.amount)}</p>
									<p className="mt-1 text-xs text-slate-500">{item.count.toLocaleString()} invoice</p>
								</div>
							))}
						</div>
					) : null}
				</>
			)}
		</div>
	);
}
