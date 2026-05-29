"use client";

import { useParams } from "next/navigation";
import StoreGradeTransactionPage from "@/components/grade/StoreGradeTransactionPage";
import SalesPortalShell from "@/components/sales/SalesPortalShell";

export default function SalesGradeTokoTransactionDetailPage() {
	const params = useParams<{ storeId: string }>();

	return (
		<SalesPortalShell title="Detail Transaksi Grade">
			<StoreGradeTransactionPage storeId={params.storeId} source="sales" />
		</SalesPortalShell>
	);
}
