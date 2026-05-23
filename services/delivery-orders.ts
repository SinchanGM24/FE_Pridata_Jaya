import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export type DeliveryOrderStatus =
	| "OPEN"
	| "PICKING"
	| "PACKING"
	| "READY_TO_SHIP"
	| "PARTIALLY_SHIPPED"
	| "SHIPPED"
	| "RECEIVED"
	| "CANCELLED";

export interface DeliveryOrderListItem {
	id: string;
	deliveryOrderNumber: string;
	documentDate: string;
	status: DeliveryOrderStatus;
	invoiceId?: string | null;
	storeId: string;
	sourceWarehouseId: string;
	storeNameSnapshot: string;
	totalItems?: number;
	notes?: string | null;
	receivedAt?: string | null;
	receiptNotes?: string | null;
	cancelReason?: string | null;
	cancelledAt?: string | null;
	items: Array<{
		id: string;
		productId: string;
		condition: "GOOD" | "DAMAGED";
		orderedQuantity: number;
		pickedQuantity: number;
		packedQuantity: number;
		shippedQuantity: number;
		product?: {
			name: string;
		};
	}>;
	shipments: Array<{
		id: string;
		shippedAt: string;
		driverName?: string | null;
		notes?: string | null;
	}>;
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

interface DeliveryOrderListParams {
	page?: number;
	limit?: number;
	status?: DeliveryOrderStatus;
	storeId?: string;
	sourceWarehouseId?: string;
}

export const deliveryOrdersService = {
	async list(
		params?: DeliveryOrderListParams,
	): Promise<{ items: DeliveryOrderListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<DeliveryOrderListItem>>(
			"/delivery-orders",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(
		params?: Omit<DeliveryOrderListParams, "page" | "limit">,
	): Promise<DeliveryOrderListItem[]> {
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

	async getByInvoiceId(invoiceId: string): Promise<DeliveryOrderListItem> {
		const response = await apiClient.get<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/by-invoice/${invoiceId}`,
		);
		return response.data.data;
	},

	async createFromInvoice(
		invoiceId: string,
		payload?: { documentDate?: string; sourceWarehouseId?: string; notes?: string },
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.post<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/from-invoice/${invoiceId}`,
			payload ?? {},
		);
		return response.data.data;
	},

	async pick(
		id: string,
		items: Array<{ productId: string; condition: "GOOD"; quantity: number }>,
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.post<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/${id}/picking`,
			{ items },
		);
		return response.data.data;
	},

	async pack(
		id: string,
		items: Array<{ productId: string; condition: "GOOD"; quantity: number }>,
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.post<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/${id}/packing`,
			{ items },
		);
		return response.data.data;
	},

	async ship(
		id: string,
		payload: {
			shippedAt?: string;
			driverName: string;
			notes?: string;
			items: Array<{ productId: string; condition: "GOOD"; quantity: number }>;
		},
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.post<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/${id}/shipments`,
			payload,
		);
		return response.data.data;
	},

	async getByInvoiceIdForToko(invoiceId: string): Promise<DeliveryOrderListItem> {
		const response = await apiClient.get<ApiResponse<DeliveryOrderListItem>>(
			`/toko/delivery-orders/by-invoice/${invoiceId}`,
		);
		return response.data.data;
	},

	async confirmReceiptForToko(
		id: string,
		payload?: { receivedAt?: string; receiptNotes?: string },
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.patch<ApiResponse<DeliveryOrderListItem>>(
			`/toko/delivery-orders/${id}/receive`,
			payload ?? {},
		);
		return response.data.data;
	},
};
