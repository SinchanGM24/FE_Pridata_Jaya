import apiClient from "@/lib/api-client";
import type { ProductCondition, WarehouseInventoryItem } from "@/services/warehouse-inventory";

export type StockAdjustmentType = "RECEIPT" | "DAMAGE" | "CORRECTION" | "OUTBOUND";

export interface StockAdjustmentRecordItem {
	id: string;
	quantity: number;
	fromCondition?: ProductCondition | null;
	toCondition?: ProductCondition | null;
}

export interface StockAdjustmentRecord {
	id: string;
	type: StockAdjustmentType;
	warehouseId: string;
	productId: string;
	transactionDate: string;
	reason?: string | null;
	warehouse?: {
		id: string;
		name: string;
		city?: { id: string; name: string; province?: string } | null;
	};
	product?: {
		id: string;
		name: string;
		sku?: string | null;
		category?: { id: string; name: string } | null;
		brand?: { id: string; name: string } | null;
	};
	items: StockAdjustmentRecordItem[];
	createdAt?: string;
	updatedAt?: string;
}

export interface StockAdjustmentMutationResult {
	record: StockAdjustmentRecord;
	inventories: WarehouseInventoryItem[];
	productStockQuantity: number;
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

export const stockAdjustmentsService = {
	async list(params?: {
		page?: number;
		limit?: number;
		type?: StockAdjustmentType;
		warehouseId?: string;
		productId?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<{ items: StockAdjustmentRecord[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<StockAdjustmentRecord>>(
			"/stock-adjustments",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async receiveStock(payload: {
		warehouseId: string;
		productId: string;
		receivedAt?: string;
		reason?: string;
		items: Array<{
			condition: "NEW" | "GOOD" | "DAMAGED" | "DEFECTIVE";
			quantity: number;
		}>;
	}): Promise<StockAdjustmentMutationResult> {
		const response = await apiClient.post<ApiResponse<StockAdjustmentMutationResult>>(
			"/stock-adjustments/receive",
			payload,
		);
		return response.data.data;
	},

	async receiveReturn(payload: {
		warehouseId: string;
		productId: string;
		receivedAt?: string;
		reason?: string;
		items: Array<{
			condition: "NEW" | "GOOD" | "DAMAGED" | "DEFECTIVE";
			quantity: number;
		}>;
	}): Promise<StockAdjustmentMutationResult> {
		return this.receiveStock(payload);
	},

	async recordDamage(payload: {
		warehouseId: string;
		productId: string;
		damagedAt?: string;
		reason?: string;
		items: Array<{
			fromCondition: "NEW" | "GOOD";
			toCondition: "DAMAGED" | "DEFECTIVE";
			quantity: number;
		}>;
	}): Promise<StockAdjustmentMutationResult> {
		const response = await apiClient.post<ApiResponse<StockAdjustmentMutationResult>>(
			"/stock-adjustments/damage",
			payload,
		);
		return response.data.data;
	},
};
