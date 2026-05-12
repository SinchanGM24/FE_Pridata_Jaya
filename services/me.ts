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
	store: {
		id: string;
		name: string;
		email: string;
		phone: string;
		verificationStatus: string;
	} | null;
}

export interface UpdateMyProfilePayload {
	name?: string;
	email?: string;
	image?: string | null;
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

