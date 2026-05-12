import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface OverallSummary {
	totalOrders: number;
	totalInvoices: number;
	totalSalesAmount: number;
	totalOutstandingReceivableAmount: number;
	totalDeliveryOrders: number;
	totalOutOfStockSkus: number;
}

export interface StockSummary {
	totalSkus: number;
	totalQuantity: number;
	outOfStockCount: number;
	lowStockCount: number;
	threshold: number;
}

export const dashboardService = {
	async getSummary(): Promise<OverallSummary> {
		const res = await apiClient.get<ApiResponse<OverallSummary>>("/dashboard/summary");
		return res.data.data;
	},

	async getStocks(threshold = 10): Promise<StockSummary> {
		const res = await apiClient.get<ApiResponse<StockSummary>>("/dashboard/stocks", {
			params: { threshold },
		});
		return res.data.data;
	},

	async getSales(params?: Record<string, any>): Promise<any> {
		const res = await apiClient.get<ApiResponse<any>>("/dashboard/sales", { params });
		return res.data.data;
	},

	async getReceivables(params?: Record<string, any>): Promise<any> {
		const res = await apiClient.get<ApiResponse<any>>("/dashboard/receivables", { params });
		return res.data.data;
	},
};
