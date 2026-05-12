import apiClient from "@/lib/api-client";
import type { ApiResponse, PaginatedResponse } from "@/types";

export interface Brand {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

export const brandService = {
	async getAll(page = 1, limit = 10): Promise<PaginatedResponse<Brand>> {
		const response = await apiClient.get<ApiResponse<Brand[]>>("/brands", {
			params: { page, limit },
		});
		const meta = response.data.meta as Partial<PaginatedResponse<Brand>> | undefined;
		return {
			data: response.data.data ?? [],
			page: meta?.page ?? page,
			limit: meta?.limit ?? limit,
			totalItems: meta?.totalItems ?? response.data.data?.length ?? 0,
			totalPages: meta?.totalPages ?? 1,
		};
	},

	async create(data: Partial<Brand>): Promise<Brand> {
		const response = await apiClient.post<ApiResponse<Brand>>("/brands", data);
		return response.data.data;
	},

	async update(id: string, data: Partial<Brand>): Promise<Brand> {
		const response = await apiClient.put<ApiResponse<Brand>>(`/brands/${id}`, data);
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/brands/${id}`);
	},
};
