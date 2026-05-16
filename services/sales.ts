import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";
import type { OrderListItem } from "@/services/orders";
import type { ReceivableAging } from "@/services/receivable";
import type { StoreGradeItem } from "@/services/grade";

export interface SalesDashboardData {
	summary: {
		totalInvoices: number;
		totalAmount: number;
		totalPaidAmount: number;
		totalRemainingAmount: number;
		byStatus: Record<string, number>;
	};
	receivables: {
		totalReceivables: number;
		totalOutstandingAmount: number;
		overdueCount: number;
		aging: {
			current: { count: number; amount: number };
			days1To30: { count: number; amount: number };
			days31To60: { count: number; amount: number };
			days61To90: { count: number; amount: number };
			daysOver90: { count: number; amount: number };
		};
	};
	stores: StoreGradeItem[];
	recentOrders: OrderListItem[];
}

export const salesService = {
	async getDashboard(): Promise<SalesDashboardData> {
		const response = await apiClient.get<ApiResponse<SalesDashboardData>>("/sales/dashboard");
		return response.data.data;
	},

	async getManagedStores(search?: string): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>(
			"/sales/toko-kelolaan",
			{ params: search ? { search } : undefined },
		);
		return response.data.data;
	},

	async registerManagedStore(payload: {
		ownerName: string;
		ownerEmail: string;
		ownerPassword: string;
		storeName: string;
		phone: string;
		address: string;
		cityId: string;
		storeType?: "RETAILER" | "WHOLESALER" | "DISTRIBUTOR";
		creditLimit?: number;
		ownerNik?: string;
		ownerNpwp?: string;
		ownerNib?: string;
		businessLicense?: string;
		yearsInBusiness?: number;
		estimatedMonthlyRevenue?: number;
		salesNotes?: string;
	}): Promise<unknown> {
		const response = await apiClient.post<ApiResponse<unknown>>(
			"/sales/toko-kelolaan",
			payload,
		);
		return response.data.data;
	},

	async getAging(storeId?: string): Promise<ReceivableAging> {
		const response = await apiClient.get<ApiResponse<ReceivableAging>>(
			"/sales/aging-piutang",
			{ params: storeId ? { storeId } : undefined },
		);
		return response.data.data;
	},
};
