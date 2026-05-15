import { API_BASE_URL } from "@/constants";
import type { RealtimeEvent } from "@/types/notification";

/**
 * Pure SSE subscriber for `/api/v1/realtime/events`.
 *
 * Boundary: this module knows nothing about notification semantics.
 * Callers register handlers; reconnect-with-backoff is internal.
 *
 * BE route (RBAC: owner, accountant, warehouse_staff, invoicist):
 *   GET /api/v1/realtime/events?topics=topic1,topic2
 *
 * Auth: cookies. EventSource sets `withCredentials: true` so Better Auth
 * cookies flow. BE CORS already allows credentials (verified Task 1.0a).
 */
export interface RealtimeHandlers {
	onEvent?: (event: RealtimeEvent) => void;
	onOpen?: () => void;
	onError?: (err: Event) => void;
	/**
	 * Fired once when the subscriber gives up reconnecting (e.g. repeated
	 * 4xx handshake failures). Caller should fall back to polling-only.
	 */
	onGivingUp?: () => void;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;
/**
 * If we hit MAX_FAST_FAILURES errors faster than FAST_FAILURE_WINDOW_MS
 * apart, treat it as auth failure and stop reconnecting.
 */
const MAX_FAST_FAILURES = 4;
const FAST_FAILURE_WINDOW_MS = 5_000;

export function subscribeRealtime(
	topics: string[],
	handlers: RealtimeHandlers
): () => void {
	let es: EventSource | null = null;
	let backoff = INITIAL_BACKOFF_MS;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;
	let givingUp = false;
	let fastFailures = 0;
	let lastFailureAt = 0;

	const open = () => {
		if (stopped || givingUp) return;
		const url = `${API_BASE_URL}/realtime/events?topics=${encodeURIComponent(
			topics.join(",")
		)}`;
		es = new EventSource(url, { withCredentials: true });

		es.onopen = () => {
			backoff = INITIAL_BACKOFF_MS;
			fastFailures = 0;
			handlers.onOpen?.();
		};

		es.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data);
				handlers.onEvent?.({
					id: e.lastEventId,
					event: e.type,
					data: payload,
				});
			} catch {
				/* ignore malformed payload */
			}
		};

		es.onerror = (err) => {
			handlers.onError?.(err);
			es?.close();
			es = null;

			const now = Date.now();
			if (now - lastFailureAt < FAST_FAILURE_WINDOW_MS) {
				fastFailures += 1;
			} else {
				fastFailures = 1;
			}
			lastFailureAt = now;

			if (fastFailures >= MAX_FAST_FAILURES) {
				givingUp = true;
				handlers.onGivingUp?.();
				return;
			}

			timer = setTimeout(open, backoff);
			backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
		};
	};

	const onOnline = () => {
		if (!es && !stopped && !givingUp) open();
	};

	if (typeof window !== "undefined") {
		window.addEventListener("online", onOnline);
	}
	open();

	return () => {
		stopped = true;
		if (timer) clearTimeout(timer);
		if (typeof window !== "undefined") {
			window.removeEventListener("online", onOnline);
		}
		es?.close();
	};
}
