"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StoreGradeCriteria from "@/components/grade/StoreGradeCriteria";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { gradeService, type StoreGradeItem } from "@/services/grade";
import { readTokoCart } from "@/services/toko-cart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

export default function StoreMyGradePage() {
	const [grades, setGrades] = useState<StoreGradeItem[]>([]);
	const [cartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
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
		<TokoFeatureLayout title="Grade Toko Saya" cartCount={cartCount}>
			{loading ? (
				<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
					Memuat grade toko...
				</div>
			) : null}

			{!loading && !grade ? (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
					Data grade toko Anda belum tersedia.
				</div>
			) : null}

			{grade ? (
				<>
					<section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Grade Aktif</p>
						<p className="mt-4 text-6xl font-semibold text-slate-900">{grade.grade}</p>
						<p className={`mx-auto mt-4 w-fit rounded-full px-3 py-1 text-xs font-semibold ${healthTone}`}>
							Grade {grade.grade}
						</p>
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

					<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<h2 className="text-lg font-semibold text-slate-900">Interpretasi Grade</h2>
							<Link
								href="/toko/grade-saya/transaksi"
								className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
							>
								Lihat Detail Transaksi
							</Link>
						</div>
						<p className="mt-2 text-sm text-slate-600">
							Toko aktif masuk grade <span className="font-semibold text-slate-900">N</span> selama
							berusia kurang dari 30 hari atau belum memiliki invoice penilaian. Setelah itu,
							grade dihitung dari aktivitas penjualan, invoice, dan rasio piutang periode 90 hari.
						</p>
						<div className="mt-4 grid gap-3 md:grid-cols-2">
							<div className="rounded-lg bg-slate-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nama Toko</p>
								<p className="mt-2 font-semibold text-slate-900">{grade.storeName}</p>
							</div>
							<div className="rounded-lg bg-slate-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</p>
								<p className="mt-2 font-semibold text-slate-900">{grade.email}</p>
							</div>
							<div className="rounded-lg bg-slate-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Usia Toko</p>
								<p className="mt-2 font-semibold text-slate-900">{grade.storeAgeDays} hari</p>
							</div>
							<div className="rounded-lg bg-slate-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Masa Percobaan Sampai</p>
								<p className="mt-2 font-semibold text-slate-900">
									{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
										new Date(grade.probationEndsAt),
									)}
								</p>
							</div>
						</div>
					</section>
				</>
			) : null}

			<StoreGradeCriteria />
		</TokoFeatureLayout>
	);
}
