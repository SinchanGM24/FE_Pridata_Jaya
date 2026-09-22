"use client";

import { useParams } from "next/navigation";
import SalesActingStorefrontHome from "@/components/toko/SalesActingStorefrontHome";

export default function SalesManagedStoreDetailPage() {
	const { storeId } = useParams<{ storeId: string }>();
	return <SalesActingStorefrontHome storeId={storeId} />;
}
