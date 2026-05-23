import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";
import type { ApiResponse, PaginatedResponse } from "@/types";

export interface SupplierListItem {
	id: string;
	name: string;
	contactPerson?: string;
	phone?: string;
	email?: string;
	address?: string;
	status: "active" | "inactive";
	createdAt?: string;
	updatedAt?: string;
}

export interface SupplierDetail extends SupplierListItem {
	notes?: string;
}

export interface CreateSupplierPayload {
	name: string;
	contactPerson?: string;
	phone?: string;
	email?: string;
	address?: string;
	notes?: string;
}

export interface UpdateSupplierPayload {
	name?: string;
	contactPerson?: string;
	phone?: string;
	email?: string;
	address?: string;
	notes?: string;
}

interface SupplierListParams {
	page?: number;
	limit?: number;
	search?: string;
	status?: "active" | "inactive";
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

export const suppliersService = {
	async list(
		params?: SupplierListParams,
	): Promise<{ items: SupplierListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<SupplierListItem>>(
			"/suppliers",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async listAll(
		params?: Omit<SupplierListParams, "page" | "limit">,
	): Promise<SupplierListItem[]> {
		return collectPaginatedItems(
			(page, limit) =>
				this.list({
					...(params || {}),
					page,
					limit,
				}),
			100,
		);
	},

	async getById(id: string): Promise<SupplierDetail> {
		const response = await apiClient.get<ApiResponse<SupplierDetail>>(
			`/suppliers/${id}`,
		);
		return response.data.data;
	},

	async create(payload: CreateSupplierPayload): Promise<SupplierListItem> {
		const response = await apiClient.post<ApiResponse<SupplierListItem>>(
			"/suppliers",
			payload,
		);
		return response.data.data;
	},

	async update(id: string, payload: UpdateSupplierPayload): Promise<SupplierListItem> {
		const response = await apiClient.put<ApiResponse<SupplierListItem>>(
			`/suppliers/${id}`,
			payload,
		);
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/suppliers/${id}`);
	},

	async updateStatus(
		id: string,
		status: "active" | "inactive",
	): Promise<SupplierListItem> {
		const response = await apiClient.patch<ApiResponse<SupplierListItem>>(
			`/suppliers/${id}/status`,
			{ status },
		);
		return response.data.data;
	},

	async getAll(
		page = 1,
		limit = 10,
	): Promise<PaginatedResponse<SupplierListItem>> {
		const response = await apiClient.get<ApiResponse<SupplierListItem[]>>(
			"/suppliers",
			{ params: { page, limit } },
		);
		const meta = response.data.meta as Partial<PaginatedResponse<SupplierListItem>> | undefined;
		return {
			data: response.data.data ?? [],
			page: meta?.page ?? page,
			limit: meta?.limit ?? limit,
			totalItems: meta?.totalItems ?? response.data.data?.length ?? 0,
			totalPages: meta?.totalPages ?? 1,
		};
	},
};
