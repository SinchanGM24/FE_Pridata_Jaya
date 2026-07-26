import { API_BASE_URL } from "@/constants";

type EventHandler = (eventName: string, payload: unknown, rawEvent: MessageEvent) => void;

interface RealtimeClient {
	connect: () => void;
	disconnect: () => void;
	subscribe: (handler: EventHandler) => () => void;
	isConnected: () => boolean;
}

const REALTIME_TOPICS = [
	"notifications",
	"exports",
	"invoices",
	"payments",
	"receivables",
	"stocks",
	"delivery_orders",
	"shipments",
	"store_credits",
	"payment_requests",
] as const;

const DASHBOARD_REALTIME_EVENT_NAMES = [
	"payment.verified",
	"payment.cancelled",
	"payment.created",
	"payment.updated",
	"payment_request.created",
	"payment_request.updated",
	"invoice.created",
	"invoice.cancelled",
	"invoice.updated",
	"stock.adjusted",
	"stock.updated",
	"delivery_order.created",
	"delivery_order.updated",
	"delivery_order.shipped",
	"store_credit.used",
	"store_credit.created",
	"receivable.updated",
] as const;

const DASHBOARD_NOTIFICATION_ENTITY_TYPES = new Set([
	"INVOICE",
	"PAYMENT",
	"PAYMENT_REQUEST",
	"STOCK_ADJUSTMENT",
	"DELIVERY_ORDER",
	"RECEIVABLE",
	"STORE_CREDIT",
]);

const REALTIME_EVENT_NAMES = [
	"connected",
	"heartbeat",
	"notification.created",
	"exports.updated",
	...DASHBOARD_REALTIME_EVENT_NAMES,
] as const;

const DASHBOARD_REALTIME_EVENT_SET = new Set<string>(DASHBOARD_REALTIME_EVENT_NAMES);

const getPayloadEventName = (payload: unknown): string | null => {
	if (!payload || typeof payload !== "object") return null;

	const candidate = payload as Record<string, unknown>;
	const eventName = candidate.eventName ?? candidate.event ?? candidate.name ?? candidate.type;

	return typeof eventName === "string" ? eventName : null;
};

const isDashboardNotificationEvent = (eventName: string, payload?: unknown): boolean => {
	if (eventName !== "notification.created" || !payload || typeof payload !== "object") {
		return false;
	}

	const entityType = (payload as Record<string, unknown>).entityType;
	return typeof entityType === "string" && DASHBOARD_NOTIFICATION_ENTITY_TYPES.has(entityType);
};

const isDashboardRealtimeEvent = (eventName: string, payload?: unknown): boolean =>
	DASHBOARD_REALTIME_EVENT_SET.has(eventName) ||
	DASHBOARD_REALTIME_EVENT_SET.has(getPayloadEventName(payload) ?? "") ||
	isDashboardNotificationEvent(eventName, payload);

const createRealtimeClient = (baseUrl: string): RealtimeClient => {
	let eventSource: EventSource | null = null;
	const handlers: Set<EventHandler> = new Set();
	let reconnectAttempts = 0;
	let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	let isConnecting = false;

	const MAX_RECONNECT_ATTEMPTS = 5;
	const RECONNECT_BASE_DELAY = 1000;

	const clearReconnectTimeout = () => {
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}
	};

	const notifyHandlers = (eventName: string, rawEvent: MessageEvent) => {
		let payload: unknown = rawEvent.data;
		try {
			payload = JSON.parse(rawEvent.data);
		} catch {
			payload = rawEvent.data;
		}

		handlers.forEach((handler) => {
			try {
				handler(eventName, payload, rawEvent);
			} catch (err) {
				console.error("[Realtime] Handler error:", err);
			}
		});
	};

	const attachNamedListeners = () => {
		if (!eventSource) return;

		REALTIME_EVENT_NAMES.forEach((eventName) => {
			eventSource?.addEventListener(eventName, (event) => {
				notifyHandlers(eventName, event as MessageEvent);
			});
		});
	};

	const scheduleReconnect = () => {
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			console.warn("[Realtime] Max reconnect attempts reached");
			return;
		}

		const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
		reconnectAttempts++;

		console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

		reconnectTimeout = setTimeout(() => {
			connect();
		}, delay);
	};

	const connect = () => {
		if (eventSource || isConnecting) {
			return;
		}

		isConnecting = true;

		try {
			eventSource = new EventSource(`${baseUrl}/realtime/events?topics=${REALTIME_TOPICS.join(",")}`, {
				withCredentials: true,
			});

			attachNamedListeners();

			eventSource.onopen = () => {
				console.log("[Realtime] Connected");
				reconnectAttempts = 0;
				isConnecting = false;
			};

			eventSource.onmessage = (event) => {
				notifyHandlers("message", event);
			};

			eventSource.onerror = () => {
				console.warn("[Realtime] Connection unavailable; falling back to polling");
				isConnecting = false;

				if (eventSource) {
					eventSource.close();
					eventSource = null;
				}

				scheduleReconnect();
			};
		} catch (err) {
			console.error("[Realtime] Failed to create EventSource:", err);
			isConnecting = false;
			scheduleReconnect();
		}
	};

	const disconnect = () => {
		clearReconnectTimeout();
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		handlers.clear();
		reconnectAttempts = 0;
		isConnecting = false;
	};

	const subscribe = (handler: EventHandler): (() => void) => {
		handlers.add(handler);
		return () => {
			handlers.delete(handler);
		};
	};

	const isConnected = () => eventSource?.readyState === EventSource.OPEN;

	return {
		connect,
		disconnect,
		subscribe,
		isConnected,
	};
};

let realtimeClientInstance: RealtimeClient | null = null;

const getRealtimeClient = (): RealtimeClient => {
	if (!realtimeClientInstance) {
		realtimeClientInstance = createRealtimeClient(API_BASE_URL);
	}
	return realtimeClientInstance;
};

export { getRealtimeClient, createRealtimeClient, isDashboardRealtimeEvent };
export type { RealtimeClient, EventHandler };
