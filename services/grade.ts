import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface StoreGradeItem {
	storeId: string;
	storeName: string;
	email: string;
	verificationStatus: string;
	creditLimit: number;
	totalOrders: number;
	totalInvoices: number;
	totalSalesAmount: number;
	totalPaidAmount: number;
	totalOutstandingAmount: number;
	grade: "A" | "B" | "C" | "D";
}

export const gradeService = {
	async list(params?: { search?: string; storeId?: string }): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>("/store-grades", {
			params,
		});
		return response.data.data;
	},

	async listForToko(): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>("/toko/grade");
		return response.data.data;
	},

	async listForSales(params?: { search?: string }): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>("/sales/store-grades", {
			params,
		});
		return response.data.data;
	},
};
