"use client";

import React from "react";
import type { ReceivableAging } from "@/services/receivable";

function fmtRp(v?: number) {
  if (v == null) return "-";
  return `Rp ${v.toLocaleString()}`;
}

export default function AgingSummary({ aging }: { aging: ReceivableAging | null }) {
  if (!aging) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Aging summary</p>
        <p className="mt-2 text-xs text-slate-500">Loading...</p>
      </div>
    );
  }

  const buckets = [
    { key: "current", label: "Current", value: aging.current },
    { key: "1-30", label: "1-30 days", value: aging.days1To30 },
    { key: "31-60", label: "31-60 days", value: aging.days31To60 },
    { key: "61-90", label: "61-90 days", value: aging.days61To90 },
    { key: ">90", label: ">90 days", value: aging.daysOver90 },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">Aging receivables</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {buckets.map((b) => (
          <div key={b.key} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">{b.label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-800">{b.value.count}</div>
            <div className="text-xs text-slate-500">{fmtRp(b.value.amount)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-slate-600">
        <div>Total outstanding: <strong className="text-slate-800">{fmtRp(aging.totalOutstandingAmount)}</strong></div>
        <div>Overdue items: <strong className="text-rose-600">{aging.overdueCount}</strong></div>
      </div>
    </div>
  );
}
