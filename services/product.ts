import apiClient from "@/lib/api-client";
import type { ApiResponse, PaginatedResponse } from "@/types";

export interface Product {
	id: string;
	name: string;
	sku?: string;
	description?: string;
	categoryId?: string;
	brandId?: string;
	divisionId?: string;
	price?: number;
	stockQuantity?: number;
	isPublished?: boolean;
	image?: string;
	createdAt: string;
	updatedAt: string;
}

export const productService = {
	async getAll(page = 1, limit = 10): Promise<PaginatedResponse<Product>> {
		const response = await apiClient.get<ApiResponse<PaginatedResponse<Product>>>(
			"/products",
			{
				params: { page, limit },
			},
		);
		return response.data.data;
	},

	async getById(id: string): Promise<Product> {
		const response = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
		return response.data.data;
	},

	async create(data: Partial<Product>): Promise<Product> {
		const response = await apiClient.post<ApiResponse<Product>>("/products", data);
		return response.data.data;
	},

	async update(id: string, data: Partial<Product>): Promise<Product> {
		const response = await apiClient.put<ApiResponse<Product>>(`/products/${id}`, data);
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/products/${id}`);
	},
};
