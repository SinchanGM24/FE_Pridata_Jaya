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

interface GetRoleDetailResponse {
	data: RoleDetail;
}

export const rolesService = {
	async list(): Promise<{ items: RoleSummary[] }> {
		const response = await apiClient.get<ListRolesResponse>("/roles");
		return response.data;
	},

	async getDetail(roleName: string): Promise<RoleDetail> {
		const response = await apiClient.get<GetRoleDetailResponse>(
			`/roles/${encodeURIComponent(roleName)}`,
		);
		return response.data.data;
	},
};
