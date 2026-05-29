"use client";

import StoreGradeTransactionPage from "@/components/grade/StoreGradeTransactionPage";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { readTokoCart } from "@/services/toko-cart";

export default function StoreMyGradeTransactionPage() {
	const cartCount = readTokoCart().reduce((sum, item) => sum + item.quantity, 0);

	return (
		<TokoFeatureLayout title="Detail Transaksi Grade" cartCount={cartCount}>
			<StoreGradeTransactionPage storeId="" source="toko" />
		</TokoFeatureLayout>
	);
}
