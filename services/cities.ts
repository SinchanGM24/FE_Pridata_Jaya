import apiClient from "@/lib/api-client";

export interface City {
	id: string;
	name: string;
	province: string;
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

	async create(payload: { name: string; province: string }): Promise<City> {
		const response = await apiClient.post<ApiResponse<City>>("/cities", payload);
		return response.data.data;
	},
};
