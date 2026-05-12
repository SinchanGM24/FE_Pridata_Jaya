import apiClient from "@/lib/api-client";

export interface SubDivisionListItem {
	id: string;
	name: string;
	categoryId: string;
	divisionId: string;
	createdAt?: string;
	updatedAt?: string;
	category?: {
		id: string;
		name: string;
	} | null;
	division?: {
		id: string;
		name: string;
	} | null;
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

export const subDivisionsService = {
	async list(params?: {
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		search?: string;
	}): Promise<{ items: SubDivisionListItem[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<SubDivisionListItem>>("/sub-divisions", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	async create(payload: { name: string; categoryId: string; divisionId: string }): Promise<SubDivisionListItem> {
		const response = await apiClient.post<ApiResponse<SubDivisionListItem>>("/sub-divisions", payload);
		return response.data.data;
	},

	async update(
		id: string,
		payload: { name?: string; categoryId?: string; divisionId?: string },
	): Promise<SubDivisionListItem> {
		const response = await apiClient.put<ApiResponse<SubDivisionListItem>>(`/sub-divisions/${id}`, payload);
		return response.data.data;
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete<ApiResponse<null>>(`/sub-divisions/${id}`);
	},
};
