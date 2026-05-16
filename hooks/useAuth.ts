"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";
import { clearUserFromStorage, getUserFromStorage, setUserInStorage } from "@/lib/auth";
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

		return () => {
			mounted = false;
		};
	}, []);

	return {
		user,
		setUser,
		loading,
		isAuthenticated: !!user,
	};
}
