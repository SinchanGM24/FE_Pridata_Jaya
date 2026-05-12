"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboard";
import { receivableService } from "@/services/receivable";
import DashboardMetricsCards from "@/components/owner/DashboardMetricsCards";
import AgingSummary from "@/components/accountant/AgingSummary";

export default function AccountantDashboard() {
  const [summary, setSummary] = useState<any | null>(null);
  const [aging, setAging] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    dashboardService.getSummary().then((res) => mounted && setSummary(res)).catch(() => {});
    receivableService.getAging().then((r) => mounted && setAging(r)).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Akuntan</h1>

      <DashboardMetricsCards summary={summary} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgingSummary aging={aging} />
        </div>
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Quick actions</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/accountant/aging" className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white text-center">Lihat Aging Piutang</Link>
              <Link href="/reports/receivables/export?format=pdf" className="rounded-md border px-3 py-2 text-xs text-center">Export PDF (server)</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
