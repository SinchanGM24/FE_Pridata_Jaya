import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";
import type { StoreGradeItem } from "@/services/grade";
import type { OrderListItem } from "@/services/orders";

export interface TokoDashboardData {
	store: StoreGradeItem | null;
	recentOrders: OrderListItem[];
	recentInvoices: Array<{
		id: string;
		invoiceNumber: string;
		status: string;
		invoiceDate: string;
		totalAmount: number;
		remainingAmount: number;
	}>;
	receivableStatement: {
		totalInvoiceAmount: number;
		totalPaidAmount: number;
		totalOutstandingAmount: number;
	};
}

export const tokoService = {
	async getDashboard(): Promise<TokoDashboardData> {
		// Backend memasang dashboard toko di /dashboard/store; tidak ada mount /toko.
		const response = await apiClient.get<ApiResponse<TokoDashboardData>>("/dashboard/store");
		return response.data.data;
	},
};

