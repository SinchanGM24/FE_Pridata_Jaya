import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export interface DivisionListItem {
	id: string;
	name: string;
	createdAt?: string;
	updatedAt?: string;
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

interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
}

export const divisionsService = {
	async list(params?: {
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		search?: string;
	}): Promise<{ items: DivisionListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<DivisionListItem>>("/divisions", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(params?: {
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		search?: string;
	}): Promise<DivisionListItem[]> {
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

	async create(payload: { name: string }): Promise<DivisionListItem> {
		const response = await apiClient.post<ApiResponse<DivisionListItem>>("/divisions", payload);
		return response.data.data;
	},

	async update(id: string, payload: { name: string }): Promise<DivisionListItem> {
		const response = await apiClient.put<ApiResponse<DivisionListItem>>(`/divisions/${id}`, payload);
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/divisions/${id}`);
	},
};
