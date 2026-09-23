"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TokoTransactionHistoryWorkspace from "@/components/toko/TokoTransactionHistoryWorkspace";
import {
	getSalesActingStoreProfile,
	type SalesActingStoreProfile,
} from "@/services/sales-toko-cart";

export default function SalesStoreTransactionHistoryPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const [actingStore, setActingStore] = useState<SalesActingStoreProfile | null>(null);

	// sessionStorage is browser-only. Reading it after mount keeps the server and
	// first client render identical, then fills in the acting-store context.
	useEffect(() => {
		const timer = window.setTimeout(() => setActingStore(getSalesActingStoreProfile()), 0);
		return () => window.clearTimeout(timer);
	}, []);

	return (
		<TokoTransactionHistoryWorkspace
			basePath={`/sales/toko-kelolaan/${storeId}`}
			storeId={storeId}
			profileName={actingStore?.storeName || "Toko"}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		/>
	);
}
