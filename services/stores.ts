import apiClient from "@/lib/api-client";
import { featureMockGet, USE_NEXT_FEATURE_MOCK_SERVER } from "@/lib/feature-mock";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface StoreDocuments {
	ownerName?: string | null;
	ownerGender?: "MALE" | "FEMALE" | null;
	ownerPhoneNumber?: string | null;
	ownerNik?: string | null;
	ownerNpwp?: string | null;
	ownerNib?: string | null;
	businessLicense?: string | null;
	yearsInBusiness?: number | null;
	estimatedMonthlyRevenue?: number | null;
	salesNotes?: string | null;
}

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
		profile?: {
			gender?: string | null;
			phone?: string | null;
			identityNumber?: string | null;
			birthDate?: string | null;
			phoneNumber?: string | null;
			address?: string | null;
			city?: string | null;
			province?: string | null;
			postalCode?: string | null;
			joinDate?: string | null;
		} | null;
	} | null;
	assignedSalesUser?: {
		id: string;
		name: string;
		email: string;
	} | null;
	storeType?: string;
	creditLimit?: number;
	documents?: StoreDocuments | null;
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
		search?: string;
	}): Promise<{ items: Store[]; meta?: unknown }> {
		const response = await apiClient.get<ApiResponse<Store[]> | Store[]>("/stores", {
			params,
		});
		const payload = response.data;
		if (Array.isArray(payload)) {
			return { items: payload, meta: undefined };
		}
		return {
			items: Array.isArray(payload.data) ? payload.data : [],
			meta: payload.meta,
		};
	},

	async search(search = ""): Promise<Store[]> {
		return (await this.list({ page: 1, limit: 10, search, sortBy: "name", sortOrder: "asc" })).items;
	},

	async getById(id: string): Promise<Store> {
		if (USE_NEXT_FEATURE_MOCK_SERVER && id.startsWith("mock-store-")) {
			const payload = await featureMockGet<ApiResponse<Store>>(`/store-grades/${id}`);
			return payload.data;
		}
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

	async update(
		id: string,
		payload: {
			assignedSalesUserId?: string | null;
			name?: string;
			email?: string;
			phone?: string;
			address?: string;
			cityId?: string;
			storeType?: string;
			creditLimit?: number;
			documents?: Record<string, unknown>;
			isActive?: boolean;
		},
	): Promise<Store> {
		const response = await apiClient.put<ApiResponse<Store>>(`/stores/${id}`, payload);
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
