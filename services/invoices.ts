import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";

export interface InvoiceListItem {
	id: string;
	invoiceNumber: string;
	invoiceDate: string;
	dueDate?: string | null;
	status: InvoiceStatus;
	orderId: string;
	storeId: string;
	storeNameSnapshot: string;
	totalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	notes?: string | null;
	cancelReason?: string | null;
	cancelledAt?: string | null;
	createdAt?: string;
	updatedAt?: string;
	order?: {
		id: string;
		orderNumber: string;
		documentDate: string;
		status: string;
	};
	deliveryOrder?: {
		id: string;
		deliveryOrderNumber: string;
		status:
			| "OPEN"
			| "PICKING"
			| "PACKING"
			| "READY_TO_SHIP"
			| "SHIPPED"
			| "RECEIVED"
			| "CANCELLED";
		receivedAt?: string | null;
		receiptNotes?: string | null;
		shipments?: Array<{
			id: string;
			shippedAt: string;
			notes?: string | null;
		}>;
	} | null;
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

interface InvoiceListParams {
	page?: number;
	limit?: number;
	sortBy?: "invoiceDate" | "status" | "createdAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
	status?: InvoiceStatus;
	search?: string;
	storeId?: string;
	orderId?: string;
	dateFrom?: string;
	dateTo?: string;
}

export const invoicesService = {
	async list(params?: InvoiceListParams): Promise<{ items: InvoiceListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<InvoiceListItem>>("/invoices", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(params?: Omit<InvoiceListParams, "page" | "limit">): Promise<InvoiceListItem[]> {
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

	async listForToko(params?: {
		page?: number;
		limit?: number;
		sortBy?: "invoiceDate" | "status" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: InvoiceStatus;
		search?: string;
		orderId?: string;
		dateFrom?: string;
		dateTo?: string;
	}): Promise<{ items: InvoiceListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<InvoiceListItem>>("/toko/invoices", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAllForToko(params?: {
		sortBy?: "invoiceDate" | "status" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: InvoiceStatus;
		search?: string;
		orderId?: string;
		dateFrom?: string;
		dateTo?: string;
	}): Promise<InvoiceListItem[]> {
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

	async listForSales(params?: {
		page?: number;
		limit?: number;
		sortBy?: "invoiceDate" | "status" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: InvoiceStatus;
		search?: string;
		storeId?: string;
		orderId?: string;
		dateFrom?: string;
		dateTo?: string;
	}): Promise<{ items: InvoiceListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<InvoiceListItem>>("/sales/invoices", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAllForSales(params?: {
		sortBy?: "invoiceDate" | "status" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: InvoiceStatus;
		search?: string;
		storeId?: string;
		orderId?: string;
		dateFrom?: string;
		dateTo?: string;
	}): Promise<InvoiceListItem[]> {
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

	async getByOrderId(orderId: string): Promise<InvoiceListItem> {
		const response = await apiClient.get<ApiResponse<InvoiceListItem>>(
			`/invoices/by-order/${orderId}`,
		);
		return response.data.data;
	},

	async createFromOrder(
		orderId: string,
		payload?: { invoiceDate?: string; dueDate?: string; notes?: string },
	): Promise<InvoiceListItem> {
		const response = await apiClient.post<ApiResponse<InvoiceListItem>>(
			`/invoices/from-order/${orderId}`,
			payload ?? {},
		);
		return response.data.data;
	},

	async cancel(invoiceId: string, cancelReason: string): Promise<InvoiceListItem> {
		const response = await apiClient.patch<ApiResponse<InvoiceListItem>>(
			`/invoices/${invoiceId}/cancel`,
			{ cancelReason },
		);
		return response.data.data;
	},
};
