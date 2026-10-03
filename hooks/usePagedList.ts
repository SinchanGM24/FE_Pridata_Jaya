"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import type { PaginationMeta } from "@/services/pagination";

export interface PagedResult<T> { items: T[]; meta?: PaginationMeta }

type Options = { filterKey: string; errorMessage: string; pageSize?: number; enabled?: boolean };

/**
 * Satu halaman dari server. Data lama tetap tampil saat reload gagal, dan respons basi dibuang.
 *
 * Kontrak: `fetchPage` dibaca lewat ref, jadi SEMUA input yang dipakai fetch (pencarian, filter, id)
 * harus masuk ke `filterKey`; kalau tidak, perubahannya tidak memicu fetch ulang.
 * `errorMessage` dan `pageSize` adalah dependency effect, jadi harus nilai stabil (literal/konstanta).
 * `error` sengaja tidak bisa dibersihkan dari luar: ia hilang hanya saat reload berhasil. Halaman
 * menampilkannya tanpa `onDismissError` (hanya galat aksi yang boleh ditutup), dan tabel kosong yang
 * gagal bertuliskan "… belum bisa dimuat", bukan "Belum ada …".
 */
export function usePagedList<T>(
	fetchPage: (page: number, limit: number) => Promise<PagedResult<T>>,
	{ filterKey, errorMessage, pageSize = 20, enabled = true }: Options,
) {
	const [items, setItems] = useState<T[]>([]);
	const [page, setPage] = useState(1);
	const [totalItems, setTotalItems] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [reloadTick, setReloadTick] = useState(0);
	const fetchRef = useRef(fetchPage);
	const requestId = useRef(0);
	const appliedFilterKey = useRef(filterKey);

	useEffect(() => { fetchRef.current = fetchPage; });

	useEffect(() => {
		if (!enabled) return;
		// setTimeout(0) mengikuti pola halaman lain: setState tidak dipanggil sinkron di dalam effect.
		const timer = window.setTimeout(() => {
			if (appliedFilterKey.current !== filterKey) {
				appliedFilterKey.current = filterKey;
				if (page !== 1) { setPage(1); return; }
			}
			const id = ++requestId.current;
			setLoading(true);
			fetchRef.current(page, pageSize)
				.then((result) => {
					if (id !== requestId.current) return;
					const pages = Math.max(1, result.meta?.totalPages ?? 1);
					if (page > pages) { setPage(pages); return; }
					setItems(result.items);
					setTotalItems(result.meta?.totalItems ?? result.items.length);
					setTotalPages(pages);
					setError("");
				})
				.catch((cause: unknown) => { if (id === requestId.current) setError(getApiErrorMessage(cause, errorMessage)); })
				.finally(() => { if (id === requestId.current) setLoading(false); });
		}, 0);
		// Cleanup invalidates any in-flight request (counter ref, not a DOM node).
		const invalidate = () => { requestId.current++; };
		return () => { window.clearTimeout(timer); invalidate(); };
	}, [enabled, errorMessage, filterKey, page, pageSize, reloadTick]);

	const reload = useCallback(() => setReloadTick((tick) => tick + 1), []);
	return { items, page, setPage, totalItems, totalPages, loading, error, reload };
}
