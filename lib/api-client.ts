"use client";

import axios, { AxiosInstance } from "axios";
import { API_BASE_URL, COOKIE_NAME_SESSION } from "@/constants";
import { clearSessionCookie, clearUserFromStorage } from "@/lib/auth";

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

// Response interceptor to handle errors
apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			if (typeof window !== "undefined") {
				const requestUrl = String(error.config?.url || "");
				const isAuthBootstrapRequest =
					requestUrl.includes("/auth/get-session") ||
					requestUrl.includes("/auth/organization/get-active-member-role");
				const isInteractiveAuthRequest =
					requestUrl.includes("/auth/sign-in/email") ||
					requestUrl.includes("/auth/login") ||
					requestUrl.includes("/auth/sign-out");

				clearSessionCookie();
				clearUserFromStorage();
				deleteCookie(COOKIE_NAME_SESSION);

				if (
					!isAuthBootstrapRequest &&
					!isInteractiveAuthRequest &&
					window.location.pathname !== "/login"
				) {
					window.location.replace("/login");
				}
			}
		}
		return Promise.reject(error);
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
