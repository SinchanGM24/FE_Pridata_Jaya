import apiClient from "@/lib/api-client";
import type { ProductCondition } from "@/services/warehouse-inventory";

export type { ProductCondition } from "@/services/warehouse-inventory";

export type ReturnStatus =
	| "REQUESTED"
	| "RECEIVED_BY_WAREHOUSE"
	| "UNDER_ACCOUNTING_REVIEW"
	| "CREDITED"
	| "REJECTED"
	| "CANCELLED"
	| (string & {});

export type ReturnSortBy = "requestedAt" | "status" | "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

export interface ReturnProductSummary {
	id: string;
	name?: string | null;
	sku?: string | null;
	category?: { id: string; name: string } | null;
	brand?: { id: string; name: string } | null;
}

export interface ReturnStoreSummary {
	id: string;
	name?: string | null;
	storeName?: string | null;
	code?: string | null;
	address?: string | null;
}

export interface ReturnInvoiceSummary {
	id: string;
	invoiceNumber?: string | null;
	totalAmount?: number | null;
	issuedAt?: string | null;
	createdAt?: string | null;
}

export interface ReturnItem {
	id: string;
	returnId?: string | null;
	invoiceItemId?: string | null;
	productId?: string | null;
	product?: ReturnProductSummary | null;
	requestedQuantity: number;
	receivedQuantity?: number | null;
	creditedQuantity?: number | null;
	condition?: ProductCondition | null;
	reason?: string | null;
	warehouseNotes?: string | null;
	accountingNotes?: string | null;
	creditedUnitPrice?: number | null;
	creditedAmount?: number | null;
}

export interface ReturnListItem {
	id: string;
	returnNumber: string;
	invoiceId: string;
	storeId: string;
	status: ReturnStatus;
	reason?: string | null;
	notes?: string | null;
	requestedAmount?: number | null;
	creditedAmount?: number | null;
	requestedAt?: string | null;
	receivedAt?: string | null;
	creditedAt?: string | null;
	createdAt?: string;
	updatedAt?: string;
	store?: ReturnStoreSummary | null;
	invoice?: ReturnInvoiceSummary | null;
	items?: ReturnItem[];
}

export interface ReturnDetail extends ReturnListItem {
	items: ReturnItem[];
}

export interface CreateReturnPayload {
	invoiceId: string;
	reason?: string;
	notes?: string;
	items: Array<{
		invoiceItemId: string;
		requestedQuantity: number;
		condition: ProductCondition;
		reason?: string;
	}>;
}

export interface ReceiveReturnPayload {
	warehouseId: string;
	warehouseNotes?: string;
	items: Array<{
		returnItemId: string;
		receivedQuantity: number;
		condition: ProductCondition;
		warehouseNotes?: string;
	}>;
}

export interface CreditReturnPayload {
	accountingNotes?: string;
	items: Array<{
		returnItemId: string;
		creditedQuantity: number;
		creditedUnitPrice: number;
		accountingNotes?: string;
	}>;
}

export interface RejectReturnPayload {
	rejectionReason: string;
}

export interface CancelReturnPayload {
	cancelReason: string;
}

export interface ReturnsListParams {
	page?: number;
	limit?: number;
	sortBy?: ReturnSortBy;
	sortOrder?: SortOrder;
	status?: ReturnStatus;
	invoiceId?: string;
	storeId?: string;
	dateFrom?: string;
	dateTo?: string;
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

export const returnsService = {
	async list(params?: ReturnsListParams): Promise<{ items: ReturnListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<ReturnListItem>>("/returns", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async create(payload: CreateReturnPayload): Promise<ReturnDetail> {
		const response = await apiClient.post<ApiResponse<ReturnDetail>>("/returns", payload);
		return response.data.data;
	},

	async getById(returnId: string): Promise<ReturnDetail> {
		const response = await apiClient.get<ApiResponse<ReturnDetail>>(`/returns/${returnId}`);
		return response.data.data;
	},

	async receive(returnId: string, payload: ReceiveReturnPayload): Promise<ReturnDetail> {
		const response = await apiClient.patch<ApiResponse<ReturnDetail>>(
			`/returns/${returnId}/receive`,
			payload,
		);
		return response.data.data;
	},

	async startAccountingReview(returnId: string): Promise<ReturnDetail> {
		const response = await apiClient.patch<ApiResponse<ReturnDetail>>(
			`/returns/${returnId}/start-accounting-review`,
		);
		return response.data.data;
	},

	async credit(returnId: string, payload: CreditReturnPayload): Promise<ReturnDetail> {
		const response = await apiClient.patch<ApiResponse<ReturnDetail>>(
			`/returns/${returnId}/credit`,
			payload,
		);
		return response.data.data;
	},

	async reject(returnId: string, payload: RejectReturnPayload): Promise<ReturnDetail> {
		const response = await apiClient.patch<ApiResponse<ReturnDetail>>(
			`/returns/${returnId}/reject`,
			payload,
		);
		return response.data.data;
	},

	async cancel(returnId: string, payload: CancelReturnPayload): Promise<ReturnDetail> {
		const response = await apiClient.patch<ApiResponse<ReturnDetail>>(
			`/returns/${returnId}/cancel`,
			payload,
		);
		return response.data.data;
	},
};
