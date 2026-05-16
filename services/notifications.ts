import { apiClient } from "@/lib/api-client";
import type { PaginationMeta } from "./pagination";

export interface NotificationItem {
	id: string;
	type: string;
	title: string;
	message: string;
	isRead: boolean;
	entityType?: string;
	entityId?: string;
	createdAt: string;
}

export interface NotificationListParams {
	page?: number;
	limit?: number;
	isRead?: boolean;
	type?: string;
}

export interface NotificationListResponse {
	items: NotificationItem[];
	meta: PaginationMeta;
}

export interface UnreadCountResponse {
	count: number;
}

const notificationsService = {
	list: async (params: NotificationListParams = {}): Promise<NotificationListResponse> => {
		const { page = 1, limit = 20, isRead, type } = params;
		const queryParams = new URLSearchParams();
		queryParams.set("page", String(page));
		queryParams.set("limit", String(limit));
		if (isRead !== undefined) queryParams.set("isRead", String(isRead));
		if (type) queryParams.set("type", type);

		const response = await apiClient.get<{
			success: boolean;
			message: string;
			data: NotificationItem[];
			meta: PaginationMeta;
		}>(`/notifications?${queryParams.toString()}`);

		return {
			items: response.data.data ?? [],
			meta: response.data.meta ?? {
				currentPage: page,
				totalPages: 1,
				totalItems: response.data.data?.length ?? 0,
				itemsPerPage: limit,
			},
		};
	},

	getUnreadCount: async (): Promise<UnreadCountResponse> => {
		const response = await apiClient.get<{
			success: boolean;
			message: string;
			data: { count: number };
		}>("/notifications/unread-count");

		return { count: response.data.data?.count ?? 0 };
	},

	markAsRead: async (id: string): Promise<void> => {
		await apiClient.patch(`/notifications/${id}/read`);
	},

	markAllAsRead: async (): Promise<void> => {
		await apiClient.patch("/notifications/read-all");
	},

	delete: async (id: string): Promise<void> => {
		await apiClient.delete(`/notifications/${id}`);
	},
};

export { notificationsService };
