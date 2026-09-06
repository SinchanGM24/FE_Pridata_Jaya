"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import StoreGradeCriteria from "@/components/grade/StoreGradeCriteria";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { formatRupiah } from "@/lib/format";
import type { StatusTone } from "@/lib/ui-labels";
import { gradeService, type StoreGradeItem } from "@/services/grade";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";


export default function SalesStoreGradePage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();
	const [grade, setGrade] = useState<StoreGradeItem | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			const result = await gradeService.listForSales();
			setGrade(result.find((item) => item.storeId === storeId) ?? null);
		} catch {
			setGrade(null);
		} finally {
			setLoading(false);
		}
	}, [storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	// Grade adalah skala berurut; nadanya menurun, bukan satu hue per huruf.
	const healthTone = useMemo<StatusTone>(() => {
		if (!grade) return "neutral";
		if (grade.grade === "N" || grade.grade === "B") return "brand";
		if (grade.grade === "A") return "success";
		if (grade.grade === "C" || grade.grade === "D") return "warning";
		return "danger";
	}, [grade]);

	return (
		<TokoFeatureLayout
			title="Grade Toko"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={actingStore?.storeName || "Toko"}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		>
			{loading ? (
				<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
					Memuat grade toko...
				</div>
			) : null}

			{!loading && !grade ? (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
					Data grade toko ini belum tersedia.
				</div>
			) : null}

			{grade ? (
				<>
					<Card className="text-center">
						<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
							Grade Aktif
						</p>
						<p className="mt-3 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
							{grade.grade}
						</p>
						<div className="mt-3 flex justify-center">
							<Badge tone={healthTone}>Status verifikasi: {grade.verificationStatus}</Badge>
						</div>
						<p className="mx-auto mt-4 max-w-prose text-sm text-slate-600">{grade.gradeReason}</p>
					</Card>

					<StatGrid columns={4}>
						<StatCard label="Order Penilaian" value={grade.recentOrders} />
						<StatCard label="Invoice Penilaian" value={grade.recentInvoices} />
						<StatCard
							label="Penjualan Penilaian"
							value={formatRupiah(grade.recentSalesAmount)}
						/>
						<StatCard
							label="Sisa Tagihan Penilaian"
							value={formatRupiah(grade.recentOutstandingAmount)}
							tone={grade.recentOutstandingAmount > 0 ? "warning" : "success"}
						/>
					</StatGrid>
				</>
			) : null}

			<StoreGradeCriteria />
		</TokoFeatureLayout>
	);
}
