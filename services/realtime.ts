import { API_BASE_URL } from "@/constants";

type EventHandler = (event: MessageEvent) => void;

interface RealtimeClient {
	connect: () => void;
	disconnect: () => void;
	subscribe: (handler: EventHandler) => () => void;
	isConnected: () => boolean;
}

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
			eventSource = new EventSource(`${baseUrl}/realtime/events?topics=notifications,exports`, {
				withCredentials: true,
			});

			eventSource.onopen = () => {
				console.log("[Realtime] Connected");
				reconnectAttempts = 0;
				isConnecting = false;
			};

			eventSource.onmessage = (event) => {
				handlers.forEach((handler) => {
					try {
						handler(event);
					} catch (err) {
						console.error("[Realtime] Handler error:", err);
					}
				});
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

export { getRealtimeClient, createRealtimeClient };
export type { RealtimeClient, EventHandler };
