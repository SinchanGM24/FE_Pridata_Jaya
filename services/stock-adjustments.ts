import apiClient from "@/lib/api-client";
import type { ProductCondition, WarehouseInventoryItem } from "@/services/warehouse-inventory";
import { collectPaginatedItems } from "@/services/pagination";

export type StockAdjustmentType = "RECEIPT" | "DAMAGE" | "CORRECTION" | "OUTBOUND" | "TRANSFER";

export interface StockAdjustmentRecordItem {
	id: string;
	quantity: number;
	condition?: ProductCondition | null;
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
	deliveryOrderShipment?: {
		id: string;
		shippedAt: string;
		driverName?: string | null;
		notes?: string | null;
		deliveryOrder?: {
			id: string;
			deliveryOrderNumber: string;
			storeNameSnapshot?: string | null;
		} | null;
		items?: Array<{
			id: string;
			quantity: number;
			deliveryOrderItem?: {
				id: string;
				condition?: ProductCondition | null;
				product?: {
					id: string;
					name: string;
					sku?: string | null;
					category?: { id: string; name: string } | null;
					brand?: { id: string; name: string } | null;
				} | null;
			} | null;
		}>;
	} | null;
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

interface StockAdjustmentListParams {
	page?: number;
	limit?: number;
	/** Satu tipe atau daftar dipisah koma, mis. "RECEIPT,OUTBOUND". */
	type?: string;
	warehouseId?: string;
	productId?: string;
	condition?: "GOOD" | "DAMAGED";
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface ReceiptBatchItem {
	recordId: string;
	productId: string;
	productName: string;
	/** `toCondition ?? fromCondition ?? "-"` dari BE. */
	condition: string;
	quantity: number;
}

export interface ReceiptBatch {
	batchId: string;
	referenceNumber: string | null;
	supplier: string | null;
	warehouseId: string;
	warehouseName: string;
	receivedAt: string;
	note: string;
	items: ReceiptBatchItem[];
	totalItems: number;
	totalDamaged: number;
}

export interface ReceiptBatchesSummary {
	totalDocs: number;
	totalItems: number;
	totalDamaged: number;
	totalUnits: number;
}

export interface ReceiptBatchListParams {
	page?: number;
	limit?: number;
	search?: string;
	warehouseId?: string;
	/** Satu batch saja (deep link). */
	batchId?: string;
}

export const stockAdjustmentsService = {
	async receiptBatches(params?: ReceiptBatchListParams): Promise<{ items: ReceiptBatch[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<ReceiptBatch>>(
			"/stock-adjustments/receipt-batches",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	/** Tanpa `search` supaya angka kartu sama dengan ringkasan lama (semua dokumen). */
	async receiptBatchesSummary(params?: Omit<ReceiptBatchListParams, "page" | "limit">): Promise<ReceiptBatchesSummary> {
		const response = await apiClient.get<ApiResponse<ReceiptBatchesSummary>>(
			"/stock-adjustments/receipt-batches/summary",
			{ params },
		);
		return response.data.data;
	},

	async list(params?: StockAdjustmentListParams): Promise<{ items: StockAdjustmentRecord[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<StockAdjustmentRecord>>(
			"/stock-adjustments",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(
		params?: Omit<StockAdjustmentListParams, "page" | "limit">,
	): Promise<StockAdjustmentRecord[]> {
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

	async receiveStock(payload: {
		warehouseId: string;
		productId: string;
		receivedAt?: string;
		reason?: string;
		items: Array<{
			condition: "GOOD" | "DAMAGED";
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
			condition: "GOOD" | "DAMAGED";
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
			fromCondition: "GOOD";
			toCondition: "DAMAGED";
			quantity: number;
		}>;
	}): Promise<StockAdjustmentMutationResult> {
		const response = await apiClient.post<ApiResponse<StockAdjustmentMutationResult>>(
			"/stock-adjustments/damage",
			payload,
		);
		return response.data.data;
	},

	async updateReceipt(
		id: string,
		payload: {
			transactionDate?: string;
			reason?: string;
			items: Array<{
				condition: "GOOD" | "DAMAGED";
				quantity: number;
			}>;
		},
	): Promise<StockAdjustmentMutationResult> {
		const response = await apiClient.put<ApiResponse<StockAdjustmentMutationResult>>(
			`/stock-adjustments/${id}`,
			{
				type: "RECEIPT",
				transactionDate: payload.transactionDate,
				reason: payload.reason,
				items: payload.items,
			},
		);
		return response.data.data;
	},
};
