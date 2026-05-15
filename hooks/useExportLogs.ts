"use client";

import { useCallback, useEffect, useState } from "react";
import { exportLogsService } from "@/services/exportLogs";
import { useRealtime } from "@/providers/RealtimeProvider";
import type {
  ExportLog,
  ExportStatus,
  ReportType,
} from "@/types/export-log";

const POLL_INTERVAL_MS = 30_000; // 30s polling for in-progress logs

export function useExportLogs(filters?: {
  status?: ExportStatus;
  reportType?: ReportType;
}) {
  const { subscribe } = useRealtime();
  const [logs, setLogs] = useState<ExportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await exportLogsService.list({ ...filters, page, limit: 20 });
      setLogs(res.data);
      setTotal(res.meta.total);
    } catch {
      // Keep last known state on error (network blip, auth expired handled by interceptor)
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Initial fetch + polling for in-progress logs
  useEffect(() => {
    fetchLogs();

    const interval = setInterval(() => {
      const hasInProgress = logs.some(
        (l) => l.status === "PENDING" || l.status === "PROCESSING"
      );
      if (hasInProgress) {
        fetchLogs();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchLogs, logs]);

  // SSE listener for export events (BE emits 'report.exported' and 'export.failed')
  useEffect(() => {
    const unsub = subscribe((event) => {
      if (event.event === "report.exported" || event.event === "export.failed") {
        // Refetch to get fresh list with updated status
        fetchLogs();
      }
    });
    return unsub;
  }, [subscribe, fetchLogs]);

  return {
    logs,
    loading,
    page,
    total,
    setPage,
    refetch: fetchLogs,
  };
}
