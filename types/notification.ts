/**
 * Notification + realtime event wire shapes.
 *
 * Mirrors the BE Prisma `Notification` model (prisma/schema.prisma) and the
 * SSE event envelope used by `/api/v1/realtime/events`.
 *
 * Shared by `services/notifications.ts`, `services/realtime.ts`,
 * `hooks/useNotifications.ts`, and the notification UI components.
 */

export type EntityType =
	| "order"
	| "invoice"
	| "payment"
	| "payment_request"
	| "delivery_order"
	| "shipment"
	| "receivable"
	| "export"
	| "stock_adjustment"
	| "return"
	| "audit_log"
	// Allow forward-compatible unknown types from BE without TS friction.
	| (string & {});

export interface Notification {
	id: string;
	userId: string | null;
	targetRole: string;
	type: string;
	title: string;
	message: string;
	entityType: EntityType | null;
	entityId: string | null;
	metadata: Record<string, unknown> | null;
	isRead: boolean;
	readAt: string | null;
	createdAt: string;
}

export interface NotificationListResponse {
	data: Notification[];
	meta: {
		page: number;
		limit: number;
		total: number;
	};
}

export interface UnreadCountResponse {
	data: {
		count: number;
	};
}

export interface RealtimeEvent<T = unknown> {
	id: string;
	event: string; // e.g. 'notification.created', 'payment.verified', 'message'
	data: T;
}
