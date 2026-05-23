import apiClient from "@/lib/api-client";

export type StoreCreditType = "CREDIT" | "DEBIT" | "ADJUSTMENT" | (string & {});

export type StoreCreditSortBy = "createdAt" | "amount" | "type";
export type SortOrder = "asc" | "desc";

export interface StoreCreditBalance {
	storeId: string;
	balance: number;
}

export interface StoreCreditLedgerItem {
	id: string;
	storeId?: string | null;
	type: StoreCreditType;
	amount: number;
	balanceAfter?: number | null;
	sourceType?: string | null;
	sourceId?: string | null;
	description?: string | null;
	createdAt?: string;
	createdBy?: string | null;
	store?: {
		id: string;
		name?: string | null;
		code?: string | null;
	} | null;
}

export interface StoreCreditLedgerParams {
	storeId?: string;
	type?: StoreCreditType;
	sourceType?: string;
	sourceId?: string;
	page?: number;
	limit?: number;
	sortBy?: StoreCreditSortBy;
	sortOrder?: SortOrder;
	dateFrom?: string;
	dateTo?: string;
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

export const storeCreditsService = {
	async getBalance(storeId: string): Promise<StoreCreditBalance> {
		const response = await apiClient.get<ApiResponse<StoreCreditBalance>>(
			"/store-credits/balance",
			{ params: { storeId } },
		);
		return response.data.data;
	},

	async getLedger(
		params?: StoreCreditLedgerParams,
	): Promise<{ items: StoreCreditLedgerItem[]; meta: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<StoreCreditLedgerItem>>(
			"/store-credits/ledger",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},
};
