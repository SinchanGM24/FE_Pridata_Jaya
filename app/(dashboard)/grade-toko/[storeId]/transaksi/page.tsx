"use client";

import { useParams, useSearchParams } from "next/navigation";
import StoreGradeTransactionPage from "@/components/grade/StoreGradeTransactionPage";
import { FeaturePage } from "@/components/shared/FeaturePage";

const parseSource = (value: string | null) =>
	value === "sales" || value === "toko" ? value : "grade";

export default function GradeTokoTransactionDetailRoute() {
	const params = useParams<{ storeId: string }>();
	const searchParams = useSearchParams();
	const source = parseSource(searchParams.get("from"));

	return (
		<FeaturePage
			title="Detail Transaksi Grade"
			description="Workspace transaksi toko dengan tabel terpisah, pencarian, dan pagination untuk histori order, invoice, dan pembayaran."
		>
			<StoreGradeTransactionPage storeId={params.storeId} source={source} />
		</FeaturePage>
	);
}
