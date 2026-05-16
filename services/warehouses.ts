import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export interface WarehouseListItem {
	id: string;
	name: string;
	address?: string;
	cityId?: string;
	city?: {
		id: string;
		name: string;
		province?: string;
	};
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

interface WarehouseListParams {
	page?: number;
	limit?: number;
	search?: string;
}

export const warehousesService = {
	async list(params?: WarehouseListParams): Promise<{ items: WarehouseListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<WarehouseListItem>>("/warehouses", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(params?: Omit<WarehouseListParams, "page" | "limit">): Promise<WarehouseListItem[]> {
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

	async getById(id: string): Promise<WarehouseListItem> {
		const response = await apiClient.get<ApiResponse<WarehouseListItem>>(`/warehouses/${id}`);
		return response.data.data;
	},

	async create(payload: { name: string; address: string; cityId: string }): Promise<WarehouseListItem> {
		const response = await apiClient.post<ApiResponse<WarehouseListItem>>("/warehouses", payload);
		return response.data.data;
	},

	async update(
		id: string,
		payload: { name?: string; address?: string; cityId?: string },
	): Promise<WarehouseListItem> {
		const response = await apiClient.put<ApiResponse<WarehouseListItem>>(`/warehouses/${id}`, payload);
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/warehouses/${id}`);
	},
};
