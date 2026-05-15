"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useExportLogs } from "@/hooks/useExportLogs";
import { exportLogsService } from "@/services/exportLogs";
import { ExportHistoryTable } from "@/components/reports/ExportHistoryTable";

export default function OwnerExportHistoryPage() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const { logs, loading, total } = useExportLogs();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    // Scroll highlighted row into view after data loads
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-export-id="${highlightId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(timer);
  }, [highlightId, logs.length]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const result = await exportLogsService.getDownloadUrl(id);
      if (!result.url) {
        toast.error("File belum siap atau sudah dihapus");
        return;
      }
      // Open presigned URL in new tab — browser handles download via Content-Disposition
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengunduh file";
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Riwayat Export</h1>
        <p className="text-sm text-slate-500">
          Daftar laporan yang pernah Anda export. Link download berlaku 15
          menit per klik dan akan diregenerasi otomatis bila kedaluwarsa.
        </p>
      </div>

      {loading && logs.length === 0 && (
        <p className="text-sm text-slate-500">Memuat...</p>
      )}

      {!loading && logs.length === 0 && (
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">
            Belum ada export. Buka halaman laporan dan klik tombol Export untuk
            memulai.
          </p>
        </div>
      )}

      {logs.length > 0 && (
        <>
          <ExportHistoryTable
            logs={logs}
            highlightId={highlightId}
            onDownload={handleDownload}
            downloadingId={downloadingId}
          />
          <p className="text-xs text-slate-400">
            Menampilkan {logs.length} dari {total} riwayat export.
          </p>
        </>
      )}
    </div>
  );
}
