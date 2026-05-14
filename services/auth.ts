import apiClient from "@/lib/api-client";
import {
	setSessionCookie,
	setUserInStorage,
	clearSessionCookie,
	clearUserFromStorage,
	resolveDashboardRole,
} from "@/lib/auth";
import type { AuthResponse, Session, UserRole } from "@/types";
import { ROLE_HOME_ROUTES } from "@/constants";

interface LoginPayload {
	email: string;
	password: string;
}

export interface TestingAccountOption {
	id: string;
	label: string;
	email: string;
	password: string;
	role: UserRole;
	systemRole?: string | null;
	organizationRole?: UserRole | null;
	storeName?: string | null;
	storeStatus?: string | null;
}

interface BetterAuthSignInResponse {
	redirect?: boolean;
	token?: string;
	user: AuthResponse["user"];
}

interface BetterAuthGetSessionResponse {
	session: Session;
	user: AuthResponse["user"];
}

interface BetterAuthActiveMemberRoleResponse {
	role: string;
}

const ORG_ROLES = [
	"owner",
	"admin",
	"user",
	"invoicist",
	"warehouse_staff",
	"accountant",
	"sales",
	"store_customer",
] as const satisfies readonly UserRole[];

function normalizeRole(value: string | null | undefined): UserRole | null {
	if (!value) return null;
	const role = value.trim();
	return ORG_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}

export const authService = {
	async login(payload: LoginPayload): Promise<AuthResponse> {
		const response = await apiClient.post<BetterAuthSignInResponse>(
			"/auth/sign-in/email",
			payload,
		);

		// Prefer server session (cookie-based) when available
		const serverSession = await this.getSession();
		if (serverSession) {
			setUserInStorage(serverSession.user);
			if (serverSession.token) {
				setSessionCookie(serverSession.token);
			}
			return {
				user: serverSession.user,
				session: serverSession,
			};
		}

		// Fallback to sign-in payload when get-session is unavailable
		setUserInStorage(response.data.user);
		if (response.data.token) {
			setSessionCookie(response.data.token);
		}
		return {
			user: response.data.user,
			session: {
				user: response.data.user,
				token: response.data.token,
			},
		};
	},

	async logout(): Promise<void> {
		try {
			await apiClient.post("/auth/sign-out");
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			// Clear local storage and cookies regardless of API response
			clearSessionCookie();
			clearUserFromStorage();
		}
	},

	async getSession(): Promise<Session | null> {
		try {
			const [{ data: response }, activeMemberRoleResponse] = await Promise.all([
				apiClient.get<BetterAuthGetSessionResponse>("/auth/get-session"),
				apiClient
					.get<BetterAuthActiveMemberRoleResponse>(
						"/auth/organization/get-active-member-role",
					)
					.catch(() => null),
			]);

			if (!response?.session || !response?.user) {
				return null;
			}

			const organizationRole = normalizeRole(activeMemberRoleResponse?.data?.role);
			const user = {
				...response.user,
				organizationRole: organizationRole ?? response.user.organizationRole ?? null,
			};

			return {
				...response.session,
				user,
			};
		} catch (error) {
			return null;
		}
	},

	async getTestingAccounts(): Promise<TestingAccountOption[]> {
		try {
			const response = await apiClient.get<{ data: TestingAccountOption[] }>(
				"/testing-accounts",
			);
			return response.data.data ?? [];
		} catch {
			return [];
		}
	},

	getHomeRoute(user: AuthResponse["user"]): string {
		const effectiveRole = resolveDashboardRole(user);
		return (effectiveRole && ROLE_HOME_ROUTES[effectiveRole]) ?? "/dashboard";
	},

	async verifyEmail(_token: string): Promise<{ supported: false; reason: string }> {
		// Backend does not yet expose an email verification endpoint.
		// Return an explicit unsupported state so the UI can surface a real message
		// instead of a fake success/failure boolean.
		return {
			supported: false,
			reason: "EMAIL_VERIFICATION_NOT_IMPLEMENTED",
		};
	},

	async resetPassword(email: string): Promise<void> {
		// Delegates to Better Auth /auth/forget-password. Throws on transport/HTTP
		// failure so callers can show real error feedback instead of swallowing it.
		await apiClient.post("/auth/forget-password", { email });
	},
};
