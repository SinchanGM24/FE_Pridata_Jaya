"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	exportLogsService,
	type ExportLog,
	type ExportStatus,
} from "@/services/export-logs";

const formatDateTime = (value?: string | null) => {
	if (!value) return "-";
	try {
		return new Date(value).toLocaleString("id-ID");
	} catch {
		return String(value);
	}
};

const statusBadge: Record<string, string> = {
	PENDING: "bg-slate-100 text-slate-700",
	PROCESSING: "bg-blue-100 text-blue-800",
	SUCCESS: "bg-emerald-100 text-emerald-800",
	FAILED: "bg-rose-100 text-rose-800",
};

export default function ExportLogsPage() {
	const [items, setItems] = useState<ExportLog[]>([]);
	const [meta, setMeta] = useState<{ currentPage: number; totalPages: number } | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [downloadingId, setDownloadingId] = useState<string | null>(null);

	const [page, setPage] = useState(1);
	const [reportType, setReportType] = useState("");
	const [status, setStatus] = useState<ExportStatus | "">("");
	const [format, setFormat] = useState("");

	const load = async (
		params: {
			page: number;
			reportType: string;
			status: ExportStatus | "";
			format: string;
		},
		options?: { withLoader?: boolean },
	) => {
		if (options?.withLoader !== false) {
			setLoading(true);
			setError("");
		}
		try {
			const result = await exportLogsService.list({
				page: params.page,
				limit: 50,
				reportType: params.reportType || undefined,
				status: params.status || undefined,
				format: params.format || undefined,
			});
			setItems(result.items);
			setMeta({
				currentPage: result.meta.currentPage,
				totalPages: result.meta.totalPages,
			});
			setPage(result.meta.currentPage);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat export logs."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load({ page: 1, reportType, status, format }, { withLoader: false });
		}, 0);

		return () => window.clearTimeout(timer);
	}, [reportType, status, format]);

	const availableReportTypes = useMemo(() => {
		const values = new Set(items.map((item) => item.reportType).filter(Boolean));
		return Array.from(values).sort((a, b) => a.localeCompare(b));
	}, [items]);

	const handleDownload = async (id: string) => {
		setDownloadingId(id);
		setError("");
		try {
			const info = await exportLogsService.download(id);
			const anchor = document.createElement("a");
			anchor.href = info.url;
			anchor.download = info.filename;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal download file export."));
		} finally {
			setDownloadingId(null);
		}
	};

	return (
		<FeaturePage
			title="Export Logs"
			description="Riwayat export laporan BE2 beserta status dan link download (presigned URL)."
			actions={[{ label: "Refresh", onClick: () => void load({ page, reportType, status, format }) }]}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-4">
					<label className="space-y-1 text-sm text-slate-700">
						<span>Report Type</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={reportType}
							onChange={(e) => setReportType(e.target.value)}
						>
							<option value="">Semua</option>
							{availableReportTypes.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</select>
					</label>

					<label className="space-y-1 text-sm text-slate-700">
						<span>Status</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={status}
							onChange={(e) => setStatus(e.target.value as ExportStatus | "")}
						>
							<option value="">Semua</option>
							<option value="PENDING">PENDING</option>
							<option value="PROCESSING">PROCESSING</option>
							<option value="SUCCESS">SUCCESS</option>
							<option value="FAILED">FAILED</option>
						</select>
					</label>

					<label className="space-y-1 text-sm text-slate-700">
						<span>Format</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={format}
							onChange={(e) => setFormat(e.target.value)}
						>
							<option value="">Semua</option>
							<option value="pdf">pdf</option>
							<option value="csv">csv</option>
						</select>
					</label>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Waktu</th>
							<th className="px-4 py-3">Report</th>
							<th className="px-4 py-3">Format</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Rows</th>
							<th className="px-4 py-3">File</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={7}>
									Memuat export logs...
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
								<tr key={item.id}>
									<td className="px-4 py-3 text-slate-700">{formatDateTime(item.createdAt)}</td>
									<td className="px-4 py-3 font-medium text-slate-900">{item.reportType}</td>
									<td className="px-4 py-3 text-slate-700">{item.format}</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-1 text-xs font-medium ${
												statusBadge[item.status] ?? "bg-slate-100 text-slate-700"
											}`}
										>
											{item.status}
										</span>
									</td>
									<td className="px-4 py-3 text-right text-slate-700">{item.rowCount ?? "-"}</td>
									<td className="px-4 py-3 text-slate-700">
										<div className="font-medium">{item.filename}</div>
										{item.errorMessage ? (
											<div className="mt-1 text-xs text-rose-600 line-clamp-2">{item.errorMessage}</div>
										) : null}
									</td>
									<td className="px-4 py-3 text-right">
										{item.status === "SUCCESS" ? (
											<button
												type="button"
												onClick={() => handleDownload(item.id)}
												disabled={downloadingId === item.id}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
											>
												{downloadingId === item.id ? "Downloading..." : "Download"}
											</button>
										) : (
											<span className="text-xs text-slate-500">-</span>
										)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			{meta ? (
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() =>
							void load({
								page: Math.max(1, (meta?.currentPage ?? 1) - 1),
								reportType,
								status,
								format,
							})
						}
						disabled={loading || (meta?.currentPage ?? 1) <= 1}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Prev
					</button>
					<div className="text-sm text-slate-600">
						Page {meta.currentPage} / {meta.totalPages}
					</div>
					<button
						type="button"
						onClick={() =>
							void load({
								page: Math.min(meta.totalPages, meta.currentPage + 1),
								reportType,
								status,
								format,
							})
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
