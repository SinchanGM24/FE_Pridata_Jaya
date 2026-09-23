"use client";

import { useEffect, useState } from "react";
import { readTokoCart } from "@/services/toko-cart";

const readCount = () => readTokoCart().reduce((sum, item) => sum + item.quantity, 0);

/**
 * Jumlah item keranjang toko, sinkron dengan event `toko-cart-updated`.
 * Menggantikan blok reduce + addEventListener yang sama di 7 berkas.
 * Mulai dari 0 supaya render server dan klien cocok; localStorage dibaca setelah mount.
 */
export function useTokoCartCount() {
	const [count, setCount] = useState(0);

	useEffect(() => {
		const sync = () => setCount(readCount());
		sync();
		window.addEventListener("toko-cart-updated", sync);
		return () => window.removeEventListener("toko-cart-updated", sync);
	}, []);

	return count;
}
