import apiClient from "@/lib/api-client";

export interface Permission {
	resource: string;
	action: string;
	conditions?: Record<string, unknown>;
}

export interface RoleSummary {
	name: string;
	description: string;
	userCount?: number;
}

export interface RoleDetail {
	name: string;
	description: string;
	permissions: Permission[];
}

interface ListRolesResponse {
	items: RoleSummary[];
}

interface ApiSuccessResponse<T> {
	success?: boolean;
	message?: string;
	data: T;
}

interface GetRoleDetailResponse {
	data: RoleDetail;
}

export const rolesService = {
	async list(): Promise<{ items: RoleSummary[] }> {
		const response = await apiClient.get<ListRolesResponse | ApiSuccessResponse<RoleSummary[] | ListRolesResponse>>("/roles");
		const payload = response.data;
		if ("data" in payload) {
			const data = payload.data;
			return { items: Array.isArray(data) ? data : data.items ?? [] };
		}
		return { items: payload.items ?? [] };
	},

	async getDetail(roleName: string): Promise<RoleDetail> {
		const response = await apiClient.get<GetRoleDetailResponse>(
			`/roles/${encodeURIComponent(roleName)}`,
		);
		return response.data.data;
	},
};
