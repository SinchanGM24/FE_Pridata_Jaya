"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	auditService,
	type AuditListFilters,
	type AuditRow,
} from "@/services/audit";

const AuditLogStream = dynamic(
	() => import("@/components/logs/AuditLogStream").then((m) => m.AuditLogStream ?? m.default),
	{ ssr: false },
);

const formatDateTime = (value?: string | null) => {
	if (!value) return "-";
	try {
		return new Date(value).toLocaleString("id-ID");
	} catch {
		return String(value);
	}
};

const actionBadge: Record<string, string> = {
	CREATE: "bg-emerald-100 text-emerald-800",
	UPDATE: "bg-blue-100 text-blue-800",
	DELETE: "bg-rose-100 text-rose-800",
	READ: "bg-slate-100 text-slate-700",
	LOGIN: "bg-violet-100 text-violet-800",
	LOGOUT: "bg-amber-100 text-amber-800",
};

const PAGE_SIZES = [25, 50, 100];

export default function AuditLogsPage() {
	const [items, setItems] = useState<AuditRow[]>([]);
	const [liveMode, setLiveMode] = useState(false);
	const [meta, setMeta] = useState<{
		currentPage: number;
		totalPages: number;
		totalItems: number;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	const [action, setAction] = useState("");
	const [entityType, setEntityType] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");

	const load = async (filters: AuditListFilters) => {
		setLoading(true);
		setError("");
		try {
			const result = await auditService.listPaginated(filters);
			setItems(result.items);
			setMeta(result.meta);
			setPage(result.meta.currentPage);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat audit logs."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load({ page: 1, limit: pageSize, action: action || undefined, entityType: entityType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
		}, 0);
		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pageSize, action, entityType, dateFrom, dateTo]);

	const goToPage = (p: number) => {
		void load({ page: p, limit: pageSize, action: action || undefined, entityType: entityType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
	};

	const handleExportCsv = () => {
		const url = auditService.exportCsv({
			action: action || undefined,
			entityType: entityType || undefined,
			dateFrom: dateFrom || undefined,
			dateTo: dateTo || undefined,
		});
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `audit-logs-${Date.now()}.csv`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
	};

	return (
		<FeaturePage
			title="Audit Log"
			description="Riwayat seluruh aktivitas sistem (B2.6). Gunakan filter untuk pencarian, atau nyalakan mode Live untuk melihat event real-time."
			actions={[
				{ label: "Refresh", onClick: () => goToPage(page) },
				{ label: "Export CSV", onClick: handleExportCsv },
				{
					label: liveMode ? "● Live ON" : "○ Live OFF",
					onClick: () => setLiveMode((prev) => !prev),
				},
			]}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{/* Filters */}
			<section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm${liveMode ? " ring-1 ring-emerald-300" : ""}`}>
				<div className="grid gap-3 md:grid-cols-5">
					<label className="space-y-1 text-sm text-slate-700">
						<span>Tanggal Mulai</span>
						<input
							type="date"
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={dateFrom}
							onChange={(e) => setDateFrom(e.target.value)}
						/>
					</label>
					<label className="space-y-1 text-sm text-slate-700">
						<span>Tanggal Akhir</span>
						<input
							type="date"
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={dateTo}
							onChange={(e) => setDateTo(e.target.value)}
						/>
					</label>
					<label className="space-y-1 text-sm text-slate-700">
						<span>Action</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={action}
							onChange={(e) => setAction(e.target.value)}
						>
							<option value="">Semua</option>
							<option value="CREATE">CREATE</option>
							<option value="UPDATE">UPDATE</option>
							<option value="DELETE">DELETE</option>
							<option value="READ">READ</option>
							<option value="LOGIN">LOGIN</option>
							<option value="LOGOUT">LOGOUT</option>
						</select>
					</label>
					<label className="space-y-1 text-sm text-slate-700">
						<span>Entity Type</span>
						<input
							type="text"
							placeholder="e.g. User, Product"
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={entityType}
							onChange={(e) => setEntityType(e.target.value)}
						/>
					</label>
					<label className="space-y-1 text-sm text-slate-700">
						<span>Baris / Halaman</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={pageSize}
							onChange={(e) => setPageSize(Number(e.target.value))}
						>
							{PAGE_SIZES.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
				</div>
			</section>

			{/* Live stream mode */}
			{liveMode ? (
				<div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
					<div className="mb-2 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
							<span className="text-sm font-semibold text-emerald-800">Live Stream</span>
						</div>
						<button
							type="button"
							onClick={() => setLiveMode(false)}
							className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
						>
							Tutup Live
						</button>
					</div>
					<AuditLogStream className="max-h-[400px] overflow-y-auto" />
				</div>
			) : null}

			{/* Table */}
			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Timestamp</th>
							<th className="px-4 py-3">Actor</th>
							<th className="px-4 py-3">Action</th>
							<th className="px-4 py-3">Entity Type</th>
							<th className="px-4 py-3">Entity ID</th>
							<th className="px-4 py-3">Description</th>
							<th className="px-4 py-3">IP</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={7}>
									Memuat audit logs...
								</td>
							</tr>
						) : items.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={7}>
									Tidak ada data.
								</td>
							</tr>
						) : (
							items.map((item) => (
								<tr key={item.id} className="hover:bg-slate-50/50">
									<td className="whitespace-nowrap px-4 py-3 text-slate-700">
										{formatDateTime(item.createdAt)}
									</td>
									<td className="px-4 py-3 font-medium text-slate-900">
										{item.actorEmail ?? "-"}
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-1 text-xs font-medium ${
												actionBadge[item.action] ?? "bg-slate-100 text-slate-700"
											}`}
										>
											{item.action}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{item.resourceType ?? "-"}
									</td>
									<td className="px-4 py-3 font-mono text-xs text-slate-600">
										{item.resourceId
											? item.resourceId.length > 12
												? `${item.resourceId.slice(0, 12)}…`
												: item.resourceId
											: "-"}
									</td>
									<td className="max-w-xs px-4 py-3 text-slate-700">
										<div className="line-clamp-2">{item.message ?? "-"}</div>
									</td>
									<td className="px-4 py-3 font-mono text-xs text-slate-500">
										{item.ip ?? "-"}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			{/* Pagination */}
			{meta ? (
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => goToPage(Math.max(1, meta.currentPage - 1))}
						disabled={loading || meta.currentPage <= 1}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Prev
					</button>
					<div className="flex items-center gap-4 text-sm text-slate-600">
						<span>
							Page {meta.currentPage} / {meta.totalPages}
						</span>
						<span className="text-xs text-slate-400">
							({meta.totalItems.toLocaleString("id-ID")} total)
						</span>
					</div>
					<button
						type="button"
						onClick={() =>
							goToPage(Math.min(meta.totalPages, meta.currentPage + 1))
						}
						disabled={loading || meta.currentPage >= meta.totalPages}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Next
					</button>
				</div>
			) : null}
		</FeaturePage>
	);
}
