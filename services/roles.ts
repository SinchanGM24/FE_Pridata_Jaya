import apiClient from "@/lib/api-client";

export interface Permission {
	resource: string;
	action: string;
	conditions?: Record<string, unknown>;
}

export interface RoleSummary {
	name: string;
	description?: string;
	userCount?: number;
	statements?: Record<string, string[]>;
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
	data: RoleDetail | RoleStatementDetail;
}

interface RoleStatementDetail {
	name: string;
	description?: string;
	statements?: Record<string, string[]>;
	permissions?: Permission[];
}

const statementsToPermissions = (
	statements?: Record<string, string[]>,
): Permission[] =>
	Object.entries(statements ?? {}).flatMap(([resource, actions]) =>
		(actions ?? []).map((action) => ({ resource, action })),
	);

const normalizeRoleDetail = (detail: RoleDetail | RoleStatementDetail): RoleDetail => ({
	name: detail.name,
	description: detail.description ?? "",
	permissions: Array.isArray(detail.permissions)
		? detail.permissions
		: statementsToPermissions("statements" in detail ? detail.statements : undefined),
});

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
		return normalizeRoleDetail(response.data.data);
	},
};
