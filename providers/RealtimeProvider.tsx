"use client";

import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { subscribeRealtime } from "@/services/realtime";
import type { RealtimeEvent } from "@/types/notification";

/**
 * RealtimeProvider — single SSE connection per browser tab.
 *
 * Why a provider: opening a new EventSource in every component that wants
 * realtime updates would multiply BE connections per tab. This provider
 * subscribes once and broadcasts events through a Set of listeners.
 *
 * Boundary: the provider knows nothing about notification semantics; it
 * only wires SSE → React context. Consumers decide what to do with each
 * event (increment unread, show toast, refetch list, etc.).
 *
 * Mounted at `app/(dashboard)/layout.tsx` so all dashboard pages share one
 * connection. Public/marketing pages do not include this provider.
 */

type Listener = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
	/** Register a listener; returns an unsubscribe function. */
	subscribe: (cb: Listener) => () => void;
	/** True between SSE `onopen` and the next `onerror`. */
	connected: boolean;
	/** True once the subscriber gives up (e.g. repeated handshake failures). */
	givenUp: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const DEFAULT_TOPICS = ["notifications"];

export function RealtimeProvider({
	children,
	topics = DEFAULT_TOPICS,
}: {
	children: ReactNode;
	topics?: string[];
}) {
	const listeners = useRef<Set<Listener>>(new Set());
	const [connected, setConnected] = useState(false);
	const [givenUp, setGivenUp] = useState(false);

	useEffect(() => {
		const unsub = subscribeRealtime(topics, {
			onOpen: () => {
				setConnected(true);
				setGivenUp(false);
			},
			onError: () => setConnected(false),
			onGivingUp: () => {
				setConnected(false);
				setGivenUp(true);
			},
			onEvent: (event) => {
				// Snapshot listeners to avoid mutation during iteration.
				for (const cb of Array.from(listeners.current)) {
					try {
						cb(event);
					} catch {
						/* one bad listener should not block others */
					}
				}
			},
		});
		return unsub;
		// topics is treated as stable per provider mount; if a caller wants to
		// change topics they should remount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const subscribe = (cb: Listener) => {
		listeners.current.add(cb);
		return () => {
			listeners.current.delete(cb);
		};
	};

	return (
		<RealtimeContext.Provider value={{ subscribe, connected, givenUp }}>
			{children}
		</RealtimeContext.Provider>
	);
}

export function useRealtime(): RealtimeContextValue {
	const ctx = useContext(RealtimeContext);
	if (!ctx) {
		// Graceful fallback when consumer renders outside the provider
		// (e.g. during loading state before role resolution). Returns
		// a no-op subscribe so hooks can still mount without crashing.
		return {
			subscribe: () => () => {},
			connected: false,
			givenUp: false,
		};
	}
	return ctx;
}
