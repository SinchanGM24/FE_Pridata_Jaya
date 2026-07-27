import apiClient from "@/lib/api-client";

export interface Permission {
	resource: string;
	action: string;
	conditions?: Record<string, unknown>;
}

export interface AppRoleAccess {
	area: string;
	access: string;
	scope: string;
}

export interface RoleSummary {
	name: string;
	label?: string;
	description?: string;
	userCount?: number;
	assignable?: boolean;
	sourceAccess?: string;
	appAccess?: AppRoleAccess[];
	appAccessCount?: number;
	statements?: Record<string, string[]>;
}

export interface RoleDetail {
	name: string;
	label?: string;
	description: string;
	userCount?: number;
	assignable?: boolean;
	sourceAccess?: string;
	appAccess?: AppRoleAccess[];
	appAccessCount?: number;
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
	label?: string;
	description?: string;
	userCount?: number;
	assignable?: boolean;
	sourceAccess?: string;
	appAccess?: AppRoleAccess[];
	appAccessCount?: number;
	statements?: Record<string, string[]>;
	permissions?: Permission[];
}

const normalizeRoleSummary = (role: RoleSummary): RoleSummary => ({
	...role,
	label: role.label ?? role.description ?? role.name,
	description: role.description ?? "",
	assignable: role.assignable ?? true,
	userCount: role.userCount ?? 0,
	sourceAccess: role.sourceAccess ?? (role.assignable === false ? "Konfigurasi sistem" : "Undangan anggota internal"),
	appAccess: role.appAccess ?? [],
	appAccessCount: role.appAccessCount ?? role.appAccess?.length ?? 0,
});

const statementsToPermissions = (
	statements?: Record<string, string[]>,
): Permission[] =>
	Object.entries(statements ?? {}).flatMap(([resource, actions]) =>
		(actions ?? []).map((action) => ({ resource, action })),
	);

const normalizeRoleDetail = (detail: RoleDetail | RoleStatementDetail): RoleDetail => ({
	name: detail.name,
	label: detail.label ?? detail.name,
	description: detail.description ?? "",
	userCount: detail.userCount ?? 0,
	assignable: detail.assignable ?? true,
	sourceAccess: detail.sourceAccess ?? (detail.assignable === false ? "Konfigurasi sistem" : "Undangan anggota internal"),
	appAccess: detail.appAccess ?? [],
	appAccessCount: detail.appAccessCount ?? detail.appAccess?.length ?? 0,
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
			return { items: (Array.isArray(data) ? data : data.items ?? []).map(normalizeRoleSummary) };
		}
		return { items: (payload.items ?? []).map(normalizeRoleSummary) };
	},

	async getDetail(roleName: string): Promise<RoleDetail> {
		const response = await apiClient.get<GetRoleDetailResponse>(
			`/roles/${encodeURIComponent(roleName)}`,
		);
		return normalizeRoleDetail(response.data.data);
	},
};
