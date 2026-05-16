import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";
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
  amount: number;
  totalAmount?: number;
  remainingAmount: number;
  status: string;
  storeId?: string;
}

type ReceivableListParams = Record<string, string | number | boolean | undefined>;

interface PaginatedMeta {
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
  async getAging(): Promise<ReceivableAging> {
    const res = await apiClient.get<ApiResponse<ReceivableAging>>("/receivables/aging");
    return res.data.data;
  },

  async listReceivables(
    params?: ReceivableListParams
  ): Promise<{ data: ReceivableRow[]; meta?: PaginatedMeta; summary?: ReceivableReportSummary }> {
    const res = await apiClient.get<ReceivableListResponseData>("/reports/receivables", { params });
    return {
      data: res.data.data ?? [],
      meta: res.data.meta,
      summary: res.data.summary,
    };
  },

  async listForSales(
    params?: ReceivableListParams
  ): Promise<{ data: ReceivableRow[]; meta?: PaginatedMeta }> {
    const res = await apiClient.get<ReceivableListResponseData>("/sales/receivables", { params });
    return {
      data: res.data.data ?? [],
      meta: res.data.meta,
    };
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
    const res = await apiClient.get<ReceivableListResponseData>("/toko/receivables", { params });
    return {
      data: res.data.data ?? [],
      meta: res.data.meta,
    };
  },

  async listAllForToko(params?: ReceivableListParams): Promise<ReceivableRow[]> {
    return collectPaginatedItems(
      async (page, limit) => {
        const result = await this.listForToko({
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

  async exportReceivables(format = "pdf", params?: ReceivableListParams): Promise<Blob> {
    const res = await apiClient.get(`/reports/receivables/export`, {
      params: { ...(params || {}), format },
      responseType: "blob",
    });
    return res.data as Blob;
  },
};
