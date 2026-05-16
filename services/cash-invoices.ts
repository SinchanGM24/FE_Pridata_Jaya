import apiClient from "@/lib/api-client";
import type { PaymentRequestItem } from "@/services/payment-requests";

export type CashInvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED" | (string & {});
export type CashInvoiceSortBy = "invoiceDate" | "dueDate" | "totalAmount" | "remainingAmount" | "status";
export type SortOrder = "asc" | "desc";

export interface CashInvoiceItem {
	id: string;
	invoiceNumber: string;
	invoiceDate: string;
	dueDate: string;
	status: CashInvoiceStatus;
	orderId?: string | null;
	storeId: string;
	storeNameSnapshot?: string | null;
	totalAmount: number;
	paidAmount?: number | null;
	remainingAmount: number;
	notes?: string | null;
	createdAt?: string;
	updatedAt?: string;
	paymentRequests?: PaymentRequestItem[];
}

export type CashInvoiceDetail = CashInvoiceItem;

export interface CashInvoicesListParams {
	page?: number;
	limit?: number;
	sortBy?: CashInvoiceSortBy;
	sortOrder?: SortOrder;
	status?: CashInvoiceStatus;
	storeId?: string;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
}

export interface CreateCashInvoicePaymentRequestPayload {
	amount: number;
	paymentDate?: string;
	referenceNo?: string;
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

export const cashInvoicesService = {
	async list(params?: CashInvoicesListParams): Promise<{ items: CashInvoiceItem[]; meta: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<CashInvoiceItem>>("/cash-invoices", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async getById(invoiceId: string): Promise<CashInvoiceDetail> {
		const response = await apiClient.get<ApiResponse<CashInvoiceDetail>>(
			`/cash-invoices/${invoiceId}`,
		);
		return response.data.data;
	},

	async createPaymentRequest(
		invoiceId: string,
		payload: CreateCashInvoicePaymentRequestPayload,
	): Promise<PaymentRequestItem> {
		const response = await apiClient.post<ApiResponse<PaymentRequestItem>>(
			`/cash-invoices/${invoiceId}/payment-requests`,
			payload,
		);
		return response.data.data;
	},
};
