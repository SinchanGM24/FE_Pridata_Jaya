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
	// Use raw axios to avoid re-triggering the interceptor
	await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
		withCredentials: true,
	});
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

// Request interceptor to add auth token
apiClient.interceptors.request.use(
	(config) => {
		// Get token from cookies if available
		const token = getCookie(COOKIE_NAME_SESSION);
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

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
			requestUrl.includes("/auth/sign-out");
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
				// Retry the original request with a fresh config (avoid stale headers)
				const retryConfig = { ...error.config };
				delete retryConfig.headers?.Authorization;
				const response = await apiClient(retryConfig);
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
		}).then(() => {
			const retryConfig = { ...error.config };
			delete retryConfig.headers?.Authorization;
			return apiClient(retryConfig);
		});
	},
);

export default apiClient;

// Cookie utilities
function getCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
	return null;
}

function deleteCookie(name: string): void {
	if (typeof document === "undefined") return;
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
