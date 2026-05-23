import apiClient from "@/lib/api-client";

export type PaymentRequestStatus =
	| "PENDING"
	| "APPROVED"
	| "REJECTED"
	| "CANCELLED"
	| (string & {});

export type PaymentMethod =
	| "CASH"
	| "TRANSFER"
	| "GIRO"
	| "OTHER"
	| "STORE_CREDIT"
	| (string & {});

export type CreatePaymentRequestMethod = "CASH" | "TRANSFER" | "GIRO" | "OTHER";
export type PaymentRequestSortBy = "createdAt" | "paymentDate" | "amount" | "status";
export type SortOrder = "asc" | "desc";

export interface PaymentRequestInvoiceSummary {
	id: string;
	invoiceNumber?: string | null;
	invoiceDate?: string | null;
	dueDate?: string | null;
	status?: string | null;
	totalAmount?: number | null;
	paidAmount?: number | null;
	remainingAmount?: number | null;
	storeNameSnapshot?: string | null;
}

export interface PaymentRequestStoreSummary {
	id: string;
	name?: string | null;
	storeName?: string | null;
	code?: string | null;
	address?: string | null;
}

export interface PaymentRequestUserSummary {
	id: string;
	name?: string | null;
	fullName?: string | null;
	email?: string | null;
	role?: string | null;
}

export interface PaymentRequestItem {
	id: string;
	requestNumber?: string | null;
	invoiceId: string;
	storeId?: string | null;
	method: PaymentMethod;
	amount: number;
	status: PaymentRequestStatus;
	paymentDate?: string | null;
	referenceNo?: string | null;
	notes?: string | null;
	proofUrl?: string | null;
	proofObjectKey?: string | null;
	submittedByUserId?: string | null;
	submittedByRole?: string | null;
	salesUserId?: string | null;
	isSalesAssisted?: boolean | null;
	reviewNotes?: string | null;
	rejectionReason?: string | null;
	cancelReason?: string | null;
	createdAt?: string;
	updatedAt?: string;
	invoice?: PaymentRequestInvoiceSummary | null;
	store?: PaymentRequestStoreSummary | null;
	submittedBy?: PaymentRequestUserSummary | null;
	reviewer?: PaymentRequestUserSummary | null;
}

export type PaymentRequestDetail = PaymentRequestItem;

export interface PaymentRequestsListParams {
	page?: number;
	limit?: number;
	sortBy?: PaymentRequestSortBy;
	sortOrder?: SortOrder;
	status?: PaymentRequestStatus;
	method?: PaymentMethod;
	invoiceId?: string;
	storeId?: string;
	submittedByUserId?: string;
	submittedByRole?: string;
	salesUserId?: string;
	isSalesAssisted?: boolean;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
}

export interface CreatePaymentRequestPayload {
	invoiceId: string;
	method: CreatePaymentRequestMethod;
	amount: number;
	paymentDate?: string;
	referenceNo?: string;
	notes?: string;
	isSalesAssisted?: boolean;
}

export interface ApprovePaymentRequestPayload {
	reviewNotes?: string;
}

export interface RejectPaymentRequestPayload {
	rejectionReason: string;
}

export interface CancelPaymentRequestPayload {
	cancelReason: string;
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

export const paymentRequestsService = {
	async list(
		params?: PaymentRequestsListParams,
	): Promise<{ items: PaymentRequestItem[]; meta: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<PaymentRequestItem>>(
			"/payment-requests",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async getById(paymentRequestId: string): Promise<PaymentRequestDetail> {
		const response = await apiClient.get<ApiResponse<PaymentRequestDetail>>(
			`/payment-requests/${paymentRequestId}`,
		);
		return response.data.data;
	},

	async create(payload: CreatePaymentRequestPayload): Promise<PaymentRequestDetail> {
		const response = await apiClient.post<ApiResponse<PaymentRequestDetail>>(
			"/payment-requests",
			payload,
		);
		return response.data.data;
	},

	async uploadProof(paymentRequestId: string, file: File): Promise<PaymentRequestDetail> {
		const formData = new FormData();
		formData.append("file", file);

		const response = await apiClient.post<ApiResponse<PaymentRequestDetail>>(
			`/payment-requests/${paymentRequestId}/proof`,
			formData,
		);
		return response.data.data;
	},

	async approve(
		paymentRequestId: string,
		payload: ApprovePaymentRequestPayload = {},
	): Promise<PaymentRequestDetail> {
		const response = await apiClient.patch<ApiResponse<PaymentRequestDetail>>(
			`/payment-requests/${paymentRequestId}/approve`,
			payload,
		);
		return response.data.data;
	},

	async reject(
		paymentRequestId: string,
		payload: RejectPaymentRequestPayload,
	): Promise<PaymentRequestDetail> {
		const response = await apiClient.patch<ApiResponse<PaymentRequestDetail>>(
			`/payment-requests/${paymentRequestId}/reject`,
			payload,
		);
		return response.data.data;
	},

	async cancel(
		paymentRequestId: string,
		payload: CancelPaymentRequestPayload,
	): Promise<PaymentRequestDetail> {
		const response = await apiClient.patch<ApiResponse<PaymentRequestDetail>>(
			`/payment-requests/${paymentRequestId}/cancel`,
			payload,
		);
		return response.data.data;
	},
};
