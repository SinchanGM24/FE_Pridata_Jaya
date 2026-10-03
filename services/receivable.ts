import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";
import { reportsService, type ExportFormat, type ExportJobResponse } from "@/services/reports";
import type { ApiResponse } from "@/types";

export interface AgingBucket {
  count: number;
  amount: number;
}

export interface ReceivableAging {
  current: AgingBucket;
  days1To30: AgingBucket;
  days31To60: AgingBucket;
  days61To90: AgingBucket;
  daysOver90: AgingBucket;
  totalReceivables: number;
  totalOutstandingAmount: number;
  overdueCount: number;
  /** Invoice yang lewat jatuh tempo lebih dari 30 hari. */
  overdueOver30Count: number;
}

/** Hari lewat jatuh tempo, dihitung dari 00:00 WITA hari ini (satu definisi di BE). */
export type AgeBucket = "current" | "days1To30" | "days31To60" | "days61To90" | "daysOver90";

/** Filter yang sama untuk daftar, grup toko, dan ringkasan aging: ketiganya memilih invoice yang sama. */
export interface ReceivableFilters {
  search?: string;
  status?: "UNPAID" | "PARTIAL";
  ageBucket?: AgeBucket;
  storeId?: string;
}

export interface ReceivableStoreGroup {
  storeId: string;
  storeName: string;
  totalInvoiceCount: number;
  totalOutstandingAmount: number;
  overdueOver30Count: number;
  maxDaysOverdue: number;
}

export interface ReceivableReportSummary {
  totalReceivables: number;
  totalOutstandingAmount: number;
  overdueCount: number;
  aging?: {
    current: AgingBucket;
    days1To30: AgingBucket;
    days31To60: AgingBucket;
    days61To90: AgingBucket;
    daysOver90: AgingBucket;
  };
}

export interface ReceivableRow {
  id: string;
  invoiceNumber: string;
  invoiceDate?: string | null;
  customerName?: string;
  storeNameSnapshot?: string;
  store?: {
    id: string;
    name: string;
  };
  dueDate?: string | null;
  /** 0 selama belum jatuh tempo, 1 sejak hari pertama lewat jatuh tempo. */
  daysOverdue: number;
  amount: number;
  totalAmount?: number;
  remainingAmount: number;
  status: string;
  storeId?: string;
}

type ReceivableListParams = Record<string, string | number | boolean | undefined>;

export interface PaginatedMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

type ReceivableListResponseData = Omit<ApiResponse<ReceivableRow[]>, "meta"> & {
  meta?: PaginatedMeta;
  summary?: ReceivableReportSummary;
};

export const receivableService = {
  /** Lima bucket mengabaikan `ageBucket`; empat total mengikutinya. */
  async getAging(params?: ReceivableFilters): Promise<ReceivableAging> {
    const res = await apiClient.get<ApiResponse<ReceivableAging>>("/receivables/aging", { params });
    return res.data.data;
  },

  /** Satu baris per toko, sisa tagihan terbesar dulu (urutan tetap di BE). */
  async listStoreGroups(
    params: ReceivableFilters & { page: number; limit: number }
  ): Promise<{ items: ReceivableStoreGroup[]; meta?: PaginatedMeta }> {
    const res = await apiClient.get<
      Omit<ApiResponse<ReceivableStoreGroup[]>, "meta"> & { meta?: PaginatedMeta }
    >("/receivables/by-store", { params });
    return { items: res.data.data ?? [], meta: res.data.meta };
  },

  // One collection for every actor: the backend narrows the rows by the caller's
  // organization role, so sales and store sessions use this same call.
  async listReceivables(
    params?: ReceivableListParams
  ): Promise<{ data: ReceivableRow[]; meta?: PaginatedMeta; summary?: ReceivableReportSummary }> {
    const res = await apiClient.get<ReceivableListResponseData>("/receivables", { params });
    return {
      data: res.data.data ?? [],
      meta: res.data.meta,
      summary: res.data.summary,
    };
  },

  // Semua invoice piutang SATU toko (detail + cetak). `storeId` wajib: unduhan satu perusahaan sudah dihapus.
  // ponytail: memuat semua invoice SATU toko (limit 100/halaman) untuk detail + cetak; pindah ke total per toko + endpoint cetak di BE kalau satu toko punya ribuan invoice.
  async listAllForStore(
    storeId: string,
    params?: Omit<ReceivableFilters, "storeId">
  ): Promise<ReceivableRow[]> {
    return collectPaginatedItems(async (page, limit) => {
      const result = await this.listReceivables({
        ...params,
        storeId,
        page,
        limit,
        sortBy: "invoiceDate",
        sortOrder: "asc",
      });
      return { items: result.data, meta: result.meta };
    }, 100);
  },

  async listForSales(
    params?: ReceivableListParams
  ): Promise<{ data: ReceivableRow[]; meta?: PaginatedMeta }> {
    const { data, meta } = await this.listReceivables(params);
    return { data, meta };
  },

  async listAllForSales(params?: ReceivableListParams): Promise<ReceivableRow[]> {
    return collectPaginatedItems(
      async (page, limit) => {
        const result = await this.listForSales({
          ...(params || {}),
          page,
          limit,
        });
        return {
          items: result.data,
          meta: result.meta,
        };
      },
      100,
    );
  },

  async listForToko(
    params?: ReceivableListParams
  ): Promise<{ data: ReceivableRow[]; meta?: PaginatedMeta }> {
    const { data, meta } = await this.listReceivables(params);
    return { data, meta };
  },

  async exportReceivables(format: ExportFormat = "pdf", params?: ReceivableListParams): Promise<ExportJobResponse> {
    return reportsService.createExportJob("receivables", format, params);
  },
};
