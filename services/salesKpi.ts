import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export type SalesKpiCategoryKey = "omzet" | "activeStores" | "newActiveStores" | "collectionRate";
export type SalesTargetSource = "individual" | "general" | "automatic" | null;

export interface SalesKpiCategory {
	key: SalesKpiCategoryKey;
	label: string;
	unit: "currency" | "count" | "percent";
	target: number | null;
	targetSource: SalesTargetSource;
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
	weightSource?: "global" | "individual";
	collection?: { dueAmount: number; paidAmount: number; unpaidDueAmount: number; outstandingAmount: number; outstandingInvoiceCount: number };
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
	effectiveFrom?: string;
	targetAmount?: number | null;
	targetActiveStores?: number | null;
	targetNewActiveStores?: number | null;
	targetCollectionRate?: number | null;
}

export interface SalesKpiTargetValues {
	targetAmount: number | null;
	targetActiveStores: number | null;
	targetNewActiveStores: number | null;
	targetCollectionRate: number | null;
}

export interface SalesKpiDefaultTargets extends SalesKpiTargetValues {
	effectiveFrom: string | null;
	updatedByUserId: string | null;
	updatedAt: string | null;
	isDefault: boolean;
}

export interface SalesKpiUserTargets {
	salesUserId: string;
	salesUserName: string;
	override: (SalesKpiTargetValues & { effectiveFrom: string }) | null;
	resolved: { values: SalesKpiTargetValues; sources: Record<keyof SalesKpiTargetValues, SalesTargetSource> };
}

export interface SalesKpiTargetsOverview {
	period: string;
	general: SalesKpiDefaultTargets;
	salesUsers: SalesKpiUserTargets[];
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

	async getTargets(period: string): Promise<SalesKpiTargetsOverview> {
		const res = await apiClient.get<ApiResponse<SalesKpiTargetsOverview>>("/sales-kpi/targets", { params: { period } });
		return res.data.data;
	},

	async getDefaultTargets(period: string): Promise<SalesKpiDefaultTargets> {
		const res = await apiClient.get<ApiResponse<SalesKpiDefaultTargets>>("/sales-kpi/targets/default", { params: { period } });
		return res.data.data;
	},

	async updateDefaultTargets(payload: SalesKpiTargetPayload): Promise<SalesKpiDefaultTargets> {
		const res = await apiClient.put<ApiResponse<SalesKpiDefaultTargets>>("/sales-kpi/targets/default", payload);
		return res.data.data;
	},
};
