import apiClient from "@/lib/api-client";
import type { ApiResponse, PaginatedResponse } from "@/types";

export type ReconciliationCondition = "GOOD" | "DAMAGED";
export type ReconciliationStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type ReconciliationItemStatus = "MATCH" | "DISCREPANCY";

export interface ReconciliationSnapshotItem {
	productId: string;
	productName: string;
	condition: ReconciliationCondition;
	systemQuantity: number;
}

export interface ReconciliationSnapshot {
	warehouseId: string;
	warehouseName: string;
	snapshotAt: string;
	items: ReconciliationSnapshotItem[];
}

export interface ReconciliationSessionSummary {
	id: string;
	warehouseId: string;
	status: ReconciliationStatus;
	createdAt: string;
	items?: Array<{
		productId: string;
	}>;
	itemCount?: number;
}

export interface ReconciliationSessionDetail {
	sessionId: string;
	warehouseId: string;
	warehouseName: string;
	status: ReconciliationStatus;
	createdAt: string;
	items: Array<{
		productId: string;
		productName: string;
		condition: ReconciliationCondition;
		systemQuantity: number;
		physicalQuantity: number;
		discrepancyQuantity: number;
		status: ReconciliationItemStatus;
	}>;
	summary: {
		totalItems: number;
		matchedItems: number;
		discrepancyItems: number;
		totalDiscrepancyQuantity: number;
	};
}

export interface CreateReconciliationSessionPayload {
	items: Array<{
		productId: string;
		condition: ReconciliationCondition;
		physicalQuantity: number;
	}>;
}

export const reconciliationService = {
	async getSnapshot(warehouseId: string, params?: Record<string, unknown>) {
		const res = await apiClient.get<ApiResponse<ReconciliationSnapshot>>(
			`/warehouses/${warehouseId}/reconciliation/snapshot`,
			{ params },
		);
		return res.data.data;
	},

	async createSession(warehouseId: string, body: CreateReconciliationSessionPayload) {
		const res = await apiClient.post<ApiResponse<ReconciliationSessionSummary>>(
			`/warehouses/${warehouseId}/reconciliation/sessions`,
			body,
		);
		return res.data.data;
	},

	async listSessions(
		warehouseId: string,
		params?: Record<string, unknown>,
	): Promise<PaginatedResponse<ReconciliationSessionSummary>> {
		const res = await apiClient.get<ApiResponse<ReconciliationSessionSummary[]>>(
			`/warehouses/${warehouseId}/reconciliation/sessions`,
			{ params },
		);
		const meta = res.data.meta as Partial<PaginatedResponse<ReconciliationSessionSummary>> | undefined;
		return {
			data: res.data.data ?? [],
			page: meta?.page ?? 1,
			limit: meta?.limit ?? (Array.isArray(res.data.data) ? res.data.data.length : 0),
			totalItems: meta?.totalItems ?? (Array.isArray(res.data.data) ? res.data.data.length : 0),
			totalPages: meta?.totalPages ?? 1,
		};
	},

	async getSessionById(sessionId: string) {
		const res = await apiClient.get<ApiResponse<ReconciliationSessionDetail>>(
			`/reconciliation/sessions/${sessionId}`,
		);
		return res.data.data;
	},

	async confirmSession(sessionId: string) {
		const res = await apiClient.post<ApiResponse<unknown>>(`/reconciliation/sessions/${sessionId}/confirm`);
		return res.data.data;
	},

	async cancelSession(sessionId: string) {
		const res = await apiClient.post<ApiResponse<unknown>>(`/reconciliation/sessions/${sessionId}/cancel`);
		return res.data.data;
	},

	async getCrossWarehouseReport(params?: Record<string, unknown>) {
		const res = await apiClient.get<ApiResponse<unknown>>(`/reconciliation/report`, { params });
		return res.data.data;
	},
};

export default reconciliationService;
