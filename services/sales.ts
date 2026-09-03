import apiClient from "@/lib/api-client";
import { featureMockGet, featureMockPost, USE_NEXT_FEATURE_MOCK_SERVER } from "@/lib/feature-mock";
import type { ApiResponse } from "@/types";
import type { OrderListItem } from "@/services/orders";
import type { ReceivableAging } from "@/services/receivable";
import type { GradePaginationMeta, StoreGradeItem } from "@/services/grade";

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

export type SalesManagedStoreFallback = Partial<StoreGradeItem> & {
	id?: string;
	name?: string;
	user?: {
		email?: string | null;
	};
	store?: Partial<StoreGradeItem> & {
		id?: string;
		name?: string;
		user?: {
			email?: string | null;
		};
	};
};

type ManagedStoreListResponse = Omit<ApiResponse<SalesManagedStoreFallback[]>, "meta"> & {
	meta?: GradePaginationMeta;
};

const toManagedStoreItem = (item: SalesManagedStoreFallback): StoreGradeItem => {
	const source = item.store ?? item;
	const rawGrade = String(source.grade ?? "");
	const grade = (["N", "A+", "A", "B+", "B", "C+", "C", "D"] as const).find(
		(value) => value === rawGrade,
	) ?? "N";
	return {
		storeId: source.storeId ?? source.id ?? "",
		storeName: source.storeName ?? source.name ?? "Toko",
		email: source.email ?? source.user?.email ?? "",
		isActive: source.isActive ?? false,
		verificationStatus: source.verificationStatus ?? "PENDING",
		creditLimit: source.creditLimit ?? 0,
		storeType: source.storeType,
		totalOrders: source.totalOrders ?? 0,
		totalInvoices: source.totalInvoices ?? 0,
		totalSalesAmount: source.totalSalesAmount ?? 0,
		totalPaidAmount: source.totalPaidAmount ?? 0,
		totalOutstandingAmount: source.totalOutstandingAmount ?? 0,
		recentOrders: source.recentOrders ?? 0,
		recentInvoices: source.recentInvoices ?? 0,
		recentSalesAmount: source.recentSalesAmount ?? 0,
		recentPaidAmount: source.recentPaidAmount ?? 0,
		recentOutstandingAmount: source.recentOutstandingAmount ?? 0,
		averageMonthlyPurchase: source.averageMonthlyPurchase ?? 0,
		averagePaymentDays: source.averagePaymentDays ?? 0,
		evaluationWindowStart: source.evaluationWindowStart ?? "",
		evaluationWindowEnd: source.evaluationWindowEnd ?? "",
		probationEndsAt: source.probationEndsAt ?? "",
		storeAgeDays: source.storeAgeDays ?? 0,
		gradeReason: source.gradeReason ?? "Belum masuk penilaian grade.",
		grade,
	};
};

export const salesService = {
	async listManagedStoresPage(params: { page?: number; limit?: number; search?: string } = {}) {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			const response = await featureMockGet<ManagedStoreListResponse>("/sales/managed-stores", params);
			return { data: (response.data ?? []).map(toManagedStoreItem), meta: response.meta };
		}
		// Canonical: the store collection scoped to the caller's own assignments.
		// The backend forces this scope for a sales session regardless of the query.
		const response = await apiClient.get<ManagedStoreListResponse>("/stores", {
			params: { ...params, assignedSalesUserId: "me" },
		});
		return {
			data: (response.data.data ?? []).map(toManagedStoreItem),
			meta: response.data.meta,
		};
	},

	async getDashboardRaw(): Promise<SalesDashboardData> {
		const response = await apiClient.get<ApiResponse<SalesDashboardData>>("/dashboard/sales");
		return response.data.data;
	},

	async getDashboard(): Promise<SalesDashboardData> {
		const [dashboardResponse, storesResponse] = await Promise.all([
			apiClient.get<ApiResponse<SalesDashboardData>>("/dashboard/sales"),
			apiClient.get<ApiResponse<StoreGradeItem[]>>("/store-grades"),
		]);
		return {
			...dashboardResponse.data.data,
			stores: storesResponse.data.data,
		};
	},

	async getManagedStores(search?: string): Promise<StoreGradeItem[]> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem[]>>("/store-grades", {
			params: search ? { search } : undefined,
		});
		return response.data.data;
	},

	async getManagedStoresRaw(search?: string): Promise<SalesManagedStoreFallback[]> {
		const response = await apiClient.get<ApiResponse<SalesManagedStoreFallback[]>>("/stores", {
			params: { assignedSalesUserId: "me", ...(search ? { search } : {}) },
		});
		return response.data.data;
	},

	async getManagedStoreById(storeId: string): Promise<StoreGradeItem> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem>>(`/stores/${storeId}`);
		return response.data.data;
	},

	async registerManagedStore(payload: {
		ownerName: string;
		ownerEmail: string;
		ownerPassword: string;
		storeName: string;
		ownerGender: "MALE" | "FEMALE";
		ownerPhoneNumber?: string;
		phone: string;
		address: string;
		cityId?: string;
		newCityName?: string;
		newCityProvince?: string;
		storeType?: "RETAILER" | "WHOLESALER" | "DISTRIBUTOR";
		yearsInBusiness: number;
		estimatedMonthlyRevenue?: number;
		salesNotes?: string;
	}): Promise<unknown> {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			const response = await featureMockPost<ApiResponse<unknown>>("/sales/managed-stores", payload);
			return response.data;
		}
		// Canonical store registration; the same endpoint also accepts an existing
		// owner account, so there is no separate sales-only registration route.
		const response = await apiClient.post<ApiResponse<unknown>>("/stores", payload);
		return response.data.data;
	},

	async getAging(storeId?: string): Promise<ReceivableAging> {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			const response = await featureMockGet<ApiResponse<ReceivableAging>>(
				"/sales/receivables/aging",
				storeId ? { storeId } : undefined,
			);
			return response.data;
		}
		// Canonical aging summary; scope comes from the sales session, not the path.
		const response = await apiClient.get<ApiResponse<ReceivableAging>>(
			"/receivables/aging",
			{ params: storeId ? { storeId } : undefined },
		);
		return response.data.data;
	},
};
