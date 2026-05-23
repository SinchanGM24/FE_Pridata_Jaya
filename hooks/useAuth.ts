"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";
import {
	AUTH_USER_STORAGE_KEY,
	AUTH_USER_UPDATED_EVENT,
	clearUserFromStorage,
	getUserFromStorage,
	setUserInStorage,
} from "@/lib/auth";
import { authService } from "@/services/auth";

export function useAuth() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const bootstrapSession = async () => {
			const storedUser = getUserFromStorage();
			if (storedUser && mounted) {
				setUser(storedUser);
			}

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

		return () => {
			mounted = false;
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
