import apiClient from "@/lib/api-client";
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

export const receivableService = {
  async getAging(): Promise<ReceivableAging> {
    const res = await apiClient.get<ApiResponse<ReceivableAging>>("/receivables/aging");
    return res.data.data;
  },

  async listReceivables(
    params?: Record<string, any>
  ): Promise<{ data: ReceivableRow[]; meta?: any; summary?: ReceivableReportSummary }> {
    const res = await apiClient.get<ApiResponse<any>>("/reports/receivables", { params });
    return {
      data: res.data.data ?? [],
      meta: res.data.meta,
      summary: (res.data as any).summary,
    };
  },

  async listForSales(params?: Record<string, any>): Promise<{ data: ReceivableRow[]; meta?: any }> {
    const res = await apiClient.get<ApiResponse<any>>("/sales/receivables", { params });
    return {
      data: res.data.data ?? [],
      meta: res.data.meta,
    };
  },

  async listForToko(params?: Record<string, any>): Promise<{ data: ReceivableRow[]; meta?: any }> {
    const res = await apiClient.get<ApiResponse<any>>("/toko/receivables", { params });
    return {
      data: res.data.data ?? [],
      meta: res.data.meta,
    };
  },

  async exportReceivables(format = "pdf", params?: Record<string, any>): Promise<Blob> {
    const res = await apiClient.get(`/reports/receivables/export`, {
      params: { ...(params || {}), format },
      responseType: "blob",
    });
    return res.data as Blob;
  },
};
