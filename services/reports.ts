import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

// Report types union
export type ReportType =
  | "sales"
  | "orders"
  | "invoices"
  | "payments"
  | "receivables"
  | "stocks"
  | "shipments";

// Export format
export type ExportFormat = "pdf" | "csv";

// Common report parameters
export interface ReportParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  storeId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
}

// Pagination meta
interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// Paginated API response
interface PaginatedApiResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginationMeta;
  summary?: Record<string, unknown>;
}

// Report row type (generic record)
export type ReportRow = Record<string, unknown>;

// Export job response
export interface ExportJobResponse {
  id: string;
  jobId?: string;
  reportType: ReportType;
  format: ExportFormat;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  message?: string;
}

// Report result type
export interface ReportResult<T extends ReportRow = ReportRow> {
  items: T[];
  meta?: PaginationMeta;
  summary?: Record<string, unknown>;
}

/**
 * Generic reports service supporting all report types with sync and async export
 */
export const reportsService = {
  /**
   * Get report data for a specific report type
   */
  async getReport<T extends ReportRow = ReportRow>(
    type: ReportType,
    params?: ReportParams
  ): Promise<ReportResult<T>> {
    const response = await apiClient.get<PaginatedApiResponse<T>>(
      `/reports/${type}`,
      { params }
    );
    return {
      items: response.data.data,
      meta: response.data.meta,
      summary: response.data.summary,
    };
  },

  /**
   * Sync export - downloads file immediately (may timeout for large datasets)
   * Returns a Blob for download
   */
  async exportReport(
    type: ReportType,
    format: ExportFormat,
    params?: ReportParams
  ): Promise<Blob> {
    const response = await apiClient.get(`/reports/${type}/export`, {
      params: { ...params, format },
      responseType: "blob",
    });
    return response.data as Blob;
  },

  /**
   * Async export - creates a background job for large exports
   * Returns job info for status tracking via export-logs
   */
  async createExportJob(
    type: ReportType,
    format: ExportFormat,
    params?: ReportParams
  ): Promise<ExportJobResponse> {
    const response = await apiClient.post<ApiResponse<ExportJobResponse>>(
      `/reports/${type}/export-jobs`,
      null,
      { params: { ...params, format } }
    );
    return response.data.data;
  },
};

// Report type labels for UI
export const reportTypeLabels: Record<ReportType, string> = {
  sales: "Laporan Penjualan",
  orders: "Laporan Order",
  invoices: "Laporan Invoice",
  payments: "Laporan Pembayaran",
  receivables: "Laporan Piutang",
  stocks: "Laporan Stok",
  shipments: "Laporan Pengiriman",
};

// Report type list for selectors
export const reportTypes: ReportType[] = [
  "sales",
  "orders",
  "invoices",
  "payments",
  "receivables",
  "stocks",
  "shipments",
];
