"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import StoreGradeCriteria from "@/components/grade/StoreGradeCriteria";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { gradeService, type StoreGradeItem } from "@/services/grade";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

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

	const healthTone = useMemo(() => {
		if (!grade) return "border border-slate-200 bg-slate-50 text-slate-700";
		if (grade.grade === "N") return "bg-violet-100 text-violet-700";
		if (grade.grade === "A") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
		if (grade.grade === "B") return "bg-sky-100 text-sky-700";
		if (grade.grade === "C") return "border border-amber-200 bg-amber-50 text-amber-700";
		if (grade.grade === "D") return "bg-orange-100 text-orange-700";
		return "border border-rose-200 bg-rose-50 text-rose-700";
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
					<section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Grade Aktif</p>
						<p className="mt-4 text-6xl font-semibold text-slate-900">{grade.grade}</p>
						<div className="mt-4">
							<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${healthTone}`}>
								Status verifikasi: {grade.verificationStatus}
							</span>
						</div>
						<p className="mt-4 text-sm text-slate-600">{grade.gradeReason}</p>
					</section>

					<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						{[
							{ label: "Order Penilaian", value: grade.recentOrders },
							{ label: "Invoice Penilaian", value: grade.recentInvoices },
							{ label: "Penjualan Penilaian", value: formatRupiah(grade.recentSalesAmount) },
							{ label: "Sisa Tagihan Penilaian", value: formatRupiah(grade.recentOutstandingAmount) },
						].map((item) => (
							<div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
								<p className="mt-3 text-lg font-semibold text-slate-900">{item.value}</p>
							</div>
						))}
					</section>
				</>
			) : null}

			<StoreGradeCriteria />
		</TokoFeatureLayout>
	);
}
