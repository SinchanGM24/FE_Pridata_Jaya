"use client";

import { useParams } from "next/navigation";
import TokoTransactionHistoryWorkspace from "@/components/toko/TokoTransactionHistoryWorkspace";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";

export default function SalesStoreTransactionHistoryPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();

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
