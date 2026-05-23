"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatPercent, formatRupiah } from "@/components/dashboard/chart-utils";

export interface TargetActualPoint {
	label: string;
	actualAmount: number;
	targetAmount: number | null;
	achievementRate: number | null;
}

export interface SalesFilterOption {
	id: string;
	label: string;
	helper?: string;
	targetAmount?: number | null;
	actualAmount?: number;
	achievementRate?: number | null;
	monthLabel?: string;
}

const TABLE_GRID_CLASS =
	"grid-cols-[minmax(0,1.25fr)_minmax(140px,0.95fr)_minmax(140px,0.95fr)_minmax(130px,0.8fr)_120px]";
const REALISASI_COLOR = "#38bdf8";
const TARGET_COLOR = "#10b981";
const PENCAPAIAN_COLOR = "#f59e0b";

const renderTooltipRow = (label: string, value: string, color: string) => `
	<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:4px;">
		<span style="display:flex;align-items:center;gap:8px;">
			<span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:${color};"></span>
			<span>${label}</span>
		</span>
		<strong>${value}</strong>
	</div>
`;

export default function ExecutiveTargetActualChartCard({
	title,
	helper,
	monthlyPoints,
	selectedYear,
	availableYears,
	onSelectedYearChange,
	salesOptions,
	selectedSalesUserId,
	onSelectedSalesUserIdChange,
	footer,
	onPointClick,
	className,
}: {
	title: string;
	helper: string;
	monthlyPoints: TargetActualPoint[];
	selectedYear: number;
	availableYears: number[];
	onSelectedYearChange: (year: number) => void;
	salesOptions: SalesFilterOption[];
	selectedSalesUserId: string | null;
	onSelectedSalesUserIdChange: (salesUserId: string | null) => void;
	footer?: string;
	onPointClick?: (point: TargetActualPoint) => void;
	className?: string;
}) {
	const [tableSearchTerm, setTableSearchTerm] = useState("");
	const [tablePage, setTablePage] = useState(1);
	const selectedSales = useMemo(
		() => salesOptions.find((option) => option.id === selectedSalesUserId) ?? null,
		[salesOptions, selectedSalesUserId],
	);
	const filteredTableSalesOptions = useMemo(() => {
		const keyword = tableSearchTerm.trim().toLowerCase();
		const matchedOptions = !keyword
			? salesOptions
			: salesOptions.filter((option) => {
					const haystack = `${option.label} ${option.helper ?? ""}`.toLowerCase();
					return haystack.includes(keyword);
			  });
		return [...matchedOptions].sort((left, right) => left.label.localeCompare(right.label));
	}, [salesOptions, tableSearchTerm]);
	const tableTotalPages = Math.max(1, Math.ceil(filteredTableSalesOptions.length / 10));
	const paginatedTableSalesOptions = useMemo(
		() => filteredTableSalesOptions.slice((tablePage - 1) * 10, tablePage * 10),
		[filteredTableSalesOptions, tablePage],
	);

	const points = monthlyPoints;

	const hasTargetSeries = useMemo(
		() => points.some((point) => typeof point.targetAmount === "number" && Number.isFinite(point.targetAmount)),
		[points],
	);

	const totalRealisasi = useMemo(
		() => points.reduce((sum, point) => sum + point.actualAmount, 0),
		[points],
	);

	const totalTarget = useMemo(() => {
		if (!hasTargetSeries) return null;
		return points.reduce((sum, point) => sum + (point.targetAmount ?? 0), 0);
	}, [hasTargetSeries, points]);

	const latestPencapaian = useMemo(() => {
		const latestPoint = [...points]
			.reverse()
			.find((point) => typeof point.achievementRate === "number" && Number.isFinite(point.achievementRate));
		return latestPoint?.achievementRate ?? null;
	}, [points]);
	const maxAchievementPercent = useMemo(() => {
		const maxValue = points.reduce((max, point) => {
			if (typeof point.achievementRate !== "number" || !Number.isFinite(point.achievementRate)) {
				return max;
			}
			return Math.max(max, point.achievementRate * 100);
		}, 100);
		return Math.ceil((maxValue + 8) / 10) * 10;
	}, [points]);

	const resolvedTitle = selectedSales ? `${title} - ${selectedSales.label}` : title;
	const resolvedHelper = selectedSales
		? `Pantau pencapaian target bulanan ${selectedSales.label} sepanjang tahun ${selectedYear}.`
		: helper;

	const option = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 700,
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
				formatter: (params: unknown) => {
					const rows = Array.isArray(params) ? params : [params];
					const first = rows[0] as { name?: string } | undefined;
					const body = rows
						.map((row) => {
							const point = row as { seriesName?: string; value?: number | string };
							if (point.seriesName === "Pencapaian") {
								return renderTooltipRow(
									point.seriesName,
									formatPercent(Number(point.value ?? 0) / 100),
									PENCAPAIAN_COLOR,
								);
							}
							return renderTooltipRow(
								point.seriesName ?? "-",
								formatRupiah(Number(point.value ?? 0)),
								point.seriesName === "Target" ? TARGET_COLOR : REALISASI_COLOR,
							);
						})
						.join("");
					return `<div style="min-width:200px"><div style="margin-bottom:8px;font-weight:600">${first?.name ?? "-"}</div>${body}</div>`;
				},
			},
			xAxis: {
				type: "category",
				axisTick: { show: false },
				axisLine: { lineStyle: { color: "#cbd5e1" } },
				axisLabel: { color: "#64748b" },
				data: points.map((point) => point.label),
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
					max: maxAchievementPercent,
					axisLabel: {
						color: "#94a3b8",
						formatter: (value: number) => `${value}%`,
					},
					splitLine: { show: false },
				},
			],
			series: [
				{
					name: "Realisasi",
					type: "bar" as const,
					barMaxWidth: 28,
					itemStyle: {
						color: REALISASI_COLOR,
						borderRadius: [10, 10, 0, 0],
					},
					emphasis: {
						itemStyle: {
							shadowBlur: 18,
							shadowColor: "rgba(56,189,248,0.32)",
						},
					},
					data: points.map((point) => point.actualAmount),
				},
				...(hasTargetSeries
					? [
							{
								name: "Target",
								type: "line" as const,
								smooth: true,
								symbolSize: 8,
								lineStyle: { width: 3, color: TARGET_COLOR },
								itemStyle: { color: TARGET_COLOR },
								data: points.map((point) => point.targetAmount ?? null),
							},
							{
								name: "Pencapaian",
								type: "line" as const,
								yAxisIndex: 1,
								smooth: true,
								symbolSize: 7,
								lineStyle: { width: 2, color: PENCAPAIAN_COLOR, type: "dashed" as const },
								itemStyle: { color: PENCAPAIAN_COLOR },
								data: points.map((point) =>
									typeof point.achievementRate === "number"
										? Number((point.achievementRate * 100).toFixed(1))
										: null,
								),
							},
					  ]
					: []),
			],
		};
	}, [hasTargetSeries, maxAchievementPercent, points]);

	const showSelectionPrompt = !selectedSalesUserId;
	const showEmptyState =
		!showSelectionPrompt &&
		points.every((point) => point.actualAmount === 0 && (point.targetAmount ?? 0) === 0);

	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{resolvedTitle}</h2>
					<p className="mt-1 text-sm text-slate-500">{resolvedHelper}</p>
				</div>
				<div className="flex flex-col gap-3 lg:w-[320px] lg:items-end">
					<div className="flex w-full gap-2 justify-end">
						{selectedSales ? (
							<>
								<button
									type="button"
									onClick={() => {
										onSelectedSalesUserIdChange(null);
										setTablePage(1);
									}}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
								>
									Pilih Sales Lain
								</button>
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
							</>
						) : null}
					</div>
				</div>
			</div>

			{showSelectionPrompt ? (
				<div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
					<div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
						<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
							Daftar Sales {salesOptions[0]?.monthLabel ? `- ${salesOptions[0].monthLabel}` : ""}
						</p>
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
							<input
								type="search"
								value={tableSearchTerm}
								onChange={(event) => {
									setTableSearchTerm(event.target.value);
									setTablePage(1);
								}}
								placeholder="Cari nama sales"
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 lg:w-64"
							/>
							<div className="flex items-center gap-2 text-sm text-slate-600">
								<button
									type="button"
									onClick={() => setTablePage((current) => Math.max(1, current - 1))}
									disabled={tablePage <= 1}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Prev
								</button>
								<span>
									Halaman {tablePage} / {tableTotalPages}
								</span>
								<button
									type="button"
									onClick={() => setTablePage((current) => Math.min(tableTotalPages, current + 1))}
									disabled={tablePage >= tableTotalPages}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
						</div>
					</div>
					{paginatedTableSalesOptions.length > 0 ? (
						<div>
							<div className={`hidden ${TABLE_GRID_CLASS} gap-4 border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid`}>
								<span className="text-left">Sales</span>
								<span className="text-center">Target Bulan Ini</span>
								<span className="text-center">Realisasi Bulan Ini</span>
								<span className="text-center">Pencapaian Bulan Ini</span>
								<span className="text-center" />
							</div>
							<div className="divide-y divide-slate-100">
							{paginatedTableSalesOptions.map((option) => (
								<button
									key={option.id}
									type="button"
									onClick={() => onSelectedSalesUserIdChange(option.id)}
									className="block w-full px-4 py-3 text-left transition hover:bg-slate-50"
								>
									<div className="space-y-3 md:hidden">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="text-sm font-medium text-slate-900">{option.label}</p>
												{option.helper ? <p className="mt-1 text-xs text-slate-500">{option.helper}</p> : null}
											</div>
											<span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
												Grafik Tahunan
											</span>
										</div>
										<div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
											<div>
												<p className="uppercase tracking-[0.14em] text-slate-400">Target</p>
												<p className="mt-1 text-sm text-slate-700">
													{typeof option.targetAmount === "number" ? formatRupiah(option.targetAmount) : "Belum ada"}
												</p>
											</div>
											<div>
												<p className="uppercase tracking-[0.14em] text-slate-400">Realisasi</p>
												<p className="mt-1 text-sm text-slate-700">{formatRupiah(option.actualAmount ?? 0)}</p>
											</div>
											<div>
												<p className="uppercase tracking-[0.14em] text-slate-400">Pencapaian</p>
												<p className="mt-1 text-sm text-slate-700">
													{typeof option.achievementRate === "number" ? formatPercent(option.achievementRate) : "Belum ada"}
												</p>
											</div>
										</div>
									</div>
									<div className={`hidden ${TABLE_GRID_CLASS} items-center gap-4 md:grid`}>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium text-slate-900">{option.label}</p>
											{option.helper ? <p className="mt-1 text-xs text-slate-500">{option.helper}</p> : null}
										</div>
										<span className="text-center text-sm text-slate-700">
											{typeof option.targetAmount === "number" ? formatRupiah(option.targetAmount) : "Belum ada"}
										</span>
										<span className="text-center text-sm text-slate-700">{formatRupiah(option.actualAmount ?? 0)}</span>
										<span className="text-center text-sm text-slate-700">
											{typeof option.achievementRate === "number" ? formatPercent(option.achievementRate) : "Belum ada"}
										</span>
										<span className="justify-self-center rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
											Grafik Tahunan
										</span>
									</div>
								</button>
							))}
							</div>
						</div>
					) : (
						<div className="px-4 py-12 text-center text-sm text-slate-500">
							Belum ada daftar sales yang bisa dipilih.
						</div>
					)}
				</div>
			) : showEmptyState ? (
				<>
					<div className="mt-4 grid gap-2 sm:grid-cols-3">
						<div className="rounded-xl border border-slate-200 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Realisasi</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">{formatRupiah(totalRealisasi)}</p>
						</div>
						<div className="rounded-xl border border-slate-200 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Target</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">
								{totalTarget === null ? "Belum tersedia" : formatRupiah(totalTarget)}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pencapaian</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">
								{latestPencapaian === null ? "Belum tersedia" : formatPercent(latestPencapaian)}
							</p>
						</div>
					</div>
					<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada target atau transaksi untuk sales ini pada periode yang dipilih.
					</div>
				</>
			) : (
				<>
					<div className="mt-4 grid gap-2 sm:grid-cols-3">
						<div className="rounded-xl border border-slate-200 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Realisasi</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">{formatRupiah(totalRealisasi)}</p>
						</div>
						<div className="rounded-xl border border-slate-200 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Target</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">
								{totalTarget === null ? "Belum tersedia" : formatRupiah(totalTarget)}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 px-3 py-2">
							<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pencapaian</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">
								{latestPencapaian === null ? "Belum tersedia" : formatPercent(latestPencapaian)}
							</p>
						</div>
					</div>
					<EChart
						option={option}
						height={340}
						className="mt-5"
						onClick={
							onPointClick
								? (params) => {
										const dataIndex = (params as { dataIndex?: number }).dataIndex;
										if (typeof dataIndex !== "number") return;
										const point = points[dataIndex];
										if (!point) return;
										onPointClick(point);
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
