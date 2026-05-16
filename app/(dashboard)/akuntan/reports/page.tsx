"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
  reportsService,
  reportTypes,
  reportTypeLabels,
  type ReportType,
  type ExportFormat,
  type ReportRow,
  type ReportParams,
} from "@/services/reports";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("id-ID");
  } catch {
    return String(value);
  }
};

const formatNumber = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return value.toLocaleString("id-ID");
  }
  return String(value);
};

const formatCurrency = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return String(value);
};

// Smart cell formatter based on key patterns
const formatCell = (key: string, value: unknown): string => {
  const keyLower = key.toLowerCase();
  
  // Date fields
  if (
    keyLower.includes("date") ||
    keyLower.includes("at") ||
    keyLower === "createdat" ||
    keyLower === "updatedat"
  ) {
    return formatDateTime(String(value));
  }
  
  // Currency/amount fields
  if (
    keyLower.includes("amount") ||
    keyLower.includes("total") ||
    keyLower.includes("paid") ||
    keyLower.includes("remaining") ||
    keyLower.includes("outstanding") ||
    keyLower.includes("price") ||
    keyLower.includes("credit") ||
    keyLower.includes("debit")
  ) {
    return formatCurrency(value);
  }
  
  // Count/quantity fields
  if (
    keyLower.includes("count") ||
    keyLower.includes("quantity") ||
    keyLower.includes("qty") ||
    keyLower === "rows"
  ) {
    return formatNumber(value);
  }
  
  return value === null || value === undefined ? "-" : String(value);
};

// Get columns from first row
const getColumns = (row: ReportRow): string[] => {
  return Object.keys(row).filter((key) => {
    // Skip nested objects and arrays for table display
    const value = row[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return false;
    }
    return true;
  });
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [items, setItems] = useState<ReportRow[]>([]);
  const [meta, setMeta] = useState<{
    currentPage: number;
    totalPages: number;
    totalItems: number;
  } | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  
  // Export state
  const [exportingSync, setExportingSync] = useState(false);
  const [exportingAsync, setExportingAsync] = useState(false);
  const [lastExportJob, setLastExportJob] = useState<{
    id: string;
    reportType: ReportType;
  } | null>(null);

  const loadReport = useCallback(
    async (params: ReportParams & { type: ReportType }, options?: { withLoader?: boolean }) => {
      if (options?.withLoader !== false) {
        setLoading(true);
        setError("");
      }
      
      try {
        const result = await reportsService.getReport(params.type, {
          page: params.page,
          limit: params.limit ?? 50,
          dateFrom: params.dateFrom || undefined,
          dateTo: params.dateTo || undefined,
          storeId: params.storeId || undefined,
          search: params.search || undefined,
          status: params.status || undefined,
        });
        
        setItems(result.items);
        setMeta(
          result.meta
            ? {
                currentPage: result.meta.currentPage,
                totalPages: result.meta.totalPages,
                totalItems: result.meta.totalItems,
              }
            : null
        );
        setSummary(result.summary ?? null);
        
        // Derive columns from first item
        if (result.items.length > 0) {
          setColumns(getColumns(result.items[0]));
        } else {
          setColumns([]);
        }
        
        setPage(params.page ?? 1);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, "Gagal memuat laporan."));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load on mount and when filters change
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport(
        {
          type: reportType,
          page: 1,
          dateFrom,
          dateTo,
          storeId,
          search,
          status,
        },
        { withLoader: false }
      );
    }, 0);
    
    return () => window.clearTimeout(timer);
  }, [reportType, dateFrom, dateTo, storeId, search, status, loadReport]);

  // Handle sync export
  const handleSyncExport = async (format: ExportFormat) => {
    setExportingSync(true);
    setError("");
    
    try {
      const blob = await reportsService.exportReport(reportType, format, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        storeId: storeId || undefined,
        search: search || undefined,
        status: status || undefined,
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Gagal export laporan."));
    } finally {
      setExportingSync(false);
    }
  };

  // Handle async export
  const handleAsyncExport = async (format: ExportFormat) => {
    setExportingAsync(true);
    setError("");
    
    try {
      const job = await reportsService.createExportJob(reportType, format, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        storeId: storeId || undefined,
        search: search || undefined,
        status: status || undefined,
      });
      
      setLastExportJob({ id: job.id, reportType });
      
      // Show success message
      setError(""); // Clear any previous error
      alert(`Export job created! Job ID: ${job.id}. Check Export Logs for status.`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Gagal membuat export job."));
    } finally {
      setExportingAsync(false);
    }
  };

  // Handle page navigation
  const handlePageChange = (newPage: number) => {
    void loadReport({
      type: reportType,
      page: newPage,
      dateFrom,
      dateTo,
      storeId,
      search,
      status,
    });
  };

  return (
    <FeaturePage
      title="Laporan"
      description="Lihat dan export berbagai laporan: penjualan, order, invoice, pembayaran, piutang, stok, dan pengiriman."
      actions={[
        { label: "Export Logs", href: "/akuntan/export-logs" },
        {
          label: "Refresh",
          onClick: () =>
            void loadReport({
              type: reportType,
              page,
              dateFrom,
              dateTo,
              storeId,
              search,
              status,
            }),
        },
      ]}
    >
      {/* Error display */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Report type selector and filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Report Type */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Jenis Laporan</span>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
            >
              {reportTypes.map((type) => (
                <option key={type} value={type}>
                  {reportTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>

          {/* Date From */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Dari Tanggal</span>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          {/* Date To */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Sampai Tanggal</span>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>

          {/* Status */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Status</span>
            <input
              type="text"
              placeholder="Filter by status..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </label>

          {/* Store ID */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Store ID</span>
            <input
              type="text"
              placeholder="Filter by store ID..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            />
          </label>

          {/* Search */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Pencarian</span>
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* Export buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <span className="text-sm font-medium text-slate-700">Export:</span>
          
          {/* Sync export buttons */}
          <button
            type="button"
            disabled={exportingSync || exportingAsync || loading}
            onClick={() => void handleSyncExport("pdf")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exportingSync ? "Exporting..." : "PDF (Sync)"}
          </button>
          
          <button
            type="button"
            disabled={exportingSync || exportingAsync || loading}
            onClick={() => void handleSyncExport("csv")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exportingSync ? "Exporting..." : "CSV (Sync)"}
          </button>
          
          <span className="mx-2 text-slate-300">|</span>
          
          {/* Async export buttons */}
          <button
            type="button"
            disabled={exportingSync || exportingAsync || loading}
            onClick={() => void handleAsyncExport("pdf")}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            {exportingAsync ? "Creating Job..." : "PDF (Async)"}
          </button>
          
          <button
            type="button"
            disabled={exportingSync || exportingAsync || loading}
            onClick={() => void handleAsyncExport("csv")}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            {exportingAsync ? "Creating Job..." : "CSV (Async)"}
          </button>
        </div>
      </section>

      {/* Summary section */}
      {summary && Object.keys(summary).length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ringkasan
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCell(key, value)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Data table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-slate-600">
              Memuat data...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-600">
              Tidak ada data untuk ditampilkan.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="whitespace-nowrap px-4 py-3">
                      {col.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={String(item.id ?? idx)} className="hover:bg-slate-50">
                    {columns.map((col) => (
                      <td key={col} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatCell(col, item[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Pagination */}
      {meta ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Total: {meta.totalItems.toLocaleString("id-ID")} items
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(Math.max(1, meta.currentPage - 1))}
              disabled={loading || meta.currentPage <= 1}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Prev
            </button>
            <span className="text-sm text-slate-600">
              Page {meta.currentPage} / {meta.totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(Math.min(meta.totalPages, meta.currentPage + 1))}
              disabled={loading || meta.currentPage >= meta.totalPages}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* Last export job info */}
      {lastExportJob ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Export job untuk <strong>{reportTypeLabels[lastExportJob.reportType]}</strong> telah dibuat. 
          Cek status di <a href="/akuntan/export-logs" className="underline">Export Logs</a>.
        </div>
      ) : null}
    </FeaturePage>
  );
}
