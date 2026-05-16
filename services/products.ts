import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export interface Product {
	id: string;
	name: string;
	stockQuantity?: number;
	isPublished?: boolean;
	productDetail?: {
		description?: string | null;
		imageList?: string[];
		spec?: Record<string, unknown> | null;
	} | null;
	category?: { id: string; name: string } | null;
	brand?: { id: string; name: string } | null;
	division?: { id: string; name: string } | null;
	subDivision?: { id: string; name: string } | null;
	catalogProduct?: {
		id: string;
		productId: string;
		marketingName: string;
		sellingPrice: number;
		description?: string | null;
		imageList: string[];
		isPublished: boolean;
		divisionId?: string | null;
		subDivisionId?: string | null;
		division?: { id: string; name: string } | null;
		subDivision?: { id: string; name: string } | null;
	} | null;
	categoryId?: string | null;
	brandId?: string | null;
	divisionId?: string | null;
	subDivisionId?: string | null;
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

interface ProductListParams {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface CreateProductPayload {
	name: string;
	stockQuantity?: number;
	isPublished?: boolean;
	categoryId?: string | null;
	brandId?: string | null;
	divisionId?: string | null;
	subDivisionId?: string | null;
	productDetail?: {
		description?: string;
		imageList?: string[];
		spec?: Record<string, unknown>;
	};
}

export const productsService = {
	async list(params?: ProductListParams): Promise<{ items: Product[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<Product>>("/products", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(params?: Omit<ProductListParams, "page" | "limit">): Promise<Product[]> {
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

	async listPublished(params?: ProductListParams): Promise<{ items: Product[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<Product>>("/products/published", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async create(payload: CreateProductPayload): Promise<Product> {
		const response = await apiClient.post<ApiResponse<Product>>("/products", payload);
		return response.data.data;
	},

	async update(productId: string, payload: CreateProductPayload): Promise<Product> {
		const response = await apiClient.put<ApiResponse<Product>>(`/products/${productId}`, payload);
		return response.data.data;
	},

	async delete(productId: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/products/${productId}`);
	},
};
