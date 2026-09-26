import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export type SalesKpiCategoryKey = "omzet" | "activeStores" | "newActiveStores" | "collectionRate";

export interface SalesKpiCategory {
	key: SalesKpiCategoryKey;
	label: string;
	unit: "currency" | "count" | "percent";
	target: number | null;
	actual: number;
	achievementPercent: number | null;
	weightPercent: number;
	effectiveWeightPercent: number;
	score: number;
	scored: boolean;
}

export interface SalesKpiResult {
	salesUserId: string;
	salesUserName: string;
	period: string;
	categories: SalesKpiCategory[];
	totalScore: number;
	achievementCapPercent: number;
	hasCompleteTarget: boolean;
	scoredCategoryCount: number;
	managedStoreCount: number;
}

export interface SalesKpiRankedResult extends SalesKpiResult {
	rank: number;
}

export interface SalesKpiConfig {
	effectiveFrom: string | null;
	weights: Record<SalesKpiCategoryKey, number>;
	achievementCapPercent: number;
	updatedByUserId: string | null;
	updatedAt: string | null;
	isDefault: boolean;
}

export interface SalesKpiTargetPayload {
	period: string;
	targetAmount?: number;
	targetActiveStores?: number | null;
	targetNewActiveStores?: number | null;
	targetCollectionRate?: number | null;
}

export interface SalesKpiConfigPayload {
	effectiveFrom?: string;
	weights: Record<SalesKpiCategoryKey, number>;
	achievementCapPercent?: number;
}

export interface SalesKpiRankingPage {
	items: SalesKpiRankedResult[];
	page: number;
	limit: number;
	totalItems: number;
	totalPages: number;
}

const pagination = (payload: ApiResponse<SalesKpiRankedResult[]>): SalesKpiRankingPage => {
	const meta = payload.meta ?? {};
	return {
		items: payload.data,
		page: Number(meta.currentPage ?? meta.page ?? 1),
		limit: Number((meta.itemsPerPage ?? meta.limit ?? payload.data.length) || 10),
		totalItems: Number(meta.totalItems ?? payload.data.length),
		totalPages: Number(meta.totalPages ?? 1),
	};
};

export const salesKpiService = {
	async getRanking(params: { period: string; page?: number; limit?: number; search?: string }): Promise<SalesKpiRankingPage> {
		const res = await apiClient.get<ApiResponse<SalesKpiRankedResult[]>>("/sales-kpi", { params });
		return pagination(res.data);
	},

	async getOne(salesUserId: string, period: string): Promise<SalesKpiResult> {
		const res = await apiClient.get<ApiResponse<SalesKpiResult>>(`/sales-kpi/${salesUserId}`, { params: { period } });
		return res.data.data;
	},

	async getMine(period: string): Promise<SalesKpiResult> {
		const res = await apiClient.get<ApiResponse<SalesKpiResult>>("/sales-kpi/me", { params: { period } });
		return res.data.data;
	},

	async getConfig(period: string): Promise<SalesKpiConfig> {
		const res = await apiClient.get<ApiResponse<SalesKpiConfig>>("/sales-kpi/config", { params: { period } });
		return res.data.data;
	},

	async updateConfig(payload: SalesKpiConfigPayload): Promise<SalesKpiConfig> {
		const res = await apiClient.put<ApiResponse<SalesKpiConfig>>("/sales-kpi/config", payload);
		return res.data.data;
	},

	async upsertTarget(salesUserId: string, payload: SalesKpiTargetPayload): Promise<unknown> {
		const res = await apiClient.put<ApiResponse<unknown>>(`/sales-kpi/targets/${salesUserId}`, payload);
		return res.data.data;
	},
};
