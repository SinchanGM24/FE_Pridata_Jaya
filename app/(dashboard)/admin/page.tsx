"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardMetricsCards from "@/components/owner/DashboardMetricsCards";
import AdminRecentActivity from "@/components/admin/AdminRecentActivity";
import { getApiErrorMessage } from "@/lib/api-errors";
import { dashboardService } from "@/services/dashboard";
import { userService } from "@/services/user";
import { auditService } from "@/services/audit";
import type { OverallSummary } from "@/services/dashboard";

export default function AdminDashboard() {
	const [summary, setSummary] = useState<OverallSummary | null>(null);
	const [userCount, setUserCount] = useState<number | null>(null);
	const [auditCount, setAuditCount] = useState<number | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const [summaryResult, totalUsers, totalAudits] = await Promise.all([
						dashboardService.getSummary(),
						userService.getCount(),
						auditService.getCount(),
					]);
					if (cancelled) return;
					setSummary(summaryResult);
					setUserCount(totalUsers);
					setAuditCount(totalAudits);
				} catch (loadError: unknown) {
					if (cancelled) return;
					setError(getApiErrorMessage(loadError, "Gagal memuat dashboard admin."));
				}
			})();
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, []);

	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
			{error ? (
				<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
					{error}
				</div>
			) : null}

			<DashboardMetricsCards summary={summary} />

			<div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2 grid grid-cols-1 gap-4">
					<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Users</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{userCount ?? '—'}</p>
						<p className="text-xs text-slate-500">Total registered users</p>
					</div>

					<AdminRecentActivity />
				</div>

				<div className="space-y-4">
					<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Audit logs</p>
						<p className="mt-2 text-2xl font-semibold text-purple-600">{auditCount ?? '—'}</p>
						<p className="text-xs text-slate-500">System audit entries</p>
					</div>

					<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Quick actions</p>
						<div className="mt-3 flex flex-col gap-2">
							<Link href="/admin/master-data" className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white text-center">Master Data</Link>
							<Link href="/users" className="rounded-md border px-3 py-2 text-xs text-center">Manage Users</Link>
							<Link href="/audit-logs" className="rounded-md border px-3 py-2 text-xs text-center">Audit Logs</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
