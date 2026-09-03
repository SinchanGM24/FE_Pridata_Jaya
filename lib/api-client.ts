"use client";

import axios, { AxiosInstance } from "axios";
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

// Response interceptor: auto-refresh on 401, then retry
apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
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
