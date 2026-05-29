import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface StoreGradeItem {
	storeId: string;
	storeName: string;
	email: string;
	isActive?: boolean;
	verificationStatus: string;
	creditLimit: number;
	totalOrders: number;
	totalInvoices: number;
	totalSalesAmount: number;
	totalPaidAmount: number;
	totalOutstandingAmount: number;
	recentOrders: number;
	recentInvoices: number;
	recentSalesAmount: number;
	recentPaidAmount: number;
	recentOutstandingAmount: number;
	evaluationWindowStart: string;
	evaluationWindowEnd: string;
	probationEndsAt: string;
	storeAgeDays: number;
	gradeReason: string;
	grade: "N" | "A" | "B" | "C" | "D" | "E";
}

export const gradeService = {
	async list(params?: { search?: string; storeId?: string }): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>("/grade-toko", {
			params,
		});
		return response.data.data;
	},

	async listForToko(): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>("/toko/grade");
		return response.data.data;
	},

	async listForSales(params?: { search?: string }): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>("/sales/grade-toko", {
			params,
		});
		return response.data.data;
	},
};
