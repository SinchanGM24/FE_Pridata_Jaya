/**
 * Export Log types — matching BE Prisma schema (model ExportLog @@map("export_logs")).
 * Source of truth: SMD-Pridata-BE/prisma/schema.prisma (lines 996-1034).
 */

export type ReportType =
  | "sales"
  | "orders"
  | "invoices"
  | "payments"
  | "receivables"
  | "stocks"
  | "shipments";

export type ExportFormat = "pdf" | "csv";

/** BE enum ExportStatus: PENDING | PROCESSING | SUCCESS | FAILED. */
export type ExportStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface ExportLog {
  id: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  reportType: ReportType;
  format: ExportFormat;
  filename: string;
  status: ExportStatus;
  jobId?: string | null;
  processingMode?: string | null;
  rowCount?: number | null;
  filters?: Record<string, unknown> | null;
  errorMessage?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  // Storage metadata (populated when status=SUCCESS)
  storageProvider?: string | null;
  bucket?: string | null;
  objectKey?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  storedAt?: string | null;
}

/**
 * Response shape from GET /api/v1/export-logs/:id/download.
 * BE regenerates presigned URL on each call (15 min expire).
 */
export interface ExportLogWithDownload {
  url: string;
  expiresIn: number; // seconds (typically 900 = 15 min)
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface ExportLogListResponse {
  data: ExportLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * BE response shape from POST /api/v1/reports/{type}/export-jobs.
 * Worker queues a BullMQ job and creates an ExportLog row immediately.
 */
export interface QueueExportResponse {
  jobId: string;
  exportLogId: string;
}
