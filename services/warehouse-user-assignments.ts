import apiClient from "@/lib/api-client";

interface ApiSuccessResponse<T> {
	message?: string;
	data: T;
}

interface PaginatedApiResponse<T> {
	success: boolean;
	message: string;
	data: T[];
	meta: {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		itemsPerPage: number;
	};
}

export interface WarehouseAssignment {
	id: string;
	userId: string;
	warehouseId: string;
	assignedAt: string;
	isActive: boolean;
	notes?: string | null;
	assignedByUserId?: string | null;
	deactivatedAt?: string | null;
	user?: {
		id: string;
		name: string;
		email: string;
	};
	warehouse?: {
		id: string;
		name: string;
		city?: { id: string; name: string };
	};
}

export interface AssignWarehousePayload {
	userId: string;
	warehouseId: string;
	notes?: string;
}

export const warehouseAssignmentService = {
	async getMyAssignment(): Promise<WarehouseAssignment | null> {
		try {
			const response = await apiClient.get<ApiSuccessResponse<WarehouseAssignment>>(
				"/warehouse-user-assignments/me",
			);
			return response.data.data ?? null;
		} catch {
			return null;
		}
	},

	async getForUser(userId: string): Promise<WarehouseAssignment | null> {
		try {
			const response = await apiClient.get<ApiSuccessResponse<WarehouseAssignment>>(
				`/warehouse-user-assignments/user/${userId}`,
			);
			return response.data.data ?? null;
		} catch {
			return null;
		}
	},

	async getAll(params?: {
		page?: number;
		limit?: number;
		warehouseId?: string;
		isActive?: boolean;
	}): Promise<{ items: WarehouseAssignment[]; meta?: PaginatedApiResponse<WarehouseAssignment>["meta"] }> {
		const response = await apiClient.get<PaginatedApiResponse<WarehouseAssignment>>(
			"/warehouse-user-assignments",
			{ params },
		);
		return { items: response.data.data, meta: response.data.meta };
	},

	async assign(payload: AssignWarehousePayload): Promise<WarehouseAssignment> {
		const response = await apiClient.post<ApiSuccessResponse<WarehouseAssignment>>(
			"/warehouse-user-assignments",
			payload,
		);
		return response.data.data;
	},

	async revoke(id: string): Promise<WarehouseAssignment> {
		const response = await apiClient.delete<ApiSuccessResponse<WarehouseAssignment>>(
			`/warehouse-user-assignments/${id}`,
		);
		return response.data.data;
	},
};
