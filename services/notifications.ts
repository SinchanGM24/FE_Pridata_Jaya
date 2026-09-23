import apiClient from "@/lib/api-client";
import type { PaginationMeta } from "./pagination";

export interface NotificationItem {
	id: string;
	userId?: string | null;
	targetRole?: string;
	actorUserId?: string | null;
	type: string;
	title: string;
	message: string;
	isRead: boolean;
	entityType?: string;
	entityId?: string;
	priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
	category?: "ORDER" | "INVOICE" | "PAYMENT" | "DELIVERY" | "INVENTORY" | "STORE" | "RETURN" | "REPORT" | "SYSTEM";
	groupId?: string | null;
	isDigest?: boolean;
	occurrenceCount?: number;
	readAt?: string | null;
	metadata?: Record<string, unknown> | null;
	createdAt: string;
	updatedAt?: string;
}

export interface NotificationListParams {
	page?: number;
	limit?: number;
	isRead?: boolean;
	type?: string;
	priority?: NotificationItem["priority"];
	category?: NotificationItem["category"];
	groupId?: string;
	dateFrom?: string;
	dateTo?: string;
	entityType?: string;
	entityId?: string;
	eventTypes?: string[];
	actorUserId?: string;
	actorRole?: string;
	search?: string;
	onlyActionable?: boolean;
}

export interface MonitorQueueItem {
	id: string;
	label: string;
	description: string;
	count: number;
	category: NotificationItem["category"];
	priority: NotificationItem["priority"];
	filter?: Partial<NotificationListParams>;
}

export interface MonitorSummary {
	queues: MonitorQueueItem[];
	generatedAt: string;
}

export interface TransactionDocument {
	id: string;
	type: "ORDER" | "INVOICE" | "DELIVERY_ORDER" | "PAYMENT" | "RETURN";
	number: string;
	status: string;
	createdAt?: string | null;
}

export interface TransactionTimelineStep {
	id: string;
	label: string;
	state: "COMPLETED" | "ACTIVE" | "PENDING" | "CANCELLED" | "FAILED";
	occurredAt?: string | null;
	actorName?: string | null;
	actorRole?: string | null;
	description?: string | null;
	document?: TransactionDocument | null;
}

export interface TransactionTrace {
	store: { id: string; name: string; address?: string | null };
	order: TransactionDocument;
	invoice?: TransactionDocument | null;
	deliveryOrder?: TransactionDocument | null;
	payments: TransactionDocument[];
	returns: TransactionDocument[];
	totalAmount?: number | null;
	paidAmount?: number | null;
	remainingAmount?: number | null;
	timeline: TransactionTimelineStep[];
}

export interface TransactionWorkflowParams {
	page?: number;
	limit?: number;
	search?: string;
	stage?: string;
	dateFrom?: string;
	dateTo?: string;
}

export interface TransactionWorkflowResponse {
	items: TransactionTrace[];
	meta: PaginationMeta;
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
		const { page = 1, limit = 20, isRead, type, priority, category, groupId, dateFrom, dateTo, entityType, entityId, eventTypes, actorUserId, actorRole, search, onlyActionable } = params;
		const queryParams = new URLSearchParams();
		queryParams.set("page", String(page));
		queryParams.set("limit", String(limit));
		if (isRead !== undefined) queryParams.set("isRead", String(isRead));
		if (type) queryParams.set("type", type);
		if (priority) queryParams.set("priority", priority);
		if (category) queryParams.set("category", category);
		if (groupId) queryParams.set("groupId", groupId);
		if (dateFrom) queryParams.set("dateFrom", dateFrom);
		if (dateTo) queryParams.set("dateTo", dateTo);
		if (entityType) queryParams.set("entityType", entityType);
		if (entityId) queryParams.set("entityId", entityId);
		if (eventTypes?.length) queryParams.set("eventTypes", eventTypes.join(","));
		if (actorUserId) queryParams.set("actorUserId", actorUserId);
		if (actorRole) queryParams.set("actorRole", actorRole);
		if (search) queryParams.set("search", search);
		if (onlyActionable) queryParams.set("onlyActionable", "true");

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

	getMonitorSummary: async (): Promise<MonitorSummary> => {
		const response = await apiClient.get<{ data: MonitorSummary }>("/notifications/monitor/summary");
		return response.data.data;
	},

	getTransactionTrace: async (query: string): Promise<TransactionTrace> => {
		const response = await apiClient.get<{ data: TransactionTrace }>("/notifications/transaction-trace", { params: { query } });
		return response.data.data;
	},

	listTransactionWorkflows: async (params: TransactionWorkflowParams = {}): Promise<TransactionWorkflowResponse> => {
		const response = await apiClient.get<{ data: TransactionTrace[]; meta: PaginationMeta }>("/notifications/monitor/transactions", { params });
		return { items: response.data.data ?? [], meta: response.data.meta };
	},

	getTransactionWorkflow: async (rootId: string): Promise<TransactionTrace> => {
		const response = await apiClient.get<{ data: TransactionTrace }>(`/notifications/monitor/transactions/${rootId}`);
		return response.data.data;
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
