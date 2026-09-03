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
	receivedQuantity?: number;
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
	search?: string;
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

export const isReturnEligibleWithin24Hours = (referenceDate?: string | null) => {
	const timestamp = new Date(String(referenceDate || "")).getTime();
	if (Number.isNaN(timestamp)) {
		return false;
	}

	return Date.now() - timestamp <= 24 * 60 * 60 * 1000;
};

export const buildReturnReferenceDate = (request: StoreReturnRequestItem) =>
	request.invoice?.deliveryOrder?.receivedAt || request.submittedAt;

/**
 * The canonical `SalesReturn` record as the backend returns it.
 */
interface SalesReturnRecord {
	id: string;
	returnNumber: string;
	invoiceId: string;
	storeId: string;
	status: string;
	reason?: string | null;
	notes?: string | null;
	requestedAt: string;
	receivedAt?: string | null;
	accountingReviewAt?: string | null;
	rejectedAt?: string | null;
	warehouseNotes?: string | null;
	rejectionReason?: string | null;
	creditedAmount: number;
	store?: { id: string; name: string };
	invoice?: {
		id: string;
		invoiceNumber: string;
		status: string;
		totalAmount: number;
		paidAmount: number;
		remainingAmount: number;
		orderId: string;
		order?: { sourceWarehouse?: { id: string; name: string } | null };
		deliveryOrder?: {
			id: string;
			status: string;
			receivedAt?: string | null;
			shipments?: Array<{ shippedAt: string }>;
		} | null;
	};
	items: Array<{
		id: string;
		productId: string;
		requestedQuantity: number;
		receivedQuantity: number;
		requestedCondition: StoreReturnItemCondition;
		approvedCondition?: StoreReturnItemCondition | null;
		requestedUnitPrice: number;
		invoiceItem?: { productNameSnapshot: string };
		product?: { id: string; name: string };
	}>;
}

/**
 * The workspaces speak a flatter, four-state vocabulary than the backend's
 * lifecycle. That translation is a UI concern, so it lives here rather than in a
 * backend response shape built for one client.
 */
const toStoreReturnStatus = (record: SalesReturnRecord): StoreReturnStatus => {
	if (record.status === "REJECTED" || record.status === "CANCELLED") return "REJECTED";
	if (record.status === "REQUESTED") return "PENDING";

	const anyDamagedAccepted = record.items.some(
		(item) => item.receivedQuantity > 0 && item.approvedCondition === "DAMAGED",
	);
	return anyDamagedAccepted ? "APPROVED_DAMAGED" : "APPROVED_GOOD";
};

export const toStoreReturnRequest = (record: SalesReturnRecord): StoreReturnRequestItem => {
	const status = toStoreReturnStatus(record);
	const sourceWarehouse = record.invoice?.order?.sourceWarehouse ?? undefined;

	return {
		id: record.id,
		requestNumber: record.returnNumber,
		storeId: record.storeId,
		orderId: record.invoice?.orderId ?? "",
		invoiceId: record.invoiceId,
		sourceWarehouseId: sourceWarehouse?.id ?? "",
		actorMode: "TOKO",
		status,
		approvedCondition:
			status === "APPROVED_DAMAGED" ? "DAMAGED" : status === "APPROVED_GOOD" ? "GOOD" : null,
		reason: record.reason ?? "",
		note: record.notes ?? null,
		submittedAt: record.requestedAt,
		reviewedAt: record.accountingReviewAt ?? record.receivedAt ?? record.rejectedAt ?? null,
		reviewNote: record.warehouseNotes ?? record.rejectionReason ?? null,
		receivableAdjustmentAmount: record.creditedAmount,
		store: record.store,
		invoice: record.invoice
			? {
					id: record.invoice.id,
					invoiceNumber: record.invoice.invoiceNumber,
					status: record.invoice.status,
					totalAmount: record.invoice.totalAmount,
					paidAmount: record.invoice.paidAmount,
					remainingAmount: record.invoice.remainingAmount,
					deliveryOrder: record.invoice.deliveryOrder ?? null,
				}
			: undefined,
		sourceWarehouse,
		items: record.items.map((item) => ({
			id: item.id,
			productId: item.productId,
			productNameSnapshot: item.invoiceItem?.productNameSnapshot ?? item.product?.name ?? "-",
			quantity: item.requestedQuantity,
			receivedQuantity: item.receivedQuantity,
			requestedCondition: item.requestedCondition,
			unitPriceSnapshot: item.requestedUnitPrice,
			subtotal: item.requestedQuantity * item.requestedUnitPrice,
			product: item.product,
		})),
	};
};

/** The backend speaks the lifecycle vocabulary; the UI filter speaks the flat one. */
const toBackendStatus = (status?: StoreReturnStatus): string | undefined => {
	if (!status) return undefined;
	if (status === "PENDING") return "REQUESTED";
	if (status === "REJECTED") return "REJECTED";
	return "ACCOUNTING_REVIEW";
};

const toBackendQuery = (params?: StoreReturnListParams) => {
	const { status, sortBy, ...rest } = params ?? {};
	return {
		...rest,
		status: toBackendStatus(status),
		sortBy: sortBy === "submittedAt" ? "requestedAt" : sortBy,
	};
};

export const storeReturnsService = {
	// One canonical collection for every actor: the backend narrows the rows by the
	// caller's organization role, so there is no per-actor path any more.
	async list(params?: StoreReturnListParams): Promise<{ items: StoreReturnRequestItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<SalesReturnRecord>>("/returns", {
			params: toBackendQuery(params),
		});
		return { items: response.data.data.map(toStoreReturnRequest), meta: response.data.meta };
	},

	async listAll(
		params?: Omit<StoreReturnListParams, "page" | "limit">,
	): Promise<StoreReturnRequestItem[]> {
		return collectPaginatedItems(
			(page, limit) => this.list({ ...(params || {}), page, limit }),
			100,
		);
	},

	async listForSales(
		params: TokoStoreReturnListParams & { storeId: string },
	): Promise<{ items: StoreReturnRequestItem[]; meta?: PaginationMeta }> {
		return this.list(params);
	},

	async listAllForSales(
		params: Omit<TokoStoreReturnListParams, "page" | "limit"> & { storeId: string },
	): Promise<StoreReturnRequestItem[]> {
		return collectPaginatedItems(
			(page, limit) => this.listForSales({ ...params, page, limit }),
			100,
		);
	},

	async listForToko(params?: TokoStoreReturnListParams): Promise<{ items: StoreReturnRequestItem[]; meta?: PaginationMeta }> {
		return this.list(params);
	},

	async listAllForToko(
		params?: Omit<TokoStoreReturnListParams, "page" | "limit">,
	): Promise<StoreReturnRequestItem[]> {
		return collectPaginatedItems(
			(page, limit) => this.listForToko({ ...(params || {}), page, limit }),
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
		const response = await apiClient.post<ApiResponse<SalesReturnRecord>>("/returns", payload);
		return toStoreReturnRequest(response.data.data);
	},

	async createForSales(payload: {
		storeId: string;
		invoiceId: string;
		reason: string;
		note?: string;
		items: Array<{
			productId: string;
			quantity: number;
			requestedCondition: StoreReturnItemCondition;
		}>;
	}): Promise<StoreReturnRequestItem> {
		const response = await apiClient.post<ApiResponse<SalesReturnRecord>>("/returns", payload);
		return toStoreReturnRequest(response.data.data);
	},

	// The warehouse verdict is one transition for the user, so it is one call:
	// accepted quantities per item, or an outright rejection.
	async review(
		id: string,
		payload: {
			decision: Exclude<StoreReturnStatus, "PENDING">;
			reviewNote?: string;
			items?: Array<{
				returnItemId: string;
				receivedQuantity: number;
				approvedCondition: StoreReturnItemCondition;
			}>;
		},
	): Promise<StoreReturnRequestItem> {
		const response = await apiClient.patch<ApiResponse<SalesReturnRecord>>(
			`/returns/${id}/review`,
			payload,
		);
		return toStoreReturnRequest(response.data.data);
	},
};
