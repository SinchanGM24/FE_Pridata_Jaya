"use client";

import { useEffect, useState } from "react";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import TokoReturnsWorkspace from "@/components/toko/TokoReturnsWorkspace";
import { readTokoCart } from "@/services/toko-cart";

export default function StoreReturnPage() {
	const [cartCount, setCartCount] = useState(0);

	useEffect(() => {
		const syncCart = () => {
			setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
		};

		syncCart();
		window.addEventListener("toko-cart-updated", syncCart);
		return () => window.removeEventListener("toko-cart-updated", syncCart);
	}, []);

	return (
		<TokoFeatureLayout title="Pengajuan Retur" cartCount={cartCount}>
			<TokoReturnsWorkspace storeId="" storeName="Toko" actorMode="toko" />
		</TokoFeatureLayout>
	);
}
