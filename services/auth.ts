import apiClient from "@/lib/api-client";
import {
	setSessionCookie,
	setUserInStorage,
	clearSessionCookie,
	clearUserFromStorage,
	resolveDashboardRole,
	getSessionCookie,
	getUserFromStorage,
} from "@/lib/auth";
import type { AuthResponse, Session, UserRole } from "@/types";
import { ROLE_HOME_ROUTES } from "@/constants";

interface LoginPayload {
	username: string;
	password: string;
	role: UserRole;
}

export interface TestingAccountOption {
	id: string;
	label: string;
	username: string;
	password: string;
	role: UserRole;
	email?: string;
	systemRole?: string | null;
	organizationRole?: UserRole | null;
	storeName?: string | null;
	storeStatus?: string | null;
	source?: "default" | "owner-user" | "registered-store";
	canCheckout?: boolean;
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

interface LegacyLoginResponse {
	token: string;
	username: string;
	role: UserRole;
	expiresAt?: number;
	expiresIn?: number;
}

interface ErrorWithResponse {
	response?: {
		status?: number;
		data?: {
			message?: string;
		};
	};
}

const ORG_ROLES = [
	"superowner",
	"owner",
	"admin",
	"user",
	"fakturis",
	"invoicist",
	"gudang",
	"warehouse_staff",
	"akuntan",
	"accountant",
	"sales",
	"toko",
	"store_customer",
] as const satisfies readonly UserRole[];

const BETTER_AUTH_ROLE_ALIASES: Partial<Record<UserRole, UserRole>> = {
	invoicist: "fakturis",
	warehouse_staff: "gudang",
	accountant: "akuntan",
	store_customer: "toko",
};

const LOGIN_ROLE_TO_ORG_ROLE: Partial<Record<UserRole, UserRole>> = {
	superowner: "owner",
	fakturis: "invoicist",
	gudang: "warehouse_staff",
	akuntan: "accountant",
	toko: "store_customer",
};

function normalizeRole(value: string | null | undefined): UserRole | null {
	if (!value) return null;
	const role = value.trim();
	return ORG_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}

function toDashboardRoleAlias(role: UserRole | null | undefined): UserRole | null {
	if (!role) return null;
	return BETTER_AUTH_ROLE_ALIASES[role] ?? role;
}

function toOrganizationRole(role: UserRole | null | undefined): UserRole | null {
	if (!role) return null;
	return LOGIN_ROLE_TO_ORG_ROLE[role] ?? role;
}

const resolveLegacyMaxAge = (data: LegacyLoginResponse): number | null => {
	if (data.expiresIn && Number.isFinite(data.expiresIn)) {
		return Math.max(1, Math.floor(data.expiresIn));
	}
	if (data.expiresAt && Number.isFinite(data.expiresAt)) {
		const diff = Math.floor((data.expiresAt - Date.now()) / 1000);
		return diff > 0 ? diff : null;
	}
	return null;
};

const buildLegacyUser = (payload: LoginPayload, data: LegacyLoginResponse): AuthResponse["user"] => {
	const username = data.username || payload.username;
	return {
		id: username,
		email: username.includes("@") ? username : "",
		name: username,
		role: data.role || payload.role,
		emailVerified: true,
		organizationRole: data.role || payload.role,
	};
};

const buildBetterAuthUser = (
	user: Partial<AuthResponse["user"]> | undefined,
	payloadRole: UserRole,
	activeMemberRole?: UserRole | null,
): AuthResponse["user"] => {
	const resolvedOrganizationRole =
		toDashboardRoleAlias(activeMemberRole) ??
		toDashboardRoleAlias(toOrganizationRole(payloadRole));

	const fallbackSystemRole =
		user?.role && user.role !== "user"
			? toDashboardRoleAlias(user.role) ?? user.role
			: resolvedOrganizationRole ?? payloadRole;

	return {
		id: user?.id || user?.email || "",
		email: user?.email || "",
		name: user?.name || user?.email || "User",
		role: fallbackSystemRole as UserRole,
		emailVerified: Boolean(user?.emailVerified),
		image: user?.image,
		activeOrganizationId: user?.activeOrganizationId ?? null,
		organizationRole: resolvedOrganizationRole,
		banned: user?.banned,
		banReason: user?.banReason ?? null,
	};
};

const preserveSelectedLoginRole = (
	user: AuthResponse["user"],
	payloadRole: UserRole,
): AuthResponse["user"] => {
	const selectedRole =
		toDashboardRoleAlias(toOrganizationRole(payloadRole)) ??
		toDashboardRoleAlias(payloadRole) ??
		payloadRole;
	const sessionRole = toDashboardRoleAlias(normalizeRole(user.role) ?? user.role);
	const sessionOrganizationRole = toDashboardRoleAlias(
		normalizeRole(user.organizationRole) ?? null,
	);

	if (sessionOrganizationRole || sessionRole !== "user" || selectedRole === "user") {
		return user;
	}

	return {
		...user,
		role: selectedRole,
		organizationRole: selectedRole,
	};
};

const getErrorStatus = (error: unknown): number | undefined => {
	if (!error || typeof error !== "object") return undefined;
	return (error as ErrorWithResponse).response?.status;
};

export const authService = {
	async login(payload: LoginPayload): Promise<AuthResponse> {
		const maybeEmail = payload.username.trim().includes("@")
			? payload.username.trim().toLowerCase()
			: "";

		if (maybeEmail) {
			const response = await apiClient.post<BetterAuthSignInResponse>(
				"/auth/sign-in/email",
				{
					email: maybeEmail,
					password: payload.password,
				},
			);

			const serverSession = await this.getSession();
			if (serverSession?.user) {
				const user = preserveSelectedLoginRole(serverSession.user, payload.role);
				setUserInStorage(user);
				return {
					user,
					session: {
						...serverSession,
						user,
					},
				};
			}

			const activeMemberRole = await this.getActiveMemberRole();
			const user = buildBetterAuthUser(response.data.user, payload.role, activeMemberRole);
			setUserInStorage(user);

			return {
				user,
				session: {
					user,
					token: response.data.token,
				},
			};
		}

		try {
			const response = await apiClient.post<LegacyLoginResponse>("/auth/login", payload);
			const user = buildLegacyUser(payload, response.data);
			const maxAge = resolveLegacyMaxAge(response.data);
			if (response.data.token) {
				if (maxAge) {
					setSessionCookie(response.data.token, maxAge);
				} else {
					setSessionCookie(response.data.token);
				}
			}
			setUserInStorage(user);
			return {
				user,
				session: {
					user,
					token: response.data.token,
					expiresAt: response.data.expiresAt
						? new Date(response.data.expiresAt).toISOString()
						: undefined,
				},
			};
		} catch (legacyError: unknown) {
			if (getErrorStatus(legacyError) === 404) {
				throw new Error("Login BE2 menggunakan email akun. Pilih akun testing atau masukkan email yang terdaftar.");
			}
			throw legacyError;
		}
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
		const storedUser = getUserFromStorage();
		const storedToken = getSessionCookie();

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
				clearUserFromStorage();
				clearSessionCookie();
				return null;
			}

			const organizationRole = normalizeRole(activeMemberRoleResponse?.data?.role);
			const storedOrganizationRole = normalizeRole(storedUser?.organizationRole);
			const resolvedOrganizationRole =
				toDashboardRoleAlias(
					organizationRole ??
					normalizeRole(response.user.organizationRole) ??
					storedOrganizationRole ??
					null,
				) ?? null;
			const resolvedRole =
				resolvedOrganizationRole ??
				toDashboardRoleAlias(normalizeRole(response.user.role) ?? response.user.role) ??
				response.user.role;
			const user = {
				...response.user,
				role: resolvedRole,
				name: response.user.name || storedUser?.name || "User",
				email: response.user.email || storedUser?.email || "",
				image: response.user.image ?? storedUser?.image,
				organizationRole: resolvedOrganizationRole,
			};

			return {
				...response.session,
				user,
			};
		} catch (error: unknown) {
			if (getErrorStatus(error) === 401) {
				clearUserFromStorage();
				clearSessionCookie();
				return null;
			}

			return storedUser
				? {
					user: storedUser,
					token: storedToken ?? undefined,
				}
				: null;
		}
	},

	async getTestingAccounts(): Promise<TestingAccountOption[]> {
		try {
			const response = await apiClient.get<
				TestingAccountOption[] | { data: TestingAccountOption[] }
			>("/auth/testing-accounts");
			const rows = Array.isArray(response.data)
				? response.data
				: response.data?.data ?? [];
			return rows.map((row) => ({
				...row,
				username: row.username || row.email || "",
			}));
		} catch {
			try {
				const response = await apiClient.get<
					TestingAccountOption[] | { data: TestingAccountOption[] }
				>("/testing-accounts");
				const rows = Array.isArray(response.data)
					? response.data
					: response.data?.data ?? [];
				return rows.map((row) => ({
					...row,
					username: row.username || row.email || "",
				}));
			} catch {
				return [];
			}
		}
	},

	getHomeRoute(user: AuthResponse["user"]): string {
		const effectiveRole = resolveDashboardRole(user);
		return (effectiveRole && ROLE_HOME_ROUTES[effectiveRole]) ?? "/dashboard";
	},

	async verifyEmail(token: string): Promise<boolean> {
		return Boolean(token) && false;
	},

	async resetPassword(email: string): Promise<boolean> {
		try {
			await apiClient.post("/auth/forget-password", {
				email,
			});
			return true;
		} catch {
			return false;
		}
	},

	async changePassword(payload: {
		currentPassword: string;
		newPassword: string;
		revokeOtherSessions?: boolean;
	}): Promise<boolean> {
		try {
			await apiClient.post("/auth/change-password", {
				currentPassword: payload.currentPassword,
				newPassword: payload.newPassword,
				revokeOtherSessions: payload.revokeOtherSessions ?? false,
			});
			return true;
		} catch {
			return false;
		}
	},

	async getActiveMemberRole(): Promise<UserRole | null> {
		try {
			const response = await apiClient.get<BetterAuthActiveMemberRoleResponse>(
				"/auth/organization/get-active-member-role",
			);
			return toDashboardRoleAlias(normalizeRole(response.data.role));
		} catch {
			return null;
		}
	},
};
