import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";
import type {
	Notification,
	NotificationListResponse,
	UnreadCountResponse,
} from "@/types/notification";

/**
 * Pure REST transport for notification endpoints.
 *
 * Boundary: this service has no SSE awareness. It speaks HTTP and returns
 * typed payloads. Realtime updates are wired separately via
 * `services/realtime.ts` and merged in `hooks/useNotifications.ts`.
 *
 * BE routes (RBAC: owner, accountant) — see `src/routes/notification.routes.ts`.
 */
export const notificationsService = {
	async list(
		params: {
			page?: number;
			limit?: number;
			isRead?: boolean;
			type?: string;
			dateFrom?: string;
			dateTo?: string;
		} = {}
	): Promise<NotificationListResponse> {
		const res = await apiClient.get<NotificationListResponse>(
			"/notifications",
			{ params }
		);
		return res.data;
	},

	async unreadCount(): Promise<number> {
		const res = await apiClient.get<UnreadCountResponse>(
			"/notifications/unread-count"
		);
		return res.data.data?.count ?? 0;
	},

	async markRead(id: string): Promise<Notification> {
		const res = await apiClient.patch<ApiResponse<Notification>>(
			`/notifications/${id}/read`
		);
		// API envelope is { data: Notification }
		return res.data.data as Notification;
	},

	async markAllRead(): Promise<void> {
		await apiClient.patch("/notifications/read-all");
	},

	async remove(id: string): Promise<void> {
		await apiClient.delete(`/notifications/${id}`);
	},
};
