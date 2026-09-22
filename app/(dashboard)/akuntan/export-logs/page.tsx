"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MonthlyReportsPanel } from "@/components/reports/MonthlyReportsPanel";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { getApiErrorMessage } from "@/lib/api-errors";
import { displayPrintablePdf, openPrintablePdfTab } from "@/lib/open-printable-pdf";
import {
	exportLogsService,
	type ExportLog,
	type ExportStatus,
} from "@/services/export-logs";
import { getRealtimeClient } from "@/services/realtime";

interface Toast {
	id: string;
	type: "success" | "error";
	message: string;
}

const formatDateTime = (value?: string | null) => {
	if (!value) return "-";
	try {
		return new Date(value).toLocaleString("id-ID");
	} catch {
		return String(value);
	}
};

const statusBadge: Record<string, string> = {
	PENDING: "border border-slate-200 bg-slate-50 text-slate-700",
	PROCESSING: "bg-blue-100 text-blue-800",
	SUCCESS: "border border-emerald-200 bg-emerald-50 text-emerald-700",
	FAILED: "border border-rose-200 bg-rose-50 text-rose-700",
};

function ExportLogsPageContent() {
	const searchParams = useSearchParams();
	const highlightedId = searchParams.get("highlight");
	const wasQueued = searchParams.get("queued") === "1";
	const [activeTab, setActiveTab] = useState<"exports" | "monthly">("exports");
	const [items, setItems] = useState<ExportLog[]>([]);
	const [meta, setMeta] = useState<{ currentPage: number; totalPages: number; totalItems: number } | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [downloadingId, setDownloadingId] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);

	const [page, setPage] = useState(1);
	const [reportType, setReportType] = useState("");
	const [status, setStatus] = useState<ExportStatus | "">("");
	const [format, setFormat] = useState("");
	const [actorUserId, setActorUserId] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");

	const load = async (
		params: {
			page: number;
			reportType: string;
			status: ExportStatus | "";
			format: string;
			actorUserId: string;
			dateFrom: string;
			dateTo: string;
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
				actorUserId: params.actorUserId || undefined,
				dateFrom: params.dateFrom || undefined,
				dateTo: params.dateTo || undefined,
			});
			setItems(result.items);
			setMeta({
				currentPage: result.meta.currentPage,
				totalPages: result.meta.totalPages,
				totalItems: result.meta.totalItems,
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
			void load({ page: 1, reportType, status, format, actorUserId, dateFrom, dateTo }, { withLoader: false });
		}, 0);

		return () => window.clearTimeout(timer);
	}, [reportType, status, format, actorUserId, dateFrom, dateTo]);

	const availableReportTypes = useMemo(() => {
		const values = new Set(items.map((item) => item.reportType).filter(Boolean));
		return Array.from(values).sort((a, b) => a.localeCompare(b));
	}, [items]);
	const hasActiveJobs = useMemo(
		() => items.some((item) => item.status === "PENDING" || item.status === "PROCESSING"),
		[items],
	);

	useEffect(() => {
		if (activeTab !== "exports" || !hasActiveJobs) return;
		const interval = window.setInterval(() => {
			void load({ page, reportType, status, format, actorUserId, dateFrom, dateTo }, { withLoader: false });
		}, 4000);
		return () => window.clearInterval(interval);
	}, [activeTab, hasActiveJobs, page, reportType, status, format, actorUserId, dateFrom, dateTo]);

	// --- Real-time export status updates ---
	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	useEffect(() => {
		const client = getRealtimeClient();
		client.connect();

		const unsubscribe = client.subscribe((eventName, payload) => {
			if (eventName !== "exports") return;
			const update = payload as {
				id?: string;
				status?: ExportStatus;
				rowCount?: number | null;
				errorMessage?: string | null;
				filename?: string;
			};
			if (!update?.id) return;

			// Update the row in the table (optimistic — applies to current page data)
			setItems((prev) =>
				prev.map((row) =>
					row.id === update.id
						? {
								...row,
								status: update.status ?? row.status,
								rowCount: update.rowCount ?? row.rowCount,
								errorMessage: update.errorMessage ?? row.errorMessage,
								filename: update.filename ?? row.filename,
						  }
						: row,
				),
			);
			void load({ page, reportType, status, format, actorUserId, dateFrom, dateTo }, { withLoader: false });

			// Show toast on terminal states
			if (update.status === "SUCCESS") {
				const toastId = `export-success-${update.id}-${Date.now()}`;
				setToasts((prev) => [
					...prev,
					{ id: toastId, type: "success", message: `Export "${update.filename ?? update.id}" selesai.` },
				]);
				setTimeout(() => dismissToast(toastId), 5000);
			} else if (update.status === "FAILED") {
				const toastId = `export-fail-${update.id}-${Date.now()}`;
				setToasts((prev) => [
					...prev,
					{ id: toastId, type: "error", message: `Export "${update.filename ?? update.id}" gagal: ${update.errorMessage ?? "unknown error"}` },
				]);
				setTimeout(() => dismissToast(toastId), 8000);
			}
		});

		return () => {
			unsubscribe();
		};
	}, [dismissToast, page, reportType, status, format, actorUserId, dateFrom, dateTo]);

	const handleDownload = async (item: ExportLog) => {
		const isPdf = item.format.toLowerCase() === "pdf";
		const printWindow = isPdf ? openPrintablePdfTab(item.filename) : null;
		if (isPdf && !printWindow) {
			setError("Browser memblokir tab cetak. Izinkan popup untuk membuka laporan PDF.");
			return;
		}

		setDownloadingId(item.id);
		setError("");
		try {
			const info = await exportLogsService.download(item.id);
			if (isPdf && printWindow) {
				displayPrintablePdf(printWindow, info.url);
				return;
			}
			const anchor = document.createElement("a");
			anchor.href = info.url;
			anchor.download = info.filename;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
		} catch (error: unknown) {
			printWindow?.close();
			setError(getApiErrorMessage(error, "Gagal download file export."));
		} finally {
			setDownloadingId(null);
		}
	};

	return (
		<FeaturePage title="Riwayat Ekspor" description="Pantau file laporan yang diantrikan dan riwayat pengiriman laporan bulanan.">
			<div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
				{[{ key: "exports" as const, label: "Ekspor Laporan" }, { key: "monthly" as const, label: "Laporan Bulanan" }].map((tab) => (
					<button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{tab.label}</button>
				))}
			</div>
			{activeTab === "monthly" ? <MonthlyReportsPanel initialTab="logs" logsOnly /> : null}
			{activeTab === "exports" ? <>
			{wasQueued ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Ekspor berhasil diantrikan. Status akan diperbarui otomatis selama file sedang diproses.</div> : null}
			{/* Toast notifications */}
			{toasts.length > 0 ? (
				<div className="fixed left-1/2 top-5 z-50 flex w-[min(92vw,32rem)] -translate-x-1/2 flex-col gap-3">
					{toasts.map((t) => (
						<div
							key={t.id}
							className={`flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg transition-all ${
								t.type === "success"
									? "border-emerald-200 bg-emerald-50 text-emerald-800"
									: "border-rose-200 bg-rose-50 text-rose-800"
							}`}
							role="alert"
						>
							<span className="text-lg">{t.type === "success" ? "✅" : "❌"}</span>
							<span className="flex-1">{t.message}</span>
							<button
								type="button"
								onClick={() => dismissToast(t.id)}
								className="ml-2 text-xs opacity-60 hover:opacity-100"
							>
								✕
							</button>
						</div>
					))}
				</div>
			) : null}

			<PageFeedback error={error} onDismissError={() => setError("")} />

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
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
					<label className="space-y-1 text-sm text-slate-700"><span>ID Pembuat</span><input value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} placeholder="Filter pembuat" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
					<label className="space-y-1 text-sm text-slate-700"><span>Dari tanggal</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
					<label className="space-y-1 text-sm text-slate-700"><span>Sampai tanggal</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>

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
							<option value="xlsx">xlsx</option>
						</select>
					</label>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Waktu</th>
							<th className="px-4 py-3">Laporan</th>
							<th className="px-4 py-3">Pembuat</th>
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
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Memuat riwayat ekspor...
								</td>
							</tr>
						) : items.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Tidak ada data.
								</td>
							</tr>
						) : (
							items.map((item) => (
								<tr key={item.id} className={item.id === highlightedId ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200" : ""}>
									<td className="px-4 py-3 text-slate-700">{formatDateTime(item.createdAt)}</td>
									<td className="px-4 py-3 font-medium text-slate-900">{item.reportType}</td>
									<td className="px-4 py-3 text-slate-700">{item.actorEmail ?? item.actorUserId ?? "-"}</td>
									<td className="px-4 py-3 text-slate-700">{item.format}</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
												statusBadge[item.status] ?? "border border-slate-200 bg-slate-50 text-slate-700"
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
												onClick={() => handleDownload(item)}
												disabled={downloadingId === item.id}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
											>
											{downloadingId === item.id ? "Menyiapkan..." : item.format.toLowerCase() === "pdf" ? "Buka & Cetak" : "Unduh"}
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
				<PaginationControls
					currentPage={meta.currentPage}
					totalPages={meta.totalPages}
					totalItems={meta.totalItems}
					currentItemCount={items.length}
					pageSize={50}
					itemLabel="log ekspor"
					loading={loading}
					embedded={false}
					onPageChange={(nextPage) => void load({ page: nextPage, reportType, status, format, actorUserId, dateFrom, dateTo })}
				/>
			) : null}
			</> : null}
		</FeaturePage>
	);
}

export default function ExportLogsPage() {
	return (
		<Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat riwayat ekspor...</div>}>
			<ExportLogsPageContent />
		</Suspense>
	);
}
