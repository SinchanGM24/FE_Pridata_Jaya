import type { EntityType } from "@/types/notification";

/**
 * entityType → in-app URL builder.
 *
 * This is the single source of truth for "where to redirect when user clicks
 * a notification". Adding a new BE entityType = add one row here, no UI
 * changes (Open/Closed).
 *
 * Returns null when:
 * - entityType is null (notification has no associated entity)
 * - entityType is unknown (forward-compat with future BE additions; UI
 *   silently keeps dropdown open after mark-read)
 */
const TABLE: Record<string, (id: string) => string> = {
	order: (id) => `/orders/${id}`,
	invoice: (id) => `/invoices/${id}`,
	payment: (id) => `/payments/${id}`,
	payment_request: (id) => `/payment-requests/${id}`,
	delivery_order: (id) => `/delivery-orders/${id}`,
	shipment: (id) => `/shipments/${id}`,
	receivable: (id) => `/receivables/${id}`,
	return: (id) => `/returns/${id}`,
	stock_adjustment: (id) => `/stock-adjustments/${id}`,
	audit_log: (id) => `/audit-logs/${id}`,
	export: () => `/exports`,
};

export function resolveNotificationRoute(
	entityType: EntityType | null,
	entityId: string | null
): string | null {
	if (!entityType) return null;
	const builder = TABLE[entityType as string];
	if (!builder) return null;
	return builder(entityId ?? "");
}
