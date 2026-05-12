import apiClient from "@/lib/api-client";

export type DeliveryOrderStatus =
	| "OPEN"
	| "PICKING"
	| "PACKING"
	| "READY_TO_SHIP"
	| "PARTIALLY_SHIPPED"
	| "SHIPPED"
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
	cancelReason?: string | null;
	cancelledAt?: string | null;
	items: Array<{
		id: string;
		productId: string;
		condition: "NEW" | "GOOD" | "DAMAGED" | "DEFECTIVE";
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

export const deliveryOrdersService = {
	async list(params?: {
		page?: number;
		limit?: number;
		status?: DeliveryOrderStatus;
		storeId?: string;
		sourceWarehouseId?: string;
	}): Promise<{ items: DeliveryOrderListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<DeliveryOrderListItem>>(
			"/delivery-orders",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async getByInvoiceId(invoiceId: string): Promise<DeliveryOrderListItem> {
		const response = await apiClient.get<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/by-invoice/${invoiceId}`,
		);
		return response.data.data;
	},

	async createFromInvoice(
		invoiceId: string,
		payload?: { documentDate?: string; notes?: string },
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.post<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/from-invoice/${invoiceId}`,
			payload ?? {},
		);
		return response.data.data;
	},

	async pick(
		id: string,
		items: Array<{ productId: string; condition: "NEW" | "GOOD"; quantity: number }>,
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.post<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/${id}/picking`,
			{ items },
		);
		return response.data.data;
	},

	async pack(
		id: string,
		items: Array<{ productId: string; condition: "NEW" | "GOOD"; quantity: number }>,
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
			notes?: string;
			items: Array<{ productId: string; condition: "NEW" | "GOOD"; quantity: number }>;
		},
	): Promise<DeliveryOrderListItem> {
		const response = await apiClient.post<ApiResponse<DeliveryOrderListItem>>(
			`/delivery-orders/${id}/shipments`,
			payload,
		);
		return response.data.data;
	},
};
