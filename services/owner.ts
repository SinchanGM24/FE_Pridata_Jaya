import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface OwnerSalesDirectoryItem {
	userId: string;
	name: string;
	email: string;
	image: string | null;
	managedStoreCount: number;
	salesTargetAmount: number;
	targetYear: number;
	targetMonth: number;
}

export interface OwnerStoreAssignmentItem {
	storeId: string;
	storeName: string;
	email: string;
	verificationStatus: string;
	creditLimit: number;
	isActive: boolean;
	city: {
		id: string;
		name: string;
		province: string;
	} | null;
	ownerUser: {
		id: string;
		name: string;
		email: string;
	} | null;
	assignedSales: {
		id: string;
		name: string;
		email: string;
	} | null;
}

export const ownerService = {
	async getSalesDirectory(params?: {
		search?: string;
		year?: number;
		month?: number;
	}): Promise<OwnerSalesDirectoryItem[]> {
		const response = await apiClient.get<ApiResponse<OwnerSalesDirectoryItem[]>>(
			"/owner/sales-directory",
			{ params },
		);
		return response.data.data;
	},

	async upsertSalesTarget(
		userId: string,
		payload: {
			year: number;
			month: number;
			targetAmount: number;
		},
	): Promise<OwnerSalesDirectoryItem> {
		const response = await apiClient.put<ApiResponse<OwnerSalesDirectoryItem>>(
			`/owner/sales-directory/${userId}/target`,
			payload,
		);
		return response.data.data;
	},

	async getStoreAssignments(search?: string): Promise<OwnerStoreAssignmentItem[]> {
		const response = await apiClient.get<ApiResponse<OwnerStoreAssignmentItem[]>>(
			"/owner/store-assignments",
			{ params: search ? { search } : undefined },
		);
		return response.data.data;
	},

	async assignSales(storeId: string, assignedSalesUserId: string | null) {
		const response = await apiClient.patch<ApiResponse<OwnerStoreAssignmentItem>>(
			`/owner/stores/${storeId}/assign-sales`,
			{ assignedSalesUserId },
		);
		return response.data.data;
	},
};
