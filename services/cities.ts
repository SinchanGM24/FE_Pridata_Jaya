import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";

export interface City {
	id: string;
	name: string;
	province: string;
}

interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

interface PaginatedCityResult {
	items: City[];
	meta?: PaginationMeta;
}

interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
	meta?: unknown;
}

export const citiesService = {
	async list(params?: {
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<City[]> {
		const response = await apiClient.get<ApiResponse<City[]>>("/cities", {
			params,
		});
		return response.data.data;
	},

	async listPage(params?: {
		page?: number;
		limit?: number;
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<PaginatedCityResult> {
		const response = await apiClient.get<ApiResponse<City[]>>("/cities", {
			params,
		});
		return {
			items: response.data.data,
			meta: response.data.meta as PaginationMeta | undefined,
		};
	},

	async listAll(params?: {
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<City[]> {
		return collectPaginatedItems(
			(page, limit) =>
				this.listPage({
					...(params || {}),
					page,
					limit,
				}),
			100,
		);
	},

	async search(search = ""): Promise<City[]> {
		return (await this.listPage({ page: 1, limit: 10, search, sortBy: "name", sortOrder: "asc" })).items;
	},

	async create(payload: { name: string; province: string }): Promise<City> {
		const response = await apiClient.post<ApiResponse<City>>("/cities", payload);
		return response.data.data;
	},
};
