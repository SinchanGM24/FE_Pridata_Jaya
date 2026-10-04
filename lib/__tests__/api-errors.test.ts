import { AxiosError } from "axios";
import { expect, test } from "vitest";
import { getApiErrorMessage } from "../api-errors";

test("timeout menjadi pesan yang bisa dibaca", () => {
	const error = new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED");
	expect(getApiErrorMessage(error, "x")).toBe("Server terlalu lama merespons. Periksa koneksi lalu coba lagi.");
});

test("gagal jaringan menjadi pesan yang bisa dibaca", () => {
	const error = new AxiosError("Network Error", "ERR_NETWORK");
	expect(getApiErrorMessage(error, "x")).toBe("Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.");
});

test("pesan dari server tetap menang", () => {
	const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
		data: { message: "Produk tidak ditemukan" }, status: 404, statusText: "", headers: {}, config: {} as never,
	});
	expect(getApiErrorMessage(error, "x")).toBe("Produk tidak ditemukan");
});
