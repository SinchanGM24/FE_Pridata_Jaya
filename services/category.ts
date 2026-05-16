import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";
import type { ApiResponse, PaginatedResponse } from "@/types";

export interface Category {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

export const categoryService = {
	async getAll(page = 1, limit = 10): Promise<PaginatedResponse<Category>> {
		const response = await apiClient.get<ApiResponse<Category[]>>("/categories", {
			params: { page, limit },
		});
		const meta = response.data.meta as Partial<PaginatedResponse<Category>> | undefined;
		return {
			data: response.data.data ?? [],
			page: meta?.page ?? page,
			limit: meta?.limit ?? limit,
			totalItems: meta?.totalItems ?? response.data.data?.length ?? 0,
			totalPages: meta?.totalPages ?? 1,
		};
	},

	async listAll(): Promise<Category[]> {
		return collectPaginatedItems(async (page, limit) => {
			const response = await this.getAll(page, limit);
			return {
				items: response.data,
				meta: {
					currentPage: response.page,
					totalPages: response.totalPages,
					totalItems: response.totalItems,
					itemsPerPage: response.limit,
				},
			};
		}, 100);
	},

	async create(data: Partial<Category>): Promise<Category> {
		const response = await apiClient.post<ApiResponse<Category>>(
			"/categories",
			data,
		);
		return response.data.data;
	},

	async update(id: string, data: Partial<Category>): Promise<Category> {
		const response = await apiClient.put<ApiResponse<Category>>(
			`/categories/${id}`,
			data,
		);
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/categories/${id}`);
	},
};
