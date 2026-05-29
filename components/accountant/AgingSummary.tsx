"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { resolveChartColor } from "@/components/dashboard/chart-utils";
import type { ReceivableAging } from "@/services/receivable";

function fmtRp(v?: number) {
  if (v == null) return "-";
  return `Rp ${v.toLocaleString()}`;
}

export default function AgingSummary({ aging }: { aging: ReceivableAging | null }) {
  const buckets = useMemo(
    () =>
      aging
        ? [
            { key: "current", label: "Lancar", value: aging.current, color: "bg-emerald-500" },
            { key: "1-30", label: "1-30 hari", value: aging.days1To30, color: "bg-amber-400" },
            { key: "31-60", label: "31-60 hari", value: aging.days31To60, color: "bg-orange-500" },
            { key: "61-90", label: "61-90 hari", value: aging.days61To90, color: "bg-rose-400" },
            { key: ">90", label: ">90 hari", value: aging.daysOver90, color: "bg-slate-900" },
          ]
        : [],
    [aging],
  );

  const option = useMemo<EChartsOption>(() => {
    return {
      animationDuration: 550,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#0f172a",
        borderWidth: 0,
        textStyle: { color: "#f8fafc" },
      },
      legend: {
        top: 0,
        textStyle: { color: "#475569", fontSize: 12 },
      },
      grid: {
        left: 12,
        right: 12,
        top: 42,
        bottom: 12,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b" },
        data: buckets.map((bucket) => bucket.label),
      },
      yAxis: [
        {
          type: "value",
          axisLabel: { color: "#64748b", formatter: (value: number) => fmtRp(value) },
          splitLine: { lineStyle: { color: "#e2e8f0" } },
        },
        {
          type: "value",
          axisLabel: { color: "#94a3b8" },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Piutang",
          type: "bar",
          barMaxWidth: 34,
          data: buckets.map((bucket) => ({
            value: bucket.value.amount,
            itemStyle: {
              color: resolveChartColor(bucket.color),
              borderRadius: [12, 12, 0, 0],
            },
          })),
        },
        {
          name: "Invoice",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 8,
          itemStyle: { color: "#0f172a" },
          lineStyle: { color: "#0f172a", width: 3 },
          data: buckets.map((bucket) => bucket.value.count),
        },
      ],
    };
  }, [buckets]);

  if (!aging) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Ringkasan umur piutang</p>
        <p className="mt-2 text-xs text-slate-500">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">Umur Piutang</p>
      <p className="mt-1 text-sm text-slate-500">
        Piutang per kelompok umur dan jumlah invoice ditampilkan bersamaan untuk membantu prioritas tindak lanjut.
      </p>
      <EChart option={option} height={300} className="mt-4" />
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {buckets.map((b) => (
          <div key={b.key} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">{b.label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-800">{b.value.count}</div>
            <div className="text-xs text-slate-500">{fmtRp(b.value.amount)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <div>Total piutang: <strong className="text-slate-800">{fmtRp(aging.totalOutstandingAmount)}</strong></div>
        <div>Invoice terlambat: <strong className="text-rose-600">{aging.overdueCount}</strong></div>
      </div>
    </div>
  );
}
