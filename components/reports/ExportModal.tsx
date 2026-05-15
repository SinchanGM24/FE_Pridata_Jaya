"use client";

import { useState } from "react";
import { toast } from "sonner";
import { exportLogsService } from "@/services/exportLogs";
import type { ReportType, ExportFormat } from "@/types/export-log";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  reportType: ReportType;
  filters: Record<string, unknown>;
  filterSummary: string;
}

export function ExportModal({
  open,
  onClose,
  reportType,
  filters,
  filterSummary,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await exportLogsService.queueExport(reportType, format, filters);
      toast.success(
        "Export sedang diproses. Anda akan menerima notifikasi saat siap diunduh."
      );
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memproses export";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Export Laporan</h2>

        <div className="mb-4 rounded bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">Filter yang diterapkan:</p>
          <p className="mt-1 break-words">{filterSummary}</p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium">Format:</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={format === "pdf"}
                onChange={() => setFormat("pdf")}
                disabled={submitting}
              />
              <span>PDF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
                disabled={submitting}
              />
              <span>CSV</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Memproses..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
