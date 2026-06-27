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

type CatalogProductResponse = Partial<CatalogProduct> & {
	name?: string;
	stockQuantity?: number;
	categoryId?: string | null;
	brandId?: string | null;
	category?: CatalogProduct["product"]["category"];
	brand?: CatalogProduct["product"]["brand"];
	productDetail?: CatalogProduct["product"]["productDetail"];
};

const readSpec = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
};

const toNumber = (value: unknown) => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
};

const normalizeCatalogProduct = (row: CatalogProductResponse): CatalogProduct => {
	const rawProduct = row.product ?? {
		id: row.productId ?? row.id ?? "",
		name: row.name ?? row.marketingName ?? "Produk",
		stockQuantity: row.stockQuantity ?? 0,
		category: row.category ?? null,
		brand: row.brand ?? null,
		division: row.division ?? null,
		subDivision: row.subDivision ?? null,
		categoryId: row.categoryId ?? null,
		brandId: row.brandId ?? null,
		divisionId: row.divisionId ?? null,
		subDivisionId: row.subDivisionId ?? null,
		productDetail: row.productDetail ?? null,
	};
	const spec = readSpec(rawProduct.productDetail?.spec);
	const marketingName =
		typeof row.marketingName === "string" && row.marketingName.trim()
			? row.marketingName.trim()
			: typeof spec.marketingName === "string" && spec.marketingName.trim()
				? spec.marketingName.trim()
				: rawProduct.name;
	const sellingPrice = toNumber(row.sellingPrice ?? spec.sellingPrice ?? spec.price);
	const imageList = Array.isArray(row.imageList)
		? row.imageList.filter((item): item is string => typeof item === "string")
		: Array.isArray(rawProduct.productDetail?.imageList)
			? rawProduct.productDetail.imageList.filter((item): item is string => typeof item === "string")
			: [];

	return {
		id: row.id ?? row.productId ?? rawProduct.id,
		productId: row.productId ?? rawProduct.id,
		marketingName,
		sellingPrice,
		description: row.description ?? rawProduct.productDetail?.description ?? null,
		imageList,
		isPublished: row.isPublished ?? true,
		divisionId: row.divisionId ?? rawProduct.divisionId ?? null,
		subDivisionId: row.subDivisionId ?? rawProduct.subDivisionId ?? null,
		division: row.division ?? rawProduct.division ?? null,
		subDivision: row.subDivision ?? rawProduct.subDivision ?? null,
		product: {
			id: rawProduct.id,
			name: rawProduct.name,
			stockQuantity: rawProduct.stockQuantity ?? 0,
			category: rawProduct.category ?? null,
			brand: rawProduct.brand ?? null,
			division: rawProduct.division ?? null,
			subDivision: rawProduct.subDivision ?? null,
			categoryId: rawProduct.categoryId ?? null,
			brandId: rawProduct.brandId ?? null,
			divisionId: rawProduct.divisionId ?? null,
			subDivisionId: rawProduct.subDivisionId ?? null,
			productDetail: rawProduct.productDetail ?? null,
		},
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
};

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
		const response = await apiClient.get<PaginatedApiResponse<CatalogProductResponse>>("/catalog-products", {
			params,
		});
		return { items: response.data.data.map(normalizeCatalogProduct), meta: response.data.meta };
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
		const response = await apiClient.get<PaginatedApiResponse<CatalogProductResponse>>(
			"/catalog-products/published",
			{ params },
		);
		return { items: response.data.data.map(normalizeCatalogProduct), meta: response.data.meta };
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
		const response = await apiClient.post<ApiResponse<CatalogProductResponse>>("/catalog-products", payload);
		return normalizeCatalogProduct(response.data.data);
	},

	async update(catalogId: string, payload: CatalogProductPayload): Promise<CatalogProduct> {
		const response = await apiClient.put<ApiResponse<CatalogProductResponse>>(
			`/catalog-products/${catalogId}`,
			payload,
		);
		return normalizeCatalogProduct(response.data.data);
	},

	async delete(catalogId: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/catalog-products/${catalogId}`);
	},
};
