import apiClient from "@/lib/api-client";

export type InvoiceDraftStatus = "DRAFT" | "FINALIZED" | "CANCELLED";

export interface InvoiceDraftListItem {
	id: string;
	draftNumber: string;
	draftDate: string;
	dueDate?: string | null;
	status: InvoiceDraftStatus;
	orderId: string;
	storeId: string;
	storeNameSnapshot: string;
	totalAmount: number;
	notes?: string | null;
	cancelReason?: string | null;
	cancelledAt?: string | null;
	finalizedAt?: string | null;
	finalizedInvoiceId?: string | null;
}

export interface InvoiceDraftItem {
	id: string;
	orderItemId?: string | null;
	productId: string;
	productNameSnapshot: string;
	condition: string;
	quantity: number;
	unitPriceSnapshot: number;
	discountAmountSnapshot?: number;
	taxAmountSnapshot?: number;
	subtotal: number;
}

export interface InvoiceDraftDetail extends InvoiceDraftListItem {
	items: InvoiceDraftItem[];
}

export interface FinalizeInvoiceDraftResult {
	draft: InvoiceDraftListItem;
	invoice: {
		id: string;
		invoiceNumber: string;
		status: string;
		orderId: string;
		dueDate?: string | null;
	};
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

export const invoiceDraftsService = {
	async list(params?: {
		page?: number;
		limit?: number;
		sortBy?: "draftDate" | "status" | "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
		status?: InvoiceDraftStatus;
		search?: string;
		storeId?: string;
		orderId?: string;
		dateFrom?: string;
		dateTo?: string;
	}): Promise<{ items: InvoiceDraftListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<InvoiceDraftListItem>>(
			"/invoice-drafts",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async getByOrderId(orderId: string): Promise<InvoiceDraftListItem> {
		const response = await apiClient.get<ApiResponse<InvoiceDraftListItem>>(
			`/invoice-drafts/by-order/${orderId}`,
		);
		return response.data.data;
	},

	async getById(id: string): Promise<InvoiceDraftDetail> {
		const response = await apiClient.get<ApiResponse<InvoiceDraftDetail>>(`/invoice-drafts/${id}`);
		return response.data.data;
	},

	async createFromOrder(
		orderId: string,
		payload?: { draftDate?: string; dueDate?: string; notes?: string },
	): Promise<InvoiceDraftListItem> {
		const response = await apiClient.post<ApiResponse<InvoiceDraftListItem>>(
			`/invoice-drafts/from-order/${orderId}`,
			payload ?? {},
		);
		return response.data.data;
	},

	async finalize(
		id: string,
		payload?: { invoiceDate?: string; dueDate?: string; notes?: string },
	): Promise<FinalizeInvoiceDraftResult> {
		const response = await apiClient.post<ApiResponse<FinalizeInvoiceDraftResult>>(
			`/invoice-drafts/${id}/finalize`,
			payload ?? {},
		);
		return response.data.data;
	},

	async update(
		id: string,
		payload: {
			dueDate?: string;
			notes?: string;
			items?: Array<{
				id: string;
				quantity: number;
				unitPriceSnapshot: number;
				discountAmountSnapshot?: number;
				taxAmountSnapshot?: number;
			}>;
		},
	): Promise<InvoiceDraftDetail> {
		const response = await apiClient.patch<ApiResponse<InvoiceDraftDetail>>(
			`/invoice-drafts/${id}`,
			payload,
		);
		return response.data.data;
	},

	async cancel(id: string, cancelReason: string): Promise<InvoiceDraftListItem> {
		const response = await apiClient.patch<ApiResponse<InvoiceDraftListItem>>(
			`/invoice-drafts/${id}/cancel`,
			{ cancelReason },
		);
		return response.data.data;
	},
};
