import apiClient from "@/lib/api-client";
import type {
  ExportLog,
  ExportLogWithDownload,
  ExportLogListResponse,
  QueueExportResponse,
  ReportType,
  ExportFormat,
  ExportStatus,
} from "@/types/export-log";

export const exportLogsService = {
  /**
   * Queue an async export job.
   * POST /api/v1/reports/{type}/export-jobs?format=pdf&...filters
   * Returns 202 Accepted with jobId + exportLogId.
   */
  queueExport: async (
    type: ReportType,
    format: ExportFormat,
    filters: Record<string, unknown>
  ): Promise<QueueExportResponse> => {
    const res = await apiClient.post<{ data: QueueExportResponse }>(
      `/reports/${type}/export-jobs`,
      {},
      { params: { format, ...filters } }
    );
    return res.data.data;
  },

  /**
   * List user's export logs (paginated).
   * GET /api/v1/export-logs?reportType=&format=&status=&page=&limit=
   * Owner sees all org logs, other roles see own only (BE RBAC).
   */
  list: async (params: {
    reportType?: ReportType;
    format?: ExportFormat;
    status?: ExportStatus;
    actorUserId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ExportLogListResponse> => {
    const res = await apiClient.get<ExportLogListResponse>("/export-logs", {
      params,
    });
    return res.data;
  },

  /**
   * Get export status (lightweight poll).
   * GET /api/v1/export-logs/:id/status
   * Returns ExportLog without download URL.
   */
  getStatus: async (id: string): Promise<ExportLog> => {
    const res = await apiClient.get<{ data: ExportLog }>(
      `/export-logs/${id}/status`
    );
    return res.data.data;
  },

  /**
   * Get presigned download URL (regenerates on each call, 15 min expire).
   * GET /api/v1/export-logs/:id/download
   * Returns presigned MinIO URL + metadata.
   * Throws 409 if status !== SUCCESS, 410 if file deleted.
   */
  getDownloadUrl: async (id: string): Promise<ExportLogWithDownload> => {
    const res = await apiClient.get<{ data: ExportLogWithDownload }>(
      `/export-logs/${id}/download`
    );
    return res.data.data;
  },
};
