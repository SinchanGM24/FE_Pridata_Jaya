import apiClient from "@/lib/api-client";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface Store {
	id: string;
	userId: string;
	assignedSalesUserId?: string | null;
	name: string;
	email: string;
	phone: string;
	address: string;
	cityId: string;
	city?: {
		id: string;
		name: string;
		province?: string;
	} | null;
	user?: {
		id: string;
		name: string;
		email: string;
	} | null;
	assignedSalesUser?: {
		id: string;
		name: string;
		email: string;
	} | null;
	storeType?: string;
	creditLimit?: number;
	documents?: unknown;
	verificationStatus: VerificationStatus;
	verificationNotes?: string | null;
	verificationDate?: string | null;
	isActive?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
	meta?: unknown;
}

export const storesService = {
	async list(params?: {
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<{ items: Store[]; meta?: unknown }> {
		const response = await apiClient.get<ApiResponse<Store[]>>("/stores", {
			params,
		});
		return {
			items: response.data.data,
			meta: response.data.meta,
		};
	},

	async getById(id: string): Promise<Store> {
		const response = await apiClient.get<ApiResponse<Store>>(`/stores/${id}`);
		return response.data.data;
	},

	async create(payload: {
		userId: string;
		assignedSalesUserId?: string | null;
		name: string;
		email: string;
		phone: string;
		address: string;
		cityId: string;
		storeType?: string;
		creditLimit?: number;
		documents?: Record<string, unknown>;
	}): Promise<Store> {
		const response = await apiClient.post<ApiResponse<Store>>("/stores", payload);
		return response.data.data;
	},

	async listByVerificationStatus(status: VerificationStatus): Promise<Store[]> {
		const response = await apiClient.get<ApiResponse<Store[]>>(
			`/stores/verification/${status}`,
		);
		return response.data.data;
	},

	async updateVerificationStatus(payload: {
		id: string;
		verificationStatus: VerificationStatus;
		verificationNotes?: string;
	}): Promise<Store> {
		const response = await apiClient.patch<ApiResponse<Store>>(
			`/stores/${payload.id}/verification`,
			{
				verificationStatus: payload.verificationStatus,
				verificationNotes: payload.verificationNotes,
			},
		);
		return response.data.data;
	},
};
