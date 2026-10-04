import apiClient from "@/lib/api-client";
import type { DeliveryOrderStatus } from "@/services/delivery-orders";
import type { PaginationMeta } from "@/services/pagination";

export type TransactionHistoryView = "accepted" | "rejected";

export interface TransactionHistoryRow {
	kind: "invoice" | "draft" | "order";
	id: string;
	number: string;
	storeName: string;
	date: string;
	totalAmount: number;
	status: string;
	dueDate: string | null;
	orderId: string | null;
	orderNumber: string | null;
	deliveryOrderId: string | null;
	deliveryOrderNumber: string | null;
	deliveryOrderStatus: DeliveryOrderStatus | null;
}

export interface TransactionHistoryParams {
	view?: TransactionHistoryView;
	search?: string;
	/** UTC `Z` instant (batas hari WITA); tanggal polos ditolak server. */
	dateFrom?: string;
	dateTo?: string;
	page?: number;
	limit?: number;
}

export const transactionHistoryService = {
	async list(params?: TransactionHistoryParams): Promise<{ items: TransactionHistoryRow[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<{ data: TransactionHistoryRow[]; meta?: PaginationMeta }>(
			"/transaction-history",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},
};
