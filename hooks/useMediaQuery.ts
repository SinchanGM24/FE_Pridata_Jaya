"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Hanya untuk perilaku yang CSS tidak bisa tangani — menutup sheet, mengganti
 * mode modal. Tata letak tetap CSS murni; jangan pakai ini untuk memilih grid.
 */
export function useMediaQuery(query: string) {
	const subscribe = useCallback(
		(onChange: () => void) => {
			const list = window.matchMedia(query);
			list.addEventListener("change", onChange);
			return () => list.removeEventListener("change", onChange);
		},
		[query],
	);

	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(query).matches,
		() => false,
	);
}

/** Sejalan dengan titik `md:` Tailwind. */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
