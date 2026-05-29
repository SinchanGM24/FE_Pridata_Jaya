"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import StoreGradeTransactionPage from "@/components/grade/StoreGradeTransactionPage";
import { FeaturePage } from "@/components/shared/FeaturePage";

const parseSource = (value: string | null) =>
	value === "sales" || value === "toko" ? value : "grade";

export default function GradeTokoTransactionDetailRoute() {
	const params = useParams<{ storeId: string }>();
	const router = useRouter();
	const searchParams = useSearchParams();
	const source = parseSource(searchParams.get("from"));

	useEffect(() => {
		if (source === "sales") {
			router.replace(`/sales/grade-toko/${params.storeId}/transaksi`);
		}
		if (source === "toko") {
			router.replace("/toko/grade-saya/transaksi");
		}
	}, [params.storeId, router, source]);

	if (source === "sales" || source === "toko") {
		return null;
	}

	return (
		<FeaturePage
			title="Detail Transaksi Grade"
			description="Workspace transaksi toko dengan tabel terpisah, pencarian, dan pagination untuk histori order, invoice, dan pembayaran."
		>
			<StoreGradeTransactionPage storeId={params.storeId} source={source} />
		</FeaturePage>
	);
}
