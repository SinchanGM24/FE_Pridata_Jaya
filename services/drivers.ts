import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";
import type { ApiResponse } from "@/types";

export interface DriverListItem {
	id: string;
	name: string;
	phone?: string | null;
	isActive: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface CreateDriverPayload {
	name: string;
	phone?: string;
	isActive?: boolean;
}

export interface UpdateDriverPayload {
	name?: string;
	phone?: string;
	isActive?: boolean;
}

interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

interface PaginatedApiResponse<T> {
	success: boolean;
	message: string;
	data: T[];
	meta: PaginationMeta;
}

interface DriverListParams {
	page?: number;
	limit?: number;
	search?: string;
	isActive?: boolean;
	sortBy?: "name" | "createdAt" | "updatedAt" | "isActive";
	sortOrder?: "asc" | "desc";
}

export const driversService = {
	async list(params?: DriverListParams): Promise<{ items: DriverListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<DriverListItem>>("/drivers", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(params?: Omit<DriverListParams, "page" | "limit">): Promise<DriverListItem[]> {
		return collectPaginatedItems(
			(page, limit) =>
				this.list({
					...(params || {}),
					page,
					limit,
				}),
			100,
		);
	},

	async create(payload: CreateDriverPayload): Promise<DriverListItem> {
		const response = await apiClient.post<ApiResponse<DriverListItem>>("/drivers", payload);
		return response.data.data;
	},

	async update(id: string, payload: UpdateDriverPayload): Promise<DriverListItem> {
		const response = await apiClient.put<ApiResponse<DriverListItem>>(`/drivers/${id}`, payload);
		return response.data.data;
	},

	async updateStatus(id: string, isActive: boolean): Promise<DriverListItem> {
		const response = await apiClient.patch<ApiResponse<DriverListItem>>(`/drivers/${id}/status`, {
			isActive,
		});
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<DriverListItem>>(`/drivers/${id}`);
	},
};
