import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface MyProfile {
	id: string;
	email: string;
	name: string;
	image?: string | null;
	systemRole: string | null;
	organizationRole: string | null;
	activeOrganizationId: string | null;
	canEditSensitiveProfileFields: boolean;
	profile: {
		identityNumber: string | null;
		birthDate: string | null;
		gender: string | null;
		phoneNumber: string | null;
		address: string | null;
		city: string | null;
		province: string | null;
		postalCode: string | null;
		joinDate: string | null;
	} | null;
	store: {
		id: string;
		name: string;
		email: string;
		phone: string;
		address: string;
		cityId: string;
		city: {
			id: string;
			name: string;
			province: string;
		} | null;
		assignedSalesUser: {
			id: string;
			name: string;
			email: string;
		} | null;
		storeType: string;
		creditLimit: number;
		verificationStatus: string;
	} | null;
}

export interface UpdateMyProfilePayload {
	name?: string;
	email?: string;
	image?: string | null;
	profile?: {
		identityNumber?: string | null;
		birthDate?: string | null;
		gender?: string | null;
		phoneNumber?: string | null;
		address?: string | null;
		city?: string | null;
		province?: string | null;
		postalCode?: string | null;
		joinDate?: string | null;
	};
	store?: {
		name?: string;
		email?: string;
		phone?: string;
		address?: string;
		cityId?: string;
	};
}

export const meService = {
	async getProfile(): Promise<MyProfile> {
		const response = await apiClient.get<ApiResponse<MyProfile>>("/me/profile");
		return response.data.data;
	},
	async updateProfile(payload: UpdateMyProfilePayload): Promise<MyProfile> {
		const response = await apiClient.patch<ApiResponse<MyProfile>>(
			"/me/profile",
			payload,
		);
		return response.data.data;
	},
};
