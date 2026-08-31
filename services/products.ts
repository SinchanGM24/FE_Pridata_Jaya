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
	search?: string;
}

const readSpecNumber = (spec: Record<string, unknown> | null | undefined, keys: string[]) => {
	for (const key of keys) {
		const value = spec?.[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim()) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	return 0;
};

const normalizeProduct = (product: Product): Product => {
	if (product.catalogProduct) return product;

	const spec = product.productDetail?.spec ?? null;
	const hasCatalogMeta =
		product.isPublished === true ||
		spec?.catalogCreated === true ||
		typeof spec?.marketingName === "string" ||
		spec?.sellingPrice !== undefined ||
		spec?.price !== undefined;

	if (!hasCatalogMeta) {
		return { ...product, catalogProduct: null };
	}

	const marketingName =
		typeof spec?.marketingName === "string" && spec.marketingName.trim()
			? spec.marketingName.trim()
			: product.name;

	return {
		...product,
		catalogProduct: {
			id: product.id,
			productId: product.id,
			marketingName,
			sellingPrice: readSpecNumber(spec, ["sellingPrice", "price"]),
			description: product.productDetail?.description ?? null,
			imageList: product.productDetail?.imageList ?? [],
			isPublished: Boolean(product.isPublished),
			divisionId: product.divisionId ?? null,
			subDivisionId: product.subDivisionId ?? null,
			division: product.division ?? null,
			subDivision: product.subDivision ?? null,
		},
	};
};

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
		return { items: response.data.data.map(normalizeProduct), meta: response.data.meta };
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
		return { items: response.data.data.map(normalizeProduct), meta: response.data.meta };
	},

	async search(search = ""): Promise<Product[]> {
		return (await this.list({ page: 1, limit: 10, search, sortBy: "name", sortOrder: "asc" })).items;
	},

	async getById(productId: string): Promise<Product> {
		const response = await apiClient.get<ApiResponse<Product>>(`/products/${productId}`);
		return normalizeProduct(response.data.data);
	},

	async create(payload: CreateProductPayload): Promise<Product> {
		const response = await apiClient.post<ApiResponse<Product>>("/products", payload);
		return normalizeProduct(response.data.data);
	},

	async update(productId: string, payload: CreateProductPayload): Promise<Product> {
		const response = await apiClient.put<ApiResponse<Product>>(`/products/${productId}`, payload);
		return normalizeProduct(response.data.data);
	},

	async delete(productId: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/products/${productId}`);
	},
};
