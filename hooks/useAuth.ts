"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";
import {
	AUTH_USER_STORAGE_KEY,
	AUTH_USER_UPDATED_EVENT,
	clearUserFromStorage,
	setUserInStorage,
} from "@/lib/auth";
import { authService } from "@/services/auth";
import { API_BASE_URL } from "@/constants";

// B1.6: proactive token refresh interval (50 min = 3_000_000 ms)
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;

function proactiveRefresh(): void {
	// Fire-and-forget; interceptor handles failure
	fetch(`${API_BASE_URL}/auth/refresh`, {
		method: "POST",
		credentials: "include",
	}).catch(() => {
		/* best-effort — 401 interceptor will handle failure */
	});
}

export function useAuth() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const bootstrapSession = async () => {
			try {
				const session = await authService.getSession();
				if (!mounted) return;

				if (session?.user) {
					setUserInStorage(session.user);
					setUser(session.user);
				} else {
					clearUserFromStorage();
					setUser(null);
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		};

		void bootstrapSession();

		const handleUserUpdated = (event: Event) => {
			const customEvent = event as CustomEvent<User | null>;
			setUser(customEvent.detail ?? null);
		};

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== AUTH_USER_STORAGE_KEY) return;
			if (!event.newValue) {
				setUser(null);
				return;
			}

			try {
				setUser(JSON.parse(event.newValue) as User);
			} catch {
				setUser(null);
			}
		};

		window.addEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated as EventListener);
		window.addEventListener("storage", handleStorage);

		// B1.6: proactive refresh — keep session alive
		const refreshTimer = setInterval(proactiveRefresh, REFRESH_INTERVAL_MS);
		// Fire one refresh shortly after mount to ensure session is fresh
		const initialRefresh = setTimeout(proactiveRefresh, 5_000);

		return () => {
			mounted = false;
			clearInterval(refreshTimer);
			clearTimeout(initialRefresh);
			window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated as EventListener);
			window.removeEventListener("storage", handleStorage);
		};
	}, []);

	return {
		user,
		setUser,
		loading,
		isAuthenticated: !!user,
	};
}
