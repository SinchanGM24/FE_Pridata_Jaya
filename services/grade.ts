import apiClient from "@/lib/api-client";
import { featureMockGet, USE_NEXT_FEATURE_MOCK_SERVER } from "@/lib/feature-mock";
import { collectPaginatedItems } from "@/services/pagination";
import type { ApiResponse } from "@/types";

export interface StoreGradeItem {
	storeId: string;
	storeName: string;
	email: string;
	isActive?: boolean;
	verificationStatus: string;
	creditLimit: number;
	storeType?: "RETAILER" | "WHOLESALER" | "DISTRIBUTOR";
	totalOrders: number;
	totalInvoices: number;
	totalSalesAmount: number;
	totalPaidAmount: number;
	totalOutstandingAmount: number;
	recentOrders: number;
	recentInvoices: number;
	recentSalesAmount: number;
	recentPaidAmount: number;
	recentOutstandingAmount: number;
	averageMonthlyPurchase: number;
	averagePaymentDays: number;
	evaluationWindowStart: string;
	evaluationWindowEnd: string;
	probationEndsAt: string;
	storeAgeDays: number;
	gradeReason: string;
	grade: "N" | "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";
}

export interface GradePaginationMeta {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

export interface GradeListParams {
	page?: number;
	limit?: number;
	search?: string;
	storeId?: string;
	grade?: StoreGradeItem["grade"];
}

type GradeListResponse = Omit<ApiResponse<StoreGradeItem[]>, "meta"> & {
	meta?: GradePaginationMeta;
};

/**
 * One grade collection for every actor: the backend narrows the rows by the
 * caller's role, so there is no per-role path. `scope` survives only because the
 * Next.js mock still keys its fixtures by it.
 */
const fetchGradePage = async (
	params?: GradeListParams,
	scope: "internal" | "sales" | "toko" = "internal",
) => {
	if (USE_NEXT_FEATURE_MOCK_SERVER) {
		const response = await featureMockGet<GradeListResponse>("/store-grades", {
			...params,
			scope,
		});
		return { data: response.data ?? [], meta: response.meta };
	}
	const response = await apiClient.get<GradeListResponse>("/store-grades", { params });
	return {
		data: response.data.data ?? [],
		meta: response.data.meta,
	};
};

const collectGradePages = (
	params?: GradeListParams,
	scope: "internal" | "sales" | "toko" = "internal",
) =>
	collectPaginatedItems(
		async (page, limit) => {
			const result = await fetchGradePage({ ...params, page, limit }, scope);
			return { items: result.data, meta: result.meta };
		},
		100,
	);

export const gradeService = {
	async listPage(params?: GradeListParams) {
		return fetchGradePage(params);
	},

	async list(params?: GradeListParams): Promise<StoreGradeItem[]> {
		return collectGradePages(params);
	},

	async listForToko(): Promise<StoreGradeItem[]> {
		const result = await fetchGradePage({ page: 1, limit: 1 }, "toko");
		return result.data;
	},

	async listForSalesPage(params?: GradeListParams) {
		return fetchGradePage(params, "sales");
	},

	async listForSales(params?: GradeListParams): Promise<StoreGradeItem[]> {
		return collectGradePages(params, "sales");
	},

	/** Grade for one store, scoped by the caller's role on the backend. */
	async getForStore(storeId: string): Promise<StoreGradeItem | null> {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			const result = await fetchGradePage({ storeId, page: 1, limit: 1 });
			return result.data[0] ?? null;
		}
		const response = await apiClient.get<ApiResponse<StoreGradeItem>>(
			`/stores/${storeId}/grade`,
		);
		return response.data.data ?? null;
	},
};
