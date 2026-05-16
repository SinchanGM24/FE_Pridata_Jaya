import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export interface CatalogProduct {
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
	product: {
		id: string;
		name: string;
		stockQuantity?: number;
		category?: { id: string; name: string } | null;
		brand?: { id: string; name: string } | null;
		division?: { id: string; name: string } | null;
		subDivision?: { id: string; name: string } | null;
		categoryId?: string | null;
		brandId?: string | null;
		divisionId?: string | null;
		subDivisionId?: string | null;
		productDetail?: {
			description?: string | null;
			imageList?: string[];
			spec?: Record<string, unknown> | null;
		} | null;
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

export interface CatalogProductPayload {
	productId?: string;
	marketingName?: string;
	sellingPrice?: number;
	description?: string;
	imageList?: string[];
	isPublished?: boolean;
	divisionId?: string | null;
	subDivisionId?: string | null;
}

export const catalogProductsService = {
	async list(params?: {
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		search?: string;
		isPublished?: boolean;
		productId?: string;
		divisionId?: string;
		subDivisionId?: string;
	}): Promise<{ items: CatalogProduct[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<CatalogProduct>>("/catalog-products", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listPublished(params?: {
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		search?: string;
		divisionId?: string;
		subDivisionId?: string;
	}): Promise<{ items: CatalogProduct[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<CatalogProduct>>(
			"/catalog-products/published",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAllPublished(
		params?: Omit<
			{
				page?: number;
				limit?: number;
				sortBy?: string;
				sortOrder?: "asc" | "desc";
				search?: string;
				divisionId?: string;
				subDivisionId?: string;
			},
			"page" | "limit"
		>,
	): Promise<CatalogProduct[]> {
		return collectPaginatedItems(
			(page, limit) =>
				this.listPublished({
					...(params || {}),
					page,
					limit,
				}),
			100,
		);
	},

	async create(payload: CatalogProductPayload): Promise<CatalogProduct> {
		const response = await apiClient.post<ApiResponse<CatalogProduct>>("/catalog-products", payload);
		return response.data.data;
	},

	async update(catalogId: string, payload: CatalogProductPayload): Promise<CatalogProduct> {
		const response = await apiClient.put<ApiResponse<CatalogProduct>>(
			`/catalog-products/${catalogId}`,
			payload,
		);
		return response.data.data;
	},

	async delete(catalogId: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/catalog-products/${catalogId}`);
	},
};
