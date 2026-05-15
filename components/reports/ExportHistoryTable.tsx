"use client";

import { ExportStatusBadge } from "./ExportStatusBadge";
import type { ExportLog } from "@/types/export-log";

const REPORT_TYPE_LABELS: Record<string, string> = {
  sales: "Laporan Penjualan",
  orders: "Laporan Pesanan",
  invoices: "Laporan Tagihan",
  payments: "Laporan Pembayaran",
  receivables: "Laporan Piutang",
  stocks: "Laporan Stok",
  shipments: "Laporan Pengiriman",
};

interface ExportHistoryTableProps {
  logs: ExportLog[];
  highlightId?: string | null;
  onDownload: (id: string) => void;
  downloadingId?: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ExportHistoryTable({
  logs,
  highlightId,
  onDownload,
  downloadingId,
}: ExportHistoryTableProps) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Laporan</th>
            <th className="px-4 py-3 text-left font-medium">Format</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Diminta</th>
            <th className="px-4 py-3 text-left font-medium">Selesai</th>
            <th className="px-4 py-3 text-left font-medium">Ukuran</th>
            <th className="px-4 py-3 text-left font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              data-export-id={log.id}
              className={`border-b transition-colors ${
                highlightId === log.id
                  ? "bg-yellow-50"
                  : "hover:bg-slate-50"
              }`}
            >
              <td className="px-4 py-3">
                {REPORT_TYPE_LABELS[log.reportType] ?? log.reportType}
              </td>
              <td className="px-4 py-3 uppercase">{log.format}</td>
              <td className="px-4 py-3">
                <ExportStatusBadge
                  status={log.status}
                  errorMessage={log.errorMessage}
                />
              </td>
              <td className="px-4 py-3">
                {formatDate(log.queuedAt ?? log.createdAt)}
              </td>
              <td className="px-4 py-3">{formatDate(log.completedAt)}</td>
              <td className="px-4 py-3">{formatBytes(log.sizeBytes)}</td>
              <td className="px-4 py-3">
                {log.status === "SUCCESS" && (
                  <button
                    type="button"
                    onClick={() => onDownload(log.id)}
                    disabled={downloadingId === log.id}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {downloadingId === log.id ? "Memuat..." : "Download"}
                  </button>
                )}
                {log.status === "FAILED" && log.errorMessage && (
                  <span
                    className="text-xs text-red-600"
                    title={log.errorMessage}
                  >
                    {log.errorMessage.length > 40
                      ? `${log.errorMessage.slice(0, 40)}...`
                      : log.errorMessage}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
