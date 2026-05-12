import apiClient from "@/lib/api-client";

export type ProductCondition = "NEW" | "GOOD" | "DAMAGED" | "DEFECTIVE";

export interface WarehouseInventoryItem {
	id: string;
	warehouseId: string;
	productId: string;
	condition: ProductCondition;
	quantity: number;
	createdAt?: string;
	updatedAt?: string;
	warehouse?: {
		id: string;
		name: string;
		address?: string;
		city?: {
			id: string;
			name: string;
		};
	};
	product?: {
		id: string;
		name: string;
		sku?: string | null;
		stockQuantity?: number;
		category?: {
			id: string;
			name: string;
		};
		brand?: {
			id: string;
			name: string;
		};
	};
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

export const warehouseInventoryService = {
	async list(params?: {
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<{ items: WarehouseInventoryItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<WarehouseInventoryItem>>(
			"/warehouse-inventory",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async create(payload: {
		warehouseId: string;
		productId: string;
		condition: ProductCondition;
		quantity: number;
	}): Promise<WarehouseInventoryItem> {
		const response = await apiClient.post<ApiResponse<WarehouseInventoryItem>>(
			"/warehouse-inventory",
			payload,
		);
		return response.data.data;
	},

	async adjust(
		id: string,
		payload: {
			quantity: number;
			reason: string;
		},
	): Promise<WarehouseInventoryItem> {
		const response = await apiClient.post<ApiResponse<WarehouseInventoryItem>>(
			`/warehouse-inventory/${id}/adjust`,
			payload,
		);
		return response.data.data;
	},
};
