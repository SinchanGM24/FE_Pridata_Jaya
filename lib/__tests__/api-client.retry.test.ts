import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import apiClient from "../api-client";

const timeout = (config: InternalAxiosRequestConfig) =>
	Promise.reject(new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED", config));
const ok = (config: InternalAxiosRequestConfig) =>
	Promise.resolve({ data: { ok: true }, status: 200, statusText: "OK", headers: {}, config });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("GET di-retry sekali setelah timeout", async () => {
	const adapter = vi.fn<AxiosAdapter>().mockImplementationOnce(timeout).mockImplementationOnce(ok);
	const request = apiClient.get("/products", { adapter });
	await vi.advanceTimersByTimeAsync(1000);
	await expect(request).resolves.toMatchObject({ data: { ok: true } });
	expect(adapter).toHaveBeenCalledTimes(2);
});

test("GET menyerah setelah satu retry", async () => {
	const adapter = vi.fn<AxiosAdapter>().mockImplementation(timeout);
	const request = apiClient.get("/products", { adapter });
	const assertion = expect(request).rejects.toMatchObject({ code: "ECONNABORTED" });
	await vi.advanceTimersByTimeAsync(1000);
	await assertion;
	expect(adapter).toHaveBeenCalledTimes(2);
});

test("POST tanpa Idempotency-Key tidak di-retry", async () => {
	const adapter = vi.fn<AxiosAdapter>().mockImplementation(timeout);
	await expect(apiClient.post("/products", {}, { adapter })).rejects.toBeTruthy();
	expect(adapter).toHaveBeenCalledTimes(1);
});

test("GET 404 tidak di-retry", async () => {
	const notFound = (config: InternalAxiosRequestConfig) => Promise.reject(new AxiosError("nf", "ERR_BAD_REQUEST", config, undefined,
		{ data: {}, status: 404, statusText: "", headers: {}, config }));
	const adapter = vi.fn<AxiosAdapter>().mockImplementation(notFound);
	await expect(apiClient.get("/products/x", { adapter })).rejects.toBeTruthy();
	expect(adapter).toHaveBeenCalledTimes(1);
});
