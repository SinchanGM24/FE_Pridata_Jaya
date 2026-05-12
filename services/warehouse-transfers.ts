import apiClient from "@/lib/api-client";
import type { ProductCondition } from "@/services/warehouse-inventory";

export type TransferStatus = "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";

export interface WarehouseTransferDetail {
	id: string;
	productId: string;
	condition: ProductCondition;
	quantity: number;
	product?: {
		id: string;
		name: string;
		sku?: string | null;
		category?: { id: string; name: string } | null;
		brand?: { id: string; name: string } | null;
	};
}

export interface WarehouseTransferItem {
	id: string;
	transferDate: string;
	sourceWarehouseId: string;
	destinationWarehouseId: string;
	status: TransferStatus;
	notes?: string | null;
	createdAt?: string;
	updatedAt?: string;
	sourceWarehouse?: {
		id: string;
		name: string;
		city?: { id: string; name: string; province?: string } | null;
	};
	destinationWarehouse?: {
		id: string;
		name: string;
		city?: { id: string; name: string; province?: string } | null;
	};
	details: WarehouseTransferDetail[];
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

export interface CreateWarehouseTransferPayload {
	transferDate?: string;
	sourceWarehouseId: string;
	destinationWarehouseId: string;
	notes?: string;
	details: Array<{
		productId: string;
		condition: ProductCondition;
		quantity: number;
	}>;
}

export const warehouseTransfersService = {
	async list(params?: {
		page?: number;
		limit?: number;
		status?: TransferStatus;
		sourceWarehouseId?: string;
		destinationWarehouseId?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<{ items: WarehouseTransferItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<WarehouseTransferItem>>(
			"/warehouse-transfers",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async create(payload: CreateWarehouseTransferPayload): Promise<WarehouseTransferItem> {
		const response = await apiClient.post<ApiResponse<WarehouseTransferItem>>(
			"/warehouse-transfers",
			payload,
		);
		return response.data.data;
	},

	async updateStatus(id: string, status: Exclude<TransferStatus, "PENDING">) {
		const response = await apiClient.patch<ApiResponse<WarehouseTransferItem>>(
			`/warehouse-transfers/${id}/status`,
			{ status },
		);
		return response.data.data;
	},
};
