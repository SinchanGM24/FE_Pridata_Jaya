import { API_BASE_URL } from "@/constants";

type EventHandler = (eventName: string, payload: unknown, rawEvent: MessageEvent) => void;

interface RealtimeClient {
	connect: () => void;
	disconnect: () => void;
	subscribe: (handler: EventHandler) => () => void;
	isConnected: () => boolean;
}

// The server dispatches SSE events by topic name (backend REALTIME_TOPICS) and
// carries the specific action in `payload.event`, so dashboard filtering keys
// off the payload, not the SSE event name.
const REALTIME_EVENT_NAMES = [
	"connected",
	"heartbeat",
	"orders",
	"invoices",
	"delivery_orders",
	"shipments",
	"payments",
	"receivables",
	"stocks",
	"exports",
	"audit",
	"notifications",
	"stores",
	"suppliers",
	"returns",
	"store_credits",
	"payment_requests",
	"sales_store_assignments",
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

const DASHBOARD_REALTIME_EVENT_SET = new Set<string>(DASHBOARD_REALTIME_EVENT_NAMES);

const getPayloadEventName = (payload: unknown): string | null => {
	if (!payload || typeof payload !== "object") return null;

	const candidate = payload as Record<string, unknown>;
	const eventName = candidate.eventName ?? candidate.event ?? candidate.name ?? candidate.type;

	return typeof eventName === "string" ? eventName : null;
};

// `eventName` is the SSE event, i.e. the topic; the action lives in the payload.
const resolveActionName = (eventName: string, payload: unknown): string =>
	getPayloadEventName(payload) ?? eventName;

const isDashboardNotificationEvent = (eventName: string, payload?: unknown): boolean => {
	if (resolveActionName(eventName, payload) !== "notification.created" || !payload || typeof payload !== "object") {
		return false;
	}

	const entityType = (payload as Record<string, unknown>).entityType;
	return typeof entityType === "string" && DASHBOARD_NOTIFICATION_ENTITY_TYPES.has(entityType);
};

const isDashboardRealtimeEvent = (eventName: string, payload?: unknown): boolean =>
	DASHBOARD_REALTIME_EVENT_SET.has(resolveActionName(eventName, payload)) ||
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
// No `topics` filter: the server defaults to every topic the session's role is
			// allowed to see, so any consumer can subscribe by topic name without
			// re-opening the connection with a different topic list.
			eventSource = new EventSource(`${baseUrl}/realtime/events`, {
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
			if (handlers.size === 0) {
				disconnect();
			}
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
