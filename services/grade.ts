import apiClient from "@/lib/api-client";
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
	/*
	 * Kontak toko untuk penagihan. Opsional karena /store-grades tidak
	 * membawanya; hanya koleksi /stores yang punya, dan itulah yang dipakai
	 * halaman toko kelolaan.
	 */
	address?: string | null;
	phone?: string | null;
	city?: { name?: string | null; province?: string | null } | null;
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
 * caller's role, so there is no per-role path and no scope argument — the
 * parameter that used to sit here existed only to key the Next.js mock's
 * fixtures, and that mock is gone.
 */
const fetchGradePage = async (params?: GradeListParams) => {
	const response = await apiClient.get<GradeListResponse>("/store-grades", { params });
	return {
		data: response.data.data ?? [],
		meta: response.data.meta,
	};
};

const collectGradePages = (params?: GradeListParams) =>
	collectPaginatedItems(
		async (page, limit) => {
			const result = await fetchGradePage({ ...params, page, limit });
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
		const result = await fetchGradePage({ page: 1, limit: 1 });
		return result.data;
	},

	async listForSalesPage(params?: GradeListParams) {
		return fetchGradePage(params);
	},

	async listForSales(params?: GradeListParams): Promise<StoreGradeItem[]> {
		return collectGradePages(params);
	},

	/** Grade for one store, scoped by the caller's role on the backend. */
	async getForStore(storeId: string): Promise<StoreGradeItem | null> {
		const response = await apiClient.get<ApiResponse<StoreGradeItem>>(
			`/stores/${storeId}/grade`,
		);
		return response.data.data ?? null;
	},
};
