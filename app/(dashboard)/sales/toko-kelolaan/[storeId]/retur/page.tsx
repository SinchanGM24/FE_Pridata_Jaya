"use client";

import { useParams } from "next/navigation";
import TokoReturnsWorkspace from "@/components/toko/TokoReturnsWorkspace";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";

export default function SalesStoreReturnPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();
	const storeName = actingStore?.storeName || "Toko";

	return (
		<TokoFeatureLayout
			title="Pengajuan Retur"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		>
			<TokoReturnsWorkspace storeId={storeId} storeName={storeName} actorMode="sales" />
		</TokoFeatureLayout>
	);
}
