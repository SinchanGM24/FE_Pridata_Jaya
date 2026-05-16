import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface DashboardSalesSummary {
	totalInvoices: number;
	totalAmount: number;
	totalPaidAmount: number;
	totalRemainingAmount: number;
	byStatus: Record<string, number>;
}

export interface DashboardAgingBucket {
	count: number;
	amount: number;
}

export interface DashboardReceivableSummary {
	totalReceivables: number;
	totalOutstandingAmount: number;
	overdueCount: number;
	aging: {
		current: DashboardAgingBucket;
		days1To30: DashboardAgingBucket;
		days31To60: DashboardAgingBucket;
		days61To90: DashboardAgingBucket;
		daysOver90: DashboardAgingBucket;
	};
}

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

	async getSales(params?: Record<string, unknown>): Promise<DashboardSalesSummary> {
		const res = await apiClient.get<ApiResponse<DashboardSalesSummary>>("/dashboard/sales", {
			params,
		});
		return res.data.data;
	},

	async getReceivables(params?: Record<string, unknown>): Promise<DashboardReceivableSummary> {
		const res = await apiClient.get<ApiResponse<DashboardReceivableSummary>>(
			"/dashboard/receivables",
			{ params },
		);
		return res.data.data;
	},
};
