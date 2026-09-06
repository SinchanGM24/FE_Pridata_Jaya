"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card, { CardHeader } from "@/components/shared/Card";
import EmptyState from "@/components/shared/EmptyState";
import Skeleton from "@/components/shared/Skeleton";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import StoreGradeCriteria from "@/components/grade/StoreGradeCriteria";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { useTokoCartCount } from "@/hooks/useTokoCartCount";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import type { StatusTone } from "@/lib/ui-labels";
import { gradeService, type StoreGradeItem } from "@/services/grade";

export default function StoreMyGradePage() {
	const [grades, setGrades] = useState<StoreGradeItem[]>([]);
	const cartCount = useTokoCartCount();
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			const result = await gradeService.listForToko();
			setGrades(result);
		} catch {
			setGrades([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const grade = grades[0] ?? null;

	// Grade adalah skala berurut, jadi nadanya menurun — bukan satu hue per huruf.
	const healthTone = useMemo<StatusTone>(() => {
		if (!grade) return "neutral";
		if (grade.grade === "N") return "brand";
		if (grade.grade === "A") return "success";
		if (grade.grade === "B") return "brand";
		if (grade.grade === "C" || grade.grade === "D") return "warning";
		return "danger";
	}, [grade]);

	return (
		<TokoFeatureLayout title="Grade Toko Saya" cartCount={cartCount}>
			{loading ? (
				<Card>
					<Skeleton className="mx-auto h-4 w-24" />
					<Skeleton className="mx-auto mt-4 h-16 w-16" />
					<Skeleton className="mx-auto mt-4 h-4 w-48" />
				</Card>
			) : null}

			{!loading && !grade ? (
				<Card>
					<EmptyState
						title="Grade toko belum tersedia"
						description="Grade dihitung setelah toko berusia 30 hari dan punya invoice penilaian."
					/>
				</Card>
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
							<Badge tone={healthTone}>Grade {grade.grade}</Badge>
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

					<Card>
						<CardHeader
							title="Interpretasi Grade"
							action={
								<Button href="/toko/grade-saya/transaksi" size="sm">
									Lihat Detail Transaksi
								</Button>
							}
						/>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Toko aktif masuk grade <span className="font-semibold text-slate-900">N</span> selama
							berusia kurang dari 30 hari atau belum memiliki invoice penilaian. Setelah itu, grade
							dihitung dari aktivitas penjualan, invoice, dan rasio piutang periode 90 hari.
						</p>
						<dl className="mt-4 grid gap-3 sm:grid-cols-2">
							{[
								["Nama Toko", grade.storeName],
								["Email", grade.email],
								["Usia Toko", `${grade.storeAgeDays} hari`],
								["Masa Percobaan Sampai", formatAppDate(grade.probationEndsAt)],
							].map(([label, value]) => (
								<div key={label} className="rounded-xl bg-slate-50 p-4">
									<dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
										{label}
									</dt>
									<dd className="mt-1.5 truncate font-semibold text-slate-900">{value}</dd>
								</div>
							))}
						</dl>
					</Card>
				</>
			) : null}

			<StoreGradeCriteria />
		</TokoFeatureLayout>
	);
}
