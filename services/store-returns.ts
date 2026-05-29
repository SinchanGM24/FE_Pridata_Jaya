import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export type StoreReturnActorMode = "TOKO" | "SALES";
export type StoreReturnItemCondition = "GOOD" | "DAMAGED";
export type StoreReturnStatus =
	| "PENDING"
	| "APPROVED_GOOD"
	| "APPROVED_DAMAGED"
	| "REJECTED";

export interface StoreReturnItem {
	id: string;
	productId: string;
	productNameSnapshot: string;
	quantity: number;
	requestedCondition: StoreReturnItemCondition;
	unitPriceSnapshot: number;
	subtotal: number;
	product?: {
		id: string;
		name: string;
	};
}

export interface StoreReturnRequestItem {
	id: string;
	requestNumber: string;
	storeId: string;
	orderId: string;
	invoiceId: string;
	sourceWarehouseId: string;
	actorMode: StoreReturnActorMode;
	status: StoreReturnStatus;
	approvedCondition?: StoreReturnItemCondition | null;
	reason: string;
	note?: string | null;
	submittedAt: string;
	reviewedAt?: string | null;
	reviewNote?: string | null;
	receivableAdjustmentAmount: number;
	store?: {
		id: string;
		name: string;
	};
	invoice?: {
		id: string;
		invoiceNumber: string;
		status: string;
		totalAmount: number;
		paidAmount: number;
		remainingAmount: number;
		deliveryOrder?: {
			id: string;
			status: string;
			receivedAt?: string | null;
			shipments?: Array<{
				shippedAt: string;
			}>;
		} | null;
	};
	sourceWarehouse?: {
		id: string;
		name: string;
	};
	items: StoreReturnItem[];
}

export interface ParsedStoreReturnReason {
	meta: {
		requestNumber: string;
		storeName: string;
		orderId: string;
		orderNumber: string;
		status: StoreReturnStatus;
		submittedAt: string;
		verificationNote?: string;
	};
	note: string;
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

export interface StoreReturnListParams {
	page?: number;
	limit?: number;
	sortBy?: "submittedAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
	status?: StoreReturnStatus;
	storeId?: string;
	invoiceId?: string;
	sourceWarehouseId?: string;
	actorMode?: StoreReturnActorMode;
}

export interface TokoStoreReturnListParams {
	page?: number;
	limit?: number;
	sortBy?: "submittedAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
	status?: StoreReturnStatus;
	invoiceId?: string;
	sourceWarehouseId?: string;
	actorMode?: StoreReturnActorMode;
}

const STORE_RETURN_PREFIX = "[STORE_RETURN]";

export const isReturnEligibleWithin24Hours = (referenceDate?: string | null) => {
	const timestamp = new Date(String(referenceDate || "")).getTime();
	if (Number.isNaN(timestamp)) {
		return false;
	}

	return Date.now() - timestamp <= 24 * 60 * 60 * 1000;
};

export const buildReturnReferenceDate = (request: StoreReturnRequestItem) =>
	request.invoice?.deliveryOrder?.receivedAt || request.submittedAt;

export const parseStoreReturnReason = (reason?: string | null): ParsedStoreReturnReason | null => {
	const raw = String(reason || "").trim();
	if (!raw.startsWith(STORE_RETURN_PREFIX)) {
		return null;
	}

	const payloadStart = STORE_RETURN_PREFIX.length;
	const payloadEnd = raw.indexOf("}", payloadStart);
	if (payloadEnd === -1) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw.slice(payloadStart, payloadEnd + 1)) as Record<string, unknown>;
		if (
			typeof parsed.requestNumber !== "string" ||
			typeof parsed.storeName !== "string" ||
			typeof parsed.orderId !== "string" ||
			typeof parsed.orderNumber !== "string" ||
			typeof parsed.status !== "string" ||
			typeof parsed.submittedAt !== "string"
		) {
			return null;
		}

		return {
			meta: {
				requestNumber: parsed.requestNumber,
				storeName: parsed.storeName,
				orderId: parsed.orderId,
				orderNumber: parsed.orderNumber,
				status: parsed.status as StoreReturnStatus,
				submittedAt: parsed.submittedAt,
				verificationNote:
					typeof parsed.verificationNote === "string" ? parsed.verificationNote : undefined,
			},
			note: raw.slice(payloadEnd + 1).trim(),
		};
	} catch {
		return null;
	}
};

export const storeReturnsService = {
	async list(params?: StoreReturnListParams): Promise<{ items: StoreReturnRequestItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<StoreReturnRequestItem>>(
			"/store-returns",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(
		params?: Omit<StoreReturnListParams, "page" | "limit">,
	): Promise<StoreReturnRequestItem[]> {
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

	async listForToko(params?: TokoStoreReturnListParams): Promise<{ items: StoreReturnRequestItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<StoreReturnRequestItem>>(
			"/toko/returns",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAllForToko(
		params?: Omit<TokoStoreReturnListParams, "page" | "limit">,
	): Promise<StoreReturnRequestItem[]> {
		return collectPaginatedItems(
			(page, limit) =>
				this.listForToko({
					...(params || {}),
					page,
					limit,
				}),
			100,
		);
	},

	async createForToko(payload: {
		invoiceId: string;
		reason: string;
		note?: string;
		items: Array<{
			productId: string;
			quantity: number;
			requestedCondition: StoreReturnItemCondition;
		}>;
	}): Promise<StoreReturnRequestItem> {
		const response = await apiClient.post<ApiResponse<StoreReturnRequestItem>>(
			"/toko/returns",
			{
				...payload,
				actorMode: "TOKO",
			},
		);
		return response.data.data;
	},

	async review(
		id: string,
		payload: {
			decision: Exclude<StoreReturnStatus, "PENDING">;
			reviewNote?: string;
		},
	): Promise<StoreReturnRequestItem> {
		const response = await apiClient.patch<ApiResponse<StoreReturnRequestItem>>(
			`/store-returns/${id}/review`,
			payload,
		);
		return response.data.data;
	},
};
