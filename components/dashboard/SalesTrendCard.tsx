"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import {
	formatCompactRupiah,
	formatPercent,
	formatRupiah,
	formatSignedPercent,
} from "@/components/dashboard/chart-utils";
import type {
	OwnerAnalyticsDailyPoint,
	OwnerAnalyticsMonthlyPoint,
	OwnerAnalyticsSummary,
	OwnerTrendSummary,
	OwnerAnalyticsYearlyPoint,
} from "@/services/dashboard";

const MONTH_OPTIONS = [
	{ value: "all", label: "Semua Bulan" },
	{ value: "1", label: "Januari" },
	{ value: "2", label: "Februari" },
	{ value: "3", label: "Maret" },
	{ value: "4", label: "April" },
	{ value: "5", label: "Mei" },
	{ value: "6", label: "Juni" },
	{ value: "7", label: "Juli" },
	{ value: "8", label: "Agustus" },
	{ value: "9", label: "September" },
	{ value: "10", label: "Oktober" },
	{ value: "11", label: "November" },
	{ value: "12", label: "Desember" },
];
const OMZET_COLOR = "#38bdf8";
const PEMBAYARAN_COLOR = "#10b981";
const PIUTANG_COLOR = "#f59e0b";

type TrendMode = "month" | "year";
type TrendPoint = OwnerAnalyticsDailyPoint | OwnerAnalyticsMonthlyPoint | OwnerAnalyticsYearlyPoint;

function isMonthlyPoint(point: TrendPoint): point is OwnerAnalyticsMonthlyPoint {
	return "monthNumber" in point;
}

function isDailyPoint(point: TrendPoint): point is OwnerAnalyticsDailyPoint {
	return "dayNumber" in point;
}

export default function SalesTrendCard({
	analytics,
	loading = false,
	selectedYear,
	onSelectedYearChange,
	selectedMonth,
	onSelectedMonthChange,
}: {
	analytics: OwnerAnalyticsSummary | OwnerTrendSummary | null;
	loading?: boolean;
	selectedYear: number;
	onSelectedYearChange: (year: number) => void;
	selectedMonth: number | null;
	onSelectedMonthChange: (month: number | null) => void;
}) {
	const [mode, setMode] = useState<TrendMode>("month");
	const availableYears = useMemo(() => {
		if (analytics?.availableYears?.length) {
			return analytics.availableYears;
		}

		const yearlyYears = (analytics?.yearlySalesTrend ?? []).map((item) => item.year);
		return yearlyYears.length > 0 ? yearlyYears : selectedYear ? [selectedYear] : [];
	}, [analytics, selectedYear]);

	const displayedData = useMemo(() => {
		if (!analytics) return [];

		if (mode === "month") {
			if (selectedMonth !== null) {
				return analytics.dailySalesTrend ?? [];
			}
			return analytics.monthlySalesTrend ?? [];
		}

		return [...(analytics.yearlySalesTrend ?? [])]
			.sort((left, right) => left.year - right.year)
			.slice(-10);
	}, [analytics, mode, selectedMonth]);

	const totals = useMemo(
		() =>
			displayedData.reduce(
				(acc, item) => {
					acc.salesAmount += item.salesAmount;
					acc.paidAmount += item.paidAmount;
					acc.outstandingAmount += item.outstandingAmount;
					acc.invoiceCount += item.invoiceCount;
					return acc;
				},
				{ salesAmount: 0, paidAmount: 0, outstandingAmount: 0, invoiceCount: 0 },
			),
		[displayedData],
	);

	const selectedMonthLabel =
		selectedMonth === null
			? null
			: MONTH_OPTIONS.find((option) => option.value === String(selectedMonth))?.label ?? `Bulan ${selectedMonth}`;

	const title =
		mode === "month"
			? selectedMonthLabel
				? `Tren Penjualan Harian ${selectedMonthLabel} ${selectedYear}`
				: `Tren Penjualan Bulanan ${selectedYear}`
			: "Tren Penjualan Tahunan";

	const helper =
		mode === "month"
			? selectedMonthLabel
				? "Saat satu bulan dipilih, grafik turun menjadi detail harian tanggal 1-31 agar lonjakan transaksi lebih mudah dibaca."
				: "Bandingkan omzet, pembayaran, dan piutang per bulan, lalu fokuskan ke bulan tertentu bila dibutuhkan."
			: "Lihat arah pertumbuhan penjualan semua tahun yang tersedia, dibatasi maksimal 10 tahun terakhir agar chart tetap mudah dibaca.";
	const executiveSummary = analytics?.executiveSummary;
	const useExecutiveSummary = mode === "month" && selectedMonth === null;
	const displayedSalesAmount = useExecutiveSummary ? (executiveSummary?.totalSalesAmount ?? totals.salesAmount) : totals.salesAmount;
	const displayedPaidAmount = useExecutiveSummary ? (executiveSummary?.totalPaidAmount ?? totals.paidAmount) : totals.paidAmount;
	const displayedOutstandingAmount = useExecutiveSummary
		? (executiveSummary?.totalOutstandingAmount ?? totals.outstandingAmount)
		: totals.outstandingAmount;
	const displayedOutstandingRatio = useExecutiveSummary
		? (executiveSummary?.outstandingRatio ?? (totals.outstandingAmount > 0 ? totals.outstandingAmount / Math.max(totals.salesAmount, 1) : 0))
		: totals.outstandingAmount > 0
			? totals.outstandingAmount / Math.max(totals.salesAmount, 1)
			: 0;
	const footerInsight =
		executiveSummary && executiveSummary.outstandingRatio > 0.35
			? "Pertumbuhan penjualan masih tertahan oleh rasio piutang yang tinggi, jadi penagihan perlu dikejar."
			: executiveSummary && executiveSummary.collectionRate >= 0.8
				? "Ritme pembayaran sudah cukup mengikuti omzet, sehingga pertumbuhan terlihat lebih sehat."
				: "Omzet masih perlu dibaca bersama kecepatan koleksi agar pertumbuhan tidak hanya terlihat besar di atas kertas.";
	const chartOption = useMemo<EChartsOption>(() => {
		return {
			animationDuration: 700,
			grid: {
				left: 12,
				right: 16,
				top: 24,
				bottom: 12,
				containLabel: true,
			},
			tooltip: {
				trigger: "axis",
				backgroundColor: "#0f172a",
				borderWidth: 0,
				textStyle: { color: "#f8fafc" },
			},
			legend: {
				top: 0,
				icon: "roundRect",
				textStyle: { color: "#475569", fontSize: 12 },
			},
			xAxis: {
				type: "category",
				axisTick: { show: false },
				axisLine: { lineStyle: { color: "#cbd5e1" } },
				axisLabel: { color: "#64748b" },
				data: displayedData.map((item) =>
					isDailyPoint(item)
						? item.dayLabel
						: isMonthlyPoint(item)
							? item.monthLabel
							: String(item.year),
				),
			},
			yAxis: [
				{
					type: "value",
					axisLabel: {
						color: "#64748b",
						formatter: (value: number) => formatCompactRupiah(value),
					},
					splitLine: { lineStyle: { color: "#e2e8f0" } },
				},
			],
			series: [
				{
					name: "Omzet",
					type: "bar",
					barMaxWidth: 30,
					itemStyle: { color: OMZET_COLOR, borderRadius: [12, 12, 0, 0] },
					data: displayedData.map((item) => item.salesAmount),
				},
				{
					name: "Pembayaran",
					type: "line",
					smooth: true,
					symbolSize: 8,
					lineStyle: { width: 3, color: PEMBAYARAN_COLOR },
					areaStyle: { color: `${PEMBAYARAN_COLOR}22` },
					itemStyle: { color: PEMBAYARAN_COLOR },
					data: displayedData.map((item) => item.paidAmount),
				},
				{
					name: "Piutang",
					type: "bar",
					barMaxWidth: 22,
					itemStyle: { color: PIUTANG_COLOR, borderRadius: [8, 8, 0, 0] },
					data: displayedData.map((item) => item.outstandingAmount),
				},
			],
		};
	}, [displayedData]);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="mt-1 text-sm text-slate-500">{helper}</p>
				</div>

				<div className="grid grid-cols-[auto_auto_auto] items-center gap-2 max-sm:grid-cols-1">
					{mode === "month" ? (
						<>
							<select
								value={selectedYear}
								onChange={(event) => onSelectedYearChange(Number(event.target.value))}
								className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								{availableYears.map((year) => (
									<option key={year} value={year}>
										Tahun {year}
									</option>
								))}
							</select>
							<select
								value={selectedMonth === null ? "all" : String(selectedMonth)}
								onChange={(event) =>
									onSelectedMonthChange(
										event.target.value === "all" ? null : Number(event.target.value),
									)
								}
								className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								{MONTH_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</>
					) : null}
					<div className="inline-flex whitespace-nowrap rounded-xl bg-slate-100 p-1">
						<button
							type="button"
							onClick={() => setMode("month")}
							className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
								mode === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
							}`}
						>
							Bulanan
						</button>
						<button
							type="button"
							onClick={() => setMode("year")}
							className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
								mode === "year" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
							}`}
						>
							Tahunan
						</button>
					</div>
				</div>
			</div>

			<div className="mt-5 grid gap-3 md:grid-cols-3">
				<div className="rounded-xl border border-slate-200 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Omzet</p>
					<p className="mt-2 text-xl font-semibold text-slate-900">
						{formatRupiah(displayedSalesAmount)}
					</p>
					<p className="mt-1 text-xs text-slate-500">
						{useExecutiveSummary ? `Perubahan ${formatSignedPercent(executiveSummary?.monthlyGrowthRate ?? 0)}` : "Omzet pada periode yang sedang dibaca"}
					</p>
				</div>
				<div className="rounded-xl border border-slate-200 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pembayaran</p>
					<p className="mt-2 text-xl font-semibold text-emerald-600">
						{formatRupiah(displayedPaidAmount)}
					</p>
					<p className="mt-1 text-xs text-slate-500">
						{useExecutiveSummary ? `Pembayaran ${formatSignedPercent(executiveSummary?.paymentGrowthRate ?? 0)}` : "Realisasi pembayaran pada periode yang sedang dibaca"}
					</p>
				</div>
				<div className="rounded-xl border border-slate-200 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Rasio Piutang</p>
					<p className="mt-2 text-xl font-semibold text-amber-600">
						{formatPercent(displayedOutstandingRatio)}
					</p>
					<p className="mt-1 text-xs text-slate-500">
						Gap penagihan {formatRupiah(displayedOutstandingAmount)}
					</p>
				</div>
			</div>

			<div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
					Omzet
				</div>
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
					Pembayaran
				</div>
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
					Piutang
				</div>
			</div>

			{loading ? (
				<div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Memuat grafik tren penjualan...
				</div>
			) : displayedData.length === 0 ? (
				<div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data transaksi untuk filter yang dipilih.
				</div>
			) : (
				<>
					<EChart option={chartOption} height={340} className="mt-6" />
					<p className="mt-4 text-xs text-slate-500">{footerInsight}</p>
				</>
			)}
		</div>
	);
}
