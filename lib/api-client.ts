"use client";

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, COOKIE_NAME_SESSION } from "@/constants";
import { clearSessionCookie, clearUserFromStorage } from "@/lib/auth";

// --- B1.5: auto-refresh on 401 ---
let isRefreshing = false;
let failedQueue: Array<{
	resolve: (value?: unknown) => void;
	reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown) {
	failedQueue.forEach((prom) => {
		if (error) prom.reject(error);
		else prom.resolve();
	});
	failedQueue = [];
}

async function attemptRefresh(): Promise<void> {
	// Use raw axios to avoid re-triggering the interceptor.
	// There is no dedicated refresh endpoint — GET /auth/get-session extends
	// the session cookie when called within Better Auth's updateAge window.
	const { data } = await axios.get(`${API_BASE_URL}/auth/get-session`, {
		withCredentials: true,
	});
	if (!data?.session || !data?.user) {
		throw new Error("No active session");
	}
}

function handleAuthFailure() {
	if (typeof window === "undefined") return;
	clearSessionCookie();
	clearUserFromStorage();
	deleteCookie(COOKIE_NAME_SESSION);
	if (window.location.pathname !== "/login") {
		window.location.replace("/login");
	}
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	timeout: 10000,
	withCredentials: true, // Include cookies in requests
});

// Tidak ada interceptor Authorization di sini. Sesi dibawa oleh cookie
// `better-auth.session_token` yang ber-HttpOnly dan terkirim otomatis lewat
// `withCredentials`. Interceptor lama membaca cookie itu dari `document.cookie`
// dan memasangnya sebagai `Bearer` — mustahil berhasil, karena HttpOnly berarti
// JS tidak pernah melihat nilainya.

const REQUEST_ID_HEADER = "X-Request-Id";

// crypto.randomUUID hanya ada di secure context; di http:// non-localhost tidak.
function newRequestId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Menyambungkan jejak FE -> BE: backend memakai header ini sebagai requestId di
// setiap baris log untuk request tersebut, jadi satu aksi user bisa ditelusuri
// lintas layer tanpa menebak dari timestamp.
apiClient.interceptors.request.use((config) => {
	if (!config.headers[REQUEST_ID_HEADER]) {
		config.headers[REQUEST_ID_HEADER] = newRequestId();
	}
	return config;
});

const IDEMPOTENCY_HEADER = "Idempotency-Key";
const MAX_IDEMPOTENT_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/** Request config for a create call that the backend deduplicates by key. */
export function withIdempotencyKey(key: string): AxiosRequestConfig {
	return { headers: { [IDEMPOTENCY_HEADER]: key } };
}

type RetryableConfig = InternalAxiosRequestConfig & { idempotentRetries?: number };

// Only a request carrying an Idempotency-Key is safe to resend blindly: if the
// first attempt did commit before the connection dropped, the backend returns
// that row instead of creating a second one.
function shouldRetryIdempotent(error: AxiosError): error is AxiosError & { config: RetryableConfig } {
	const config = error.config as RetryableConfig | undefined;
	if (!config?.headers?.[IDEMPOTENCY_HEADER] || axios.isCancel(error)) return false;
	if ((config.idempotentRetries ?? 0) >= MAX_IDEMPOTENT_RETRIES) return false;
	return !error.response || RETRYABLE_STATUSES.has(error.response.status);
}

// Response interceptor: resend idempotent creates on network failure, auto-refresh on 401
apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		if (shouldRetryIdempotent(error)) {
			const attempt = (error.config.idempotentRetries ?? 0) + 1;
			error.config.idempotentRetries = attempt;
			await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
			return apiClient(error.config);
		}

		if (error.response?.status !== 401 || typeof window === "undefined") {
			return Promise.reject(error);
		}

		const requestUrl = String(error.config?.url || "");
		const isAuthBootstrapRequest =
			requestUrl.includes("/auth/get-session") ||
			requestUrl.includes("/auth/organization/get-active-member-role");
		const isInteractiveAuthRequest =
			requestUrl.includes("/auth/sign-in/email") ||
			requestUrl.includes("/auth/sign-out") ||
			requestUrl.includes("/password-reset-requests") ||
			requestUrl.includes("/password-reset-confirmations");
		const isRefreshRequest = requestUrl.includes("/auth/refresh");

		// Never try to refresh a refresh call itself or auth-boot requests
		if (isAuthBootstrapRequest || isInteractiveAuthRequest || isRefreshRequest) {
			handleAuthFailure();
			return Promise.reject(error);
		}

		if (!isRefreshing) {
			isRefreshing = true;
			try {
				await attemptRefresh();
				processQueue(null);
				const response = await apiClient({ ...error.config });
				return response;
			} catch (refreshError) {
				processQueue(refreshError);
				handleAuthFailure();
				return Promise.reject(refreshError);
			} finally {
				isRefreshing = false;
			}
		}

		// Already refreshing — queue this request
		return new Promise((resolve, reject) => {
			failedQueue.push({ resolve, reject });
		}).then(() => apiClient({ ...error.config }));
	},
);

export default apiClient;

// Best-effort saja: cookie sesi ber-HttpOnly sehingga baris ini tidak bisa
// menghapusnya. Pencabutan yang sesungguhnya terjadi di POST /auth/sign-out.
function deleteCookie(name: string): void {
	if (typeof document === "undefined") return;
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
