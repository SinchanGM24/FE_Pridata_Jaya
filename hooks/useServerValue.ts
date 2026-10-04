"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import { logError } from "@/lib/log";

/**
 * Satu nilai dari server (angka headline, data detail) yang dimuat ulang tiap `key` berubah.
 * Kontrak sama dengan `usePagedList`: SEMUA input fetch masuk ke `key`, dan `errorMessage` stabil.
 * Gagal → `data` null (tampil "—", bukan angka filter lain). Respons basi dibuang.
 */
export function useServerValue<T>(
	fetchValue: () => Promise<T>,
	{ key, errorMessage }: { key: string; errorMessage: string },
) {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [tick, setTick] = useState(0);
	const fetchRef = useRef(fetchValue);

	useEffect(() => { fetchRef.current = fetchValue; });

	useEffect(() => {
		let active = true;
		const timer = window.setTimeout(() => {
			setLoading(true);
			fetchRef.current()
				.then((value) => {
					if (!active) return;
					setData(value);
					setError("");
				})
				.catch((cause: unknown) => {
					if (!active) return;
					setData(null);
					setError(getApiErrorMessage(cause, errorMessage));
					logError(errorMessage, cause);
				})
				.finally(() => { if (active) setLoading(false); });
		}, 0);
		return () => { active = false; window.clearTimeout(timer); };
	}, [errorMessage, key, tick]);

	const reload = useCallback(() => setTick((value) => value + 1), []);
	return { data, loading, error, reload };
}
