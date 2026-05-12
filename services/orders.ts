import apiClient from "@/lib/api-client";

export type OrderStatus = "PENDING" | "PROCESSED" | "CANCELLED";

export interface OrderItem {
	id: string;
	productId: string;
	condition: string;
	quantity: number;
	unitPriceSnapshot: number;
	subtotal: number;
	product?: { id: string; name: string; sku?: string | null };
}

export interface OrderListItem {
	id: string;
	orderNumber: string;
	status: OrderStatus;
	storeId: string;
	storeNameSnapshot: string;
	documentDate: string;
	totalAmount: number;
	notes?: string | null;
	processedAt?: string | null;
	cancelledAt?: string | null;
	cancelReason?: string | null;
	createdAt?: string;
	updatedAt?: string;
	items?: OrderItem[];
}

export interface CreateOrderPayload {
	storeId: string;
	sourceWarehouseId: string;
	documentDate?: string;
	notes?: string;
	items: Array<{
		productId: string;
		condition: string;
		quantity: number;
		unitPriceSnapshot: number;
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

export const ordersService = {
	async list(params?: {
		page?: number;
		limit?: number;
		status?: OrderStatus;
		search?: string;
	}): Promise<{ items: OrderListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<OrderListItem>>("/orders", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listForToko(params?: {
		page?: number;
		limit?: number;
		status?: OrderStatus;
		search?: string;
	}): Promise<{ items: OrderListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<OrderListItem>>("/toko/orders", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async listForSales(params?: {
		page?: number;
		limit?: number;
		status?: OrderStatus;
		search?: string;
		storeId?: string;
	}): Promise<{ items: OrderListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<OrderListItem>>("/sales/orders", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async verify(orderId: string): Promise<OrderListItem> {
		const response = await apiClient.patch<ApiResponse<OrderListItem>>(
			`/orders/${orderId}/verify`,
		);
		return response.data.data;
	},

	async cancel(orderId: string, cancelReason: string): Promise<OrderListItem> {
		const response = await apiClient.patch<ApiResponse<OrderListItem>>(
			`/orders/${orderId}/cancel`,
			{ cancelReason },
		);
		return response.data.data;
	},

	async getById(orderId: string): Promise<OrderListItem> {
		const response = await apiClient.get<ApiResponse<OrderListItem>>(`/orders/${orderId}`);
		return response.data.data;
	},

	async create(payload: CreateOrderPayload): Promise<OrderListItem> {
		const response = await apiClient.post<ApiResponse<OrderListItem>>("/orders", payload);
		return response.data.data;
	},

	async createForToko(payload: CreateOrderPayload): Promise<OrderListItem> {
		const response = await apiClient.post<ApiResponse<OrderListItem>>("/toko/orders", payload);
		return response.data.data;
	},

	async createForSales(payload: CreateOrderPayload): Promise<OrderListItem> {
		const response = await apiClient.post<ApiResponse<OrderListItem>>("/sales/orders", payload);
		return response.data.data;
	},
};
