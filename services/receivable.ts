import apiClient from "@/lib/api-client";
import { featureMockGet, USE_NEXT_FEATURE_MOCK_SERVER } from "@/lib/feature-mock";
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
  async getAging(storeId?: string): Promise<ReceivableAging> {
    const res = await apiClient.get<ApiResponse<ReceivableAging>>("/receivables/aging", {
      params: storeId ? { storeId } : undefined,
    });
    return res.data.data;
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

  async listAllReceivables(params?: ReceivableListParams): Promise<ReceivableRow[]> {
    return collectPaginatedItems(
      async (page, limit) => {
        const result = await this.listReceivables({
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

  async listForSales(
    params?: ReceivableListParams
  ): Promise<{ data: ReceivableRow[]; meta?: PaginatedMeta }> {
    if (USE_NEXT_FEATURE_MOCK_SERVER) {
      const payload = await featureMockGet<ReceivableListResponseData>("/sales/receivables", params);
      return { data: payload.data ?? [], meta: payload.meta };
    }
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

  async exportReceivables(format: ExportFormat = "pdf", params?: ReceivableListParams): Promise<ExportJobResponse> {
    return reportsService.createExportJob("receivables", format, params);
  },
};
