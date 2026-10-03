import apiClient, { withIdempotencyKey } from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export type PaymentStatus = "PENDING" | "VERIFIED" | "CANCELLED";
export type PaymentMethod = "CASH" | "TRANSFER";
export type PaymentSubmissionSource =
	| "STORE_SELF"
	| "SALES_REPRESENTED"
	| "INTERNAL_BACKOFFICE";
export type PaymentVerificationTarget = "SALES" | "ACCOUNTANT" | "AUTO";

export interface Payment {
	paymentNumber?: string;
	id: string;
	invoiceId: string;
	storeId: string;
	amount: number;
	method: PaymentMethod;
	status: PaymentStatus;
	submissionSource?: PaymentSubmissionSource;
	verificationTarget?: PaymentVerificationTarget;
	paymentDate: string;
	referenceNo?: string | null;
	referenceNumber?: string | null;
	proofUrl?: string | null;
	proofFileName?: string | null;
	proofMimeType?: string | null;
	proofNotes?: string | null;
	notes?: string | null;
	verifiedAt?: string | null;
	cancelledAt?: string | null;
	cancelReason?: string | null;
	createdAt?: string;
	updatedAt?: string;
	invoice?: {
		id: string;
		invoiceNumber: string;
		storeNameSnapshot?: string;
		totalAmount: number;
		remainingAmount: number;
		status: string;
	};
}

export interface CreatePaymentPayload {
	invoiceId: string;
	amount: number;
	method: PaymentMethod;
	paymentDate?: string;
	referenceNo?: string;
	referenceNumber?: string;
	proofUrl?: string;
	proofFileName?: string;
	proofMimeType?: string;
	proofNotes?: string;
	notes?: string;
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

export interface PaymentFilterParams {
	status?: PaymentStatus;
	method?: PaymentMethod;
	invoiceId?: string;
	storeId?: string;
	/** Batas `paymentDate`, ISO datetime (bukan `YYYY-MM-DD`). */
	dateFrom?: string;
	dateTo?: string;
	search?: string;
	/** Antrean akuntan: target ACCOUNTANT, atau tanpa target dan bukan tunai. */
	verificationTarget?: "ACCOUNTANT";
}

export interface PaymentSummary {
	count: number;
	totalAmount: number;
	distinctStores: number;
}

export const paymentsService = {
	async list(params?: PaymentFilterParams & {
		page?: number;
		limit?: number;
		sortBy?: "paymentDate" | "status" | "method" | "amount" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
	}): Promise<{ items: Payment[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<Payment>>("/payments", { params });
		return { items: response.data.data, meta: response.data.meta };
	},

	/** Angka headline dengan filter yang sama seperti `list` (tanpa paging); StoreScope di server. */
	async summary(params?: PaymentFilterParams): Promise<PaymentSummary> {
		const response = await apiClient.get<ApiResponse<PaymentSummary>>("/payments/summary", { params });
		return response.data.data;
	},

	async listForToko(params?: {
		page?: number;
		limit?: number;
		sortBy?: "paymentDate" | "status" | "method" | "amount" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: PaymentStatus;
		method?: PaymentMethod;
		invoiceId?: string;
		dateFrom?: string;
		dateTo?: string;
		search?: string;
	}): Promise<{ items: Payment[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<Payment>>("/payments", { params });
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAllForToko(params?: {
		sortBy?: "paymentDate" | "status" | "method" | "amount" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: PaymentStatus;
		method?: PaymentMethod;
		invoiceId?: string;
		dateFrom?: string;
		dateTo?: string;
		search?: string;
	}): Promise<Payment[]> {
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

	async create(payload: CreatePaymentPayload, idempotencyKey: string): Promise<Payment> {
		const body = { ...payload, referenceNo: payload.referenceNo ?? payload.referenceNumber };
		delete (body as { referenceNumber?: string }).referenceNumber;
		const response = await apiClient.post<ApiResponse<Payment>>("/payments", body, withIdempotencyKey(idempotencyKey));
		return response.data.data;
	},

	async createForToko(payload: CreatePaymentPayload, idempotencyKey: string): Promise<Payment> {
		const body = { ...payload, referenceNo: payload.referenceNo ?? payload.referenceNumber };
		delete (body as { referenceNumber?: string }).referenceNumber;
		const response = await apiClient.post<ApiResponse<Payment>>("/payments", body, withIdempotencyKey(idempotencyKey));
		return response.data.data;
	},

	async verify(paymentId: string): Promise<Payment> {
		const response = await apiClient.patch<ApiResponse<Payment>>(`/payments/${paymentId}/verify`);
		return response.data.data;
	},

	async listForSales(params?: {
		page?: number;
		limit?: number;
		sortBy?: "paymentDate" | "status" | "method" | "amount" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: PaymentStatus;
		method?: PaymentMethod;
		invoiceId?: string;
		storeId?: string;
		dateFrom?: string;
		dateTo?: string;
		search?: string;
	}): Promise<{ items: Payment[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<Payment>>("/payments", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAllForSales(params?: {
		sortBy?: "paymentDate" | "status" | "method" | "amount" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: PaymentStatus;
		method?: PaymentMethod;
		invoiceId?: string;
		storeId?: string;
		dateFrom?: string;
		dateTo?: string;
		search?: string;
	}): Promise<Payment[]> {
		return collectPaginatedItems(
			(page, limit) =>
				this.listForSales({
					...(params || {}),
					page,
					limit,
				}),
			100,
		);
	},

	async createForSales(payload: CreatePaymentPayload, idempotencyKey: string): Promise<Payment> {
		const body = { ...payload, referenceNo: payload.referenceNo ?? payload.referenceNumber };
		delete (body as { referenceNumber?: string }).referenceNumber;
		const response = await apiClient.post<ApiResponse<Payment>>("/payments", body, withIdempotencyKey(idempotencyKey));
		return response.data.data;
	},

	async verifyForSales(paymentId: string): Promise<Payment> {
		const response = await apiClient.patch<ApiResponse<Payment>>(`/payments/${paymentId}/verify`);
		return response.data.data;
	},

	async cancel(paymentId: string, cancelReason: string): Promise<Payment> {
		const response = await apiClient.patch<ApiResponse<Payment>>(
			`/payments/${paymentId}/cancel`,
			{ cancelReason },
		);
		return response.data.data;
	},
};
