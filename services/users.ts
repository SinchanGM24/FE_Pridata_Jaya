import apiClient from "@/lib/api-client";
import { type PaginationMeta } from "@/services/pagination";
import type { User, UserRole } from "@/types";

interface ApiSuccessResponse<T> {
	message?: string;
	data: T;
}

export interface AdminCreateUserPayload {
	email: string;
	name: string;
	password: string;
	systemRole?: UserRole;
	organizationRole?: string;
	image?: string | null;
	profile?: UserProfilePayload;
}

export interface AdminUpdateUserPayload {
	email?: string;
	name?: string;
	password?: string;
	systemRole?: UserRole;
	organizationRole?: string;
	image?: string | null;
	profile?: UserProfilePayload;
}

export interface UserProfilePayload {
	identityNumber?: string | null;
	birthDate?: string | null;
	gender?: string | null;
	phoneNumber?: string | null;
	address?: string | null;
	city?: string | null;
	province?: string | null;
	postalCode?: string | null;
	joinDate?: string | null;
}

type UserListApiResponse = { data: User[]; meta?: PaginationMeta };

export interface UserListParams {
	page?: number;
	limit?: number;
	search?: string;
	/** Peran tampilan: peran organisasi, atau peran sistem kalau tak punya keanggotaan. */
	role?: string;
	/** inactive = akun dibanned. */
	status?: "active" | "inactive";
	assigned?: boolean;
	excludePrivileged?: boolean;
}

export interface UserSummary {
	total: number;
	byRole: Record<string, number>;
}

export const usersService = {
	async getCount(): Promise<number> {
		const result = await this.list({ page: 1, limit: 1 });
		return result.meta?.totalItems ?? result.items.length;
	},

	async list(params?: UserListParams): Promise<{ items: User[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<UserListApiResponse>("/users", { params });
		return { items: response.data.data, meta: response.data.meta };
	},

	async summary(params?: Pick<UserListParams, "assigned" | "excludePrivileged">): Promise<UserSummary> {
		const response = await apiClient.get<ApiSuccessResponse<UserSummary>>("/users/summary", { params });
		return response.data.data;
	},

	async getById(id: string): Promise<User> {
		const response = await apiClient.get<ApiSuccessResponse<User>>(`/users/${id}`);
		return response.data.data;
	},

	async create(payload: AdminCreateUserPayload): Promise<User> {
		const response = await apiClient.post<ApiSuccessResponse<User>>("/users", payload);
		return response.data.data;
	},

	async update(id: string, payload: AdminUpdateUserPayload): Promise<User> {
		const response = await apiClient.put<ApiSuccessResponse<User>>(`/users/${id}`, payload);
		return response.data.data;
	},

	async setPassword(id: string, newPassword: string): Promise<void> {
		await apiClient.patch(`/users/${id}/password`, {
			newPassword,
		});
	},

	async delete(id: string): Promise<void> {
		await apiClient.delete(`/users/${id}`);
	},

	async banUser(id: string, banned: boolean, banReason?: string): Promise<User> {
		const response = await apiClient.patch<ApiSuccessResponse<User>>(`/users/${id}/ban`, {
			banned,
			banReason,
		});
		return response.data.data;
	},

	async setRole(id: string, systemRole?: UserRole, organizationRole?: string): Promise<User> {
		const response = await apiClient.patch<ApiSuccessResponse<User>>(`/users/${id}/role`, {
			systemRole,
			organizationRole,
		});
		return response.data.data;
	},
};
