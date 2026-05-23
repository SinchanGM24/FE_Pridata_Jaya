import apiClient from "@/lib/api-client";
import { collectPaginatedItems } from "@/services/pagination";
import type { User, UserRole } from "@/types";

export interface PaginatedResponse<T> {
	data: T[];
	pagination?: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

interface ApiSuccessResponse<T> {
	message?: string;
	data: T;
	pagination?: PaginatedResponse<T> extends PaginatedResponse<infer U>
		? PaginatedResponse<U>["pagination"]
		: never;
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

type UserListApiResponse = ApiSuccessResponse<User[]> & {
	pagination?: PaginatedResponse<User>["pagination"];
};

export const usersService = {
	async list(params?: {
		page?: number;
		limit?: number;
		q?: string;
	}): Promise<{ users: User[]; pagination?: PaginatedResponse<User>["pagination"] }> {
		const response = await apiClient.get<UserListApiResponse>("/users", {
			params,
		});
		return {
			users: response.data.data,
			pagination: response.data.pagination,
		};
	},

	async listAll(params?: { q?: string }): Promise<User[]> {
		return collectPaginatedItems(
			async (page, limit) => {
				const result = await this.list({
					...(params || {}),
					page,
					limit,
				});
				return {
					items: result.users,
					meta: result.pagination
						? {
								currentPage: result.pagination.page,
								totalPages: result.pagination.totalPages,
								totalItems: result.pagination.total,
								itemsPerPage: result.pagination.limit,
							}
						: undefined,
				};
			},
			100,
		);
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
		await apiClient.post("/auth/admin/set-user-password", {
			userId: id,
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
