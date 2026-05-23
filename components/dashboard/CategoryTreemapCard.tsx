"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatPercent, formatRupiah } from "@/components/dashboard/chart-utils";

export interface CategoryTreemapItem {
	id: string;
	label: string;
	salesAmount: number;
	salesShare: number;
}

export default function CategoryTreemapCard({
	title,
	helper,
	items,
	footer,
	onPointClick,
	className,
}: {
	title: string;
	helper: string;
	items: CategoryTreemapItem[];
	footer?: string;
	onPointClick?: (item: CategoryTreemapItem) => void;
	className?: string;
}) {
	const rankedItems = useMemo(() => [...items].sort((a, b) => b.salesAmount - a.salesAmount), [items]);

	const option = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 700,
			tooltip: {
				trigger: "item",
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
				formatter: (params: unknown) => {
					const point = params as { name?: string; value?: number; data?: { salesShare?: number } };
					return `<div style="min-width:180px">
						<div style="font-weight:600;margin-bottom:6px">${point.name ?? "-"}</div>
						<div>${formatRupiah(Number(point.value ?? 0))}</div>
						<div style="margin-top:4px;color:#cbd5e1">${formatPercent(point.data?.salesShare ?? 0)} kontribusi</div>
					</div>`;
				},
			},
			series: [
				{
					type: "treemap",
					breadcrumb: { show: false },
					nodeClick: false,
					roam: false,
					label: {
						show: true,
						formatter: "{b}",
						color: "#f8fafc",
						fontWeight: 600,
					},
					upperLabel: { show: false },
					itemStyle: {
						borderColor: "#ffffff",
						borderWidth: 3,
						gapWidth: 3,
					},
					color: ["#0f172a", "#0ea5e9", "#10b981", "#f59e0b", "#f97316", "#6366f1", "#f43f5e"],
					data: rankedItems.map((item) => ({
						name: item.label,
						value: item.salesAmount,
						salesShare: item.salesShare,
					})),
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
					Belum ada data kategori untuk ditampilkan.
				</div>
			) : (
				<>
					<EChart
						option={option}
						height={340}
						className="mt-5"
						onClick={
							onPointClick
								? (params) => {
										const name = (params as { name?: string }).name;
										if (!name) return;
										const item = rankedItems.find((entry) => entry.label === name);
										if (!item) return;
										onPointClick(item);
								  }
								: undefined
						}
					/>
					<div className="mt-5 grid gap-3 md:grid-cols-3">
						{rankedItems.slice(0, 3).map((item, index) => (
							<div key={item.id} className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">#{index + 1} Kategori</p>
								<p className="mt-2 text-base font-semibold text-slate-900">{item.label}</p>
								<p className="mt-2 text-sm font-medium text-slate-900">{formatRupiah(item.salesAmount)}</p>
								<p className="mt-1 text-sm text-slate-500">{formatPercent(item.salesShare)} dari omzet tahun berjalan</p>
							</div>
						))}
					</div>
					{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
				</>
			)}
		</div>
	);
}
