"use client";

import { COOKIE_NAME_SESSION } from "@/constants";
import type { DashboardRole, Session, User, UserRole } from "@/types";

export function getSessionCookie(): string | null {
	if (typeof document === "undefined") return null;
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${COOKIE_NAME_SESSION}=`);
	if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
	return null;
}

export function setSessionCookie(
	token: string,
	maxAge: number = 7 * 24 * 60 * 60,
): void {
	if (typeof document === "undefined") return;
	const date = new Date();
	date.setTime(date.getTime() + maxAge * 1000);
	document.cookie = `${COOKIE_NAME_SESSION}=${token}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
}

export function clearSessionCookie(): void {
	if (typeof document === "undefined") return;
	document.cookie = `${COOKIE_NAME_SESSION}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function getUserFromStorage(): User | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const user = localStorage.getItem("auth_user");
		return user ? JSON.parse(user) : null;
	} catch {
		return null;
	}
}

export function setUserInStorage(user: User): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem("auth_user", JSON.stringify(user));
}

export function clearUserFromStorage(): void {
	if (typeof localStorage === "undefined") return;
	localStorage.removeItem("auth_user");
}

export function canAccessRoute(
	userRole: UserRole,
	requiredRoles: UserRole[],
): boolean {
	return requiredRoles.includes(userRole);
}

export function resolveEffectiveRole(user: User | null): UserRole | null {
	if (!user) return null;
	if (user.role === "admin") return "admin";
	return user.organizationRole ?? user.role ?? null;
}

export function resolveDashboardRole(user: User | null): DashboardRole | null {
	const effectiveRole = resolveEffectiveRole(user);

	switch (effectiveRole) {
		case "admin":
			return "superowner";
		case "owner":
			return "owner";
		case "invoicist":
			return "fakturis";
		case "warehouse_staff":
			return "gudang";
		case "accountant":
			return "akuntan";
		case "sales":
			return "sales";
		case "store_customer":
			return "toko";
		default:
			return null;
	}
}
