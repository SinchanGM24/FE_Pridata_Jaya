"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatCompactRupiah, formatPercentage, formatRupiah } from "@/components/dashboard/chart-utils";
import type { AccountantAnalyticsCashInPoint, OwnerAnalyticsMonthlyPoint } from "@/services/dashboard";

type ViewMode = "invoice" | "cash";

export default function AccountantFinancialTrendCard({
	selectedYear,
	availableYears,
	onSelectedYearChange,
	invoiceData,
	cashData,
	loading = false,
}: {
	selectedYear: number;
	availableYears: number[];
	onSelectedYearChange: (year: number) => void;
	invoiceData: OwnerAnalyticsMonthlyPoint[];
	cashData: AccountantAnalyticsCashInPoint[];
	loading?: boolean;
}) {
	const [viewMode, setViewMode] = useState<ViewMode>("invoice");
	const invoiceTotals = useMemo(() => invoiceData.reduce((total, item) => ({
		billed: total.billed + item.salesAmount,
		paid: total.paid + item.paidAmount,
		outstanding: total.outstanding + item.outstandingAmount,
	}), { billed: 0, paid: 0, outstanding: 0 }), [invoiceData]);
	const cashTotal = useMemo(() => cashData.reduce((sum, item) => sum + item.collectedAmount, 0), [cashData]);
	const cashPaymentCount = useMemo(() => cashData.reduce((sum, item) => sum + item.paymentCount, 0), [cashData]);
	const peakCash = useMemo(() => [...cashData].sort((a, b) => b.collectedAmount - a.collectedAmount)[0], [cashData]);

	const invoiceOption = useMemo<EChartsOption>(() => ({
		animationDuration: 650,
		grid: { left: 12, right: 18, top: 48, bottom: 12, containLabel: true },
		legend: { top: 0, icon: "roundRect", textStyle: { color: "#475569", fontSize: 12 } },
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#0f172a", borderWidth: 0, textStyle: { color: "#f8fafc" } },
		xAxis: { type: "category", data: invoiceData.map((item) => item.monthLabel), axisTick: { show: false }, axisLine: { lineStyle: { color: "#cbd5e1" } }, axisLabel: { color: "#64748b" } },
		yAxis: { type: "value", axisLabel: { color: "#64748b", formatter: (value: number) => formatCompactRupiah(value) }, splitLine: { lineStyle: { color: "#e2e8f0" } } },
		series: [
			{ name: "Sudah Dibayar", type: "bar", stack: "invoice", barMaxWidth: 34, itemStyle: { color: "#10b981" }, data: invoiceData.map((item) => item.paidAmount) },
			{ name: "Sisa Piutang", type: "bar", stack: "invoice", barMaxWidth: 34, itemStyle: { color: "#f59e0b", borderRadius: [8, 8, 0, 0] }, data: invoiceData.map((item) => item.outstandingAmount) },
		],
	}), [invoiceData]);

	const cashOption = useMemo<EChartsOption>(() => ({
		animationDuration: 650,
		grid: { left: 12, right: 18, top: 20, bottom: 12, containLabel: true },
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#0f172a", borderWidth: 0, textStyle: { color: "#f8fafc" } },
		xAxis: { type: "category", data: cashData.map((item) => item.periodLabel), axisTick: { show: false }, axisLine: { lineStyle: { color: "#cbd5e1" } }, axisLabel: { color: "#64748b" } },
		yAxis: { type: "value", axisLabel: { color: "#64748b", formatter: (value: number) => formatCompactRupiah(value) }, splitLine: { lineStyle: { color: "#e2e8f0" } } },
		series: [{ name: "Kas Masuk Aktual", type: "bar", barMaxWidth: 34, itemStyle: { color: "#0ea5e9", borderRadius: [8, 8, 0, 0] }, data: cashData.map((item) => item.collectedAmount) }],
	}), [cashData]);

	const collectionRate = invoiceTotals.billed > 0 ? (invoiceTotals.paid / invoiceTotals.billed) * 100 : 0;
	const hasData = viewMode === "invoice"
		? invoiceData.some((item) => item.salesAmount > 0)
		: cashData.some((item) => item.collectedAmount > 0);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">Kinerja Invoice dan Arus Kas</h2>
					<p className="mt-1 text-sm text-slate-500">
						{viewMode === "invoice"
							? "Pembayaran dan sisa piutang ditempatkan pada bulan penerbitan invoice agar penyelesaian cohort mudah dibaca."
							: "Kas masuk ditempatkan pada bulan payment berstatus VERIFIED sesuai tanggal penerimaan aktual."}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<select value={selectedYear} onChange={(event) => onSelectedYearChange(Number(event.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
						{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
					</select>
					<div className="inline-flex rounded-lg bg-slate-100 p-1">
						<button type="button" onClick={() => setViewMode("invoice")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === "invoice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Penyelesaian Invoice</button>
						<button type="button" onClick={() => setViewMode("cash")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === "cash" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Arus Kas Aktual</button>
					</div>
				</div>
			</div>

			<div className="mt-5 grid gap-3 md:grid-cols-3">
				{viewMode === "invoice" ? <>
					<div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Tagihan Invoice</p><p className="mt-2 text-xl font-semibold text-slate-900">{formatRupiah(invoiceTotals.billed)}</p></div>
					<div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Terselesaikan</p><p className="mt-2 text-xl font-semibold text-emerald-600">{formatPercentage(collectionRate)}</p><p className="mt-1 text-xs text-slate-500">{formatRupiah(invoiceTotals.paid)} sudah dibayar</p></div>
					<div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Sisa Cohort</p><p className="mt-2 text-xl font-semibold text-amber-600">{formatRupiah(invoiceTotals.outstanding)}</p></div>
				</> : <>
					<div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Kas Masuk Terverifikasi</p><p className="mt-2 text-xl font-semibold text-sky-600">{formatRupiah(cashTotal)}</p></div>
					<div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Transaksi Pembayaran</p><p className="mt-2 text-xl font-semibold text-slate-900">{cashPaymentCount.toLocaleString("id-ID")}</p></div>
					<div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Bulan Kas Tertinggi</p><p className="mt-2 text-xl font-semibold text-slate-900">{peakCash?.periodLabel ?? "-"}</p><p className="mt-1 text-xs text-slate-500">{formatRupiah(peakCash?.collectedAmount ?? 0)}</p></div>
				</>}
			</div>

			{loading ? <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">Memuat data keuangan...</div> : !hasData ? <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">Belum ada data pada tahun ini.</div> : <EChart option={viewMode === "invoice" ? invoiceOption : cashOption} height={340} className="mt-6" />}
		</div>
	);
}
