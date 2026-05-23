"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { resolveChartColor, withAlpha } from "@/components/dashboard/chart-utils";

export interface SalesStoreLifecycleMonthlyItem {
	id: string;
	label: string;
	monthNumber: number;
	monthLabel: string;
	newStoreCount: number;
	firstOrderStoreCount: number;
	legacyStoreCount: number;
	repeatOrderCount: number;
}

export interface LifecycleMonthOption {
	monthNumber: number;
	monthLabel: string;
}

export type LifecycleMetricKey = "newStore" | "firstOrder" | "legacyStore" | "repeatOrder";

export interface LifecycleChartClickPayload {
	item: SalesStoreLifecycleMonthlyItem;
	metric: LifecycleMetricKey;
}

export default function SalesStoreLifecycleChartCard({
	title,
	helper,
	items,
	selectedMonth,
	monthOptions,
	onSelectedMonthChange,
	footer,
	detailPanel,
	onChartPointClick,
}: {
	title: string;
	helper: string;
	items: SalesStoreLifecycleMonthlyItem[];
	selectedMonth: number;
	monthOptions: LifecycleMonthOption[];
	onSelectedMonthChange: (month: number) => void;
	footer?: string;
	detailPanel?: ReactNode;
	onChartPointClick?: (payload: LifecycleChartClickPayload) => void;
}) {
	const filteredItems = useMemo(
		() => items.filter((item) => item.monthNumber === selectedMonth),
		[items, selectedMonth],
	);

	const newStoreOption = useMemo<EChartsOption>(
		() => ({
			animationDuration: 650,
			grid: {
				left: 12,
				right: 18,
				top: 40,
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
					const series = Array.isArray(params) ? params : [];
					const dataIndex = (series[0] as { dataIndex?: number } | undefined)?.dataIndex;
					if (typeof dataIndex !== "number") return "";
					const item = filteredItems[dataIndex];
					if (!item) return "";
					const belumTransaksiPertama = Math.max(item.newStoreCount - item.firstOrderStoreCount, 0);
					return [
						`<strong>${item.label}</strong>`,
						`Toko Baru: ${item.newStoreCount}`,
						`Transaksi Pertama: ${item.firstOrderStoreCount}`,
						`Belum Transaksi Pertama: ${belumTransaksiPertama}`,
					].join("<br/>");
				},
			},
			xAxis: {
				type: "value",
				axisLabel: { color: "#64748b" },
				splitLine: { lineStyle: { color: "#e2e8f0" } },
			},
			yAxis: {
				type: "category",
				inverse: true,
				axisTick: { show: false },
				axisLine: { show: false },
				axisLabel: {
					color: "#0f172a",
					fontWeight: 600,
					width: 160,
					overflow: "truncate",
				},
				data: filteredItems.map((item) => item.label),
			},
			series: [
				{
					name: "Toko Baru",
					type: "bar" as const,
					barMaxWidth: 16,
					itemStyle: {
						color: resolveChartColor("bg-sky-500"),
						borderRadius: 8,
					},
					emphasis: {
						itemStyle: {
							shadowBlur: 16,
							shadowColor: withAlpha("bg-sky-500", 0.28),
						},
					},
					data: filteredItems.map((item) => item.newStoreCount),
				},
				{
					name: "Transaksi Pertama",
					type: "bar" as const,
					barMaxWidth: 16,
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
					data: filteredItems.map((item) => item.firstOrderStoreCount),
				},
			],
		}),
		[filteredItems],
	);

	const repeatOrderOption = useMemo<EChartsOption>(
		() => ({
			animationDuration: 650,
			grid: {
				left: 12,
				right: 18,
				top: 40,
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
					const series = Array.isArray(params) ? params : [];
					const dataIndex = (series[0] as { dataIndex?: number } | undefined)?.dataIndex;
					if (typeof dataIndex !== "number") return "";
					const item = filteredItems[dataIndex];
					if (!item) return "";
					const belumRepeatOrder = Math.max(item.legacyStoreCount - item.repeatOrderCount, 0);
					return [
						`<strong>${item.label}</strong>`,
						`Toko Lama: ${item.legacyStoreCount}`,
						`Repeat Order: ${item.repeatOrderCount}`,
						`Belum Repeat Order: ${belumRepeatOrder}`,
					].join("<br/>");
				},
			},
			xAxis: {
				type: "value",
				axisLabel: { color: "#64748b" },
				splitLine: { lineStyle: { color: "#e2e8f0" } },
			},
			yAxis: {
				type: "category",
				inverse: true,
				axisTick: { show: false },
				axisLine: { show: false },
				axisLabel: {
					color: "#0f172a",
					fontWeight: 600,
					width: 160,
					overflow: "truncate",
				},
				data: filteredItems.map((item) => item.label),
			},
			series: [
				{
					name: "Toko Lama",
					type: "bar" as const,
					barMaxWidth: 16,
					itemStyle: {
						color: resolveChartColor("bg-slate-900"),
						borderRadius: 8,
					},
					emphasis: {
						itemStyle: {
							shadowBlur: 16,
							shadowColor: withAlpha("bg-slate-900", 0.2),
						},
					},
					data: filteredItems.map((item) => item.legacyStoreCount),
				},
				{
					name: "Repeat Order",
					type: "bar" as const,
					barMaxWidth: 16,
					itemStyle: {
						color: resolveChartColor("bg-emerald-500"),
						borderRadius: 8,
					},
					emphasis: {
						itemStyle: {
							shadowBlur: 16,
							shadowColor: withAlpha("bg-emerald-500", 0.28),
						},
					},
					data: filteredItems.map((item) => item.repeatOrderCount),
				},
			],
		}),
		[filteredItems],
	);

	const hasItems = filteredItems.length > 0;

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="mt-1 text-sm text-slate-500">{helper}</p>
				</div>
				<label className="flex items-center gap-2 text-sm text-slate-600">
					<span>Bulan</span>
					<select
						value={selectedMonth}
						onChange={(event) => onSelectedMonthChange(Number(event.target.value))}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
					>
						{monthOptions.map((option) => (
							<option key={option.monthNumber} value={option.monthNumber}>
								{option.monthLabel}
							</option>
						))}
					</select>
				</label>
			</div>

			<div className="mt-5 grid gap-4 xl:grid-cols-2">
				<div className="rounded-2xl border border-slate-200 p-4">
					<h3 className="text-sm font-semibold text-slate-900">Toko Baru per Sales</h3>
					<p className="mt-1 text-xs text-slate-500">
						Melihat sales mana yang menambah toko kelolaan baru pada bulan terpilih, lalu mengecek apakah toko baru itu sudah berhasil masuk transaksi pertama.
					</p>
					{hasItems ? (
						<EChart
							option={newStoreOption}
							height={320}
							className="mt-4"
							onClick={
								onChartPointClick
									? (params) => {
											const dataIndex = (params as { dataIndex?: number }).dataIndex;
											const seriesName = (params as { seriesName?: string }).seriesName;
											if (typeof dataIndex !== "number") return;
											const item = filteredItems[dataIndex];
											if (!item) return;
											onChartPointClick({
												item,
												metric: seriesName === "Transaksi Pertama" ? "firstOrder" : "newStore",
											});
									  }
									: undefined
							}
						/>
					) : (
						<div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
							Belum ada data toko baru untuk ditampilkan.
						</div>
					)}
				</div>

				<div className="rounded-2xl border border-slate-200 p-4">
					<h3 className="text-sm font-semibold text-slate-900">Toko Lama dan Repeat Order</h3>
					<p className="mt-1 text-xs text-slate-500">
						Selisih antara toko lama dan repeat order membantu owner melihat toko mana yang bulan ini belum berhasil dijaga untuk kembali bertransaksi.
					</p>
					{hasItems ? (
						<EChart
							option={repeatOrderOption}
							height={320}
							className="mt-4"
							onClick={
								onChartPointClick
									? (params) => {
											const dataIndex = (params as { dataIndex?: number }).dataIndex;
											const seriesName = (params as { seriesName?: string }).seriesName;
											if (typeof dataIndex !== "number") return;
											const item = filteredItems[dataIndex];
											if (!item) return;
											onChartPointClick({
												item,
												metric: seriesName === "Repeat Order" ? "repeatOrder" : "legacyStore",
											});
									  }
									: undefined
							}
						/>
					) : (
						<div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
							Belum ada data toko lama dan repeat order untuk ditampilkan.
						</div>
					)}
				</div>
			</div>

			{detailPanel ? <div className="mt-4">{detailPanel}</div> : null}

			{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
		</div>
	);
}
