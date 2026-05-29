import apiClient from "@/lib/api-client";
import { toIsoEndOfLocalDay, toIsoStartOfLocalDay } from "@/lib/datetime";
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
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export type SalesReportFilters = ReportParams;

export interface SalesReportInvoice extends ReportRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  status: string;
  storeId: string;
  storeNameSnapshot?: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  store?: {
    name?: string | null;
    assignedSalesUser?: {
      id?: string;
      name?: string | null;
      email?: string | null;
    } | null;
  } | null;
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
  exportLogId?: string;
  jobId?: string;
  reportType: ReportType;
  format: ExportFormat;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  message?: string;
}

interface RawExportJobResponse extends Omit<ExportJobResponse, "id"> {
  id?: string;
  exportLogId?: string;
}

// Report result type
export interface ReportResult<T extends ReportRow = ReportRow> {
  items: T[];
  meta?: PaginationMeta;
  summary?: Record<string, unknown>;
}

const toStartOfDayIso = (value: string) => {
  if (!value) return undefined;
  if (value.includes("T")) return value;
  return toIsoStartOfLocalDay(value);
};

const toEndOfDayIso = (value: string) => {
  if (!value) return undefined;
  if (value.includes("T")) return value;
  return toIsoEndOfLocalDay(value);
};

const normalizeReportParams = (params?: ReportParams): ReportParams | undefined => {
  if (!params) return undefined;
  return {
    ...params,
    dateFrom: params.dateFrom ? toStartOfDayIso(params.dateFrom) : undefined,
    dateTo: params.dateTo ? toEndOfDayIso(params.dateTo) : undefined,
  };
};

const readBlobError = async (blob: Blob): Promise<string | null> => {
  if (!blob.type.includes("application/json")) return null;

  try {
    const payload = JSON.parse(await blob.text()) as { message?: unknown };
    return typeof payload.message === "string" ? payload.message : null;
  } catch {
    return null;
  }
};

const isBackgroundExportDisabled = (error: unknown) => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return false;
  }

  const payload = (error as { response?: { data?: { code?: unknown } } }).response?.data;
  return payload?.code === "BACKGROUND_EXPORT_DISABLED";
};

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
      { params: normalizeReportParams(params) }
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
      params: { ...normalizeReportParams(params), format },
      responseType: "blob",
    });
    const errorMessage = await readBlobError(response.data as Blob);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
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
    const response = await apiClient
      .post<ApiResponse<RawExportJobResponse>>(
        `/reports/${type}/export-jobs`,
        null,
        { params: { ...normalizeReportParams(params), format } }
      )
      .catch((error: unknown) => {
        if (isBackgroundExportDisabled(error)) {
          throw new Error(
            "Export async belum aktif di backend. Aktifkan BULLMQ_ENABLED=true, Redis, dan worker report export; sementara gunakan export sync.",
          );
        }
        throw error;
      });
    const data = response.data.data;
    return {
      ...data,
      id: data.id ?? data.exportLogId ?? data.jobId ?? "",
      reportType: data.reportType ?? type,
      format: data.format ?? format,
      status: data.status,
    };
  },

  async getSales(params?: SalesReportFilters): Promise<ReportResult<SalesReportInvoice>> {
    const result = await this.getReport("sales", params);
    return result as ReportResult<SalesReportInvoice>;
  },

  async exportSales(format: ExportFormat, params?: SalesReportFilters): Promise<Blob> {
    return this.exportReport("sales", format, params);
  },

  async listAllSales(params?: Omit<SalesReportFilters, "page" | "limit">): Promise<SalesReportInvoice[]> {
    const firstPage = await this.getSales({ ...params, page: 1, limit: 100 });
    const totalPages = firstPage.meta?.totalPages ?? 1;
    if (totalPages <= 1) return firstPage.items;

    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        this.getSales({ ...params, page: index + 2, limit: 100 }),
      ),
    );

    return firstPage.items.concat(rest.flatMap((result) => result.items));
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
