"use client";

import { useEffect, useState } from "react";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { salesService, type SalesDashboardData } from "@/services/sales";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function SalesDashboardPage() {
	const [data, setData] = useState<SalesDashboardData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		salesService
			.getDashboard()
			.then(setData)
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	return (
		<SalesPortalShell title="Dashboard Sales">
			<section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
					<p className="text-xs text-violet-700">Toko Kelolaan</p>
					<p className="mt-2 text-2xl font-bold text-violet-800">{data?.stores.length ?? 0}</p>
				</div>
				<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
					<p className="text-xs text-blue-700">Order Terbaru</p>
					<p className="mt-2 text-2xl font-bold text-blue-800">{data?.recentOrders.length ?? 0}</p>
				</div>
				<div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
					<p className="text-xs text-rose-700">Outstanding</p>
					<p className="mt-2 text-2xl font-bold text-rose-800">
						{formatRupiah(data?.receivables.totalOutstandingAmount ?? 0)}
					</p>
				</div>
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
					<p className="text-xs text-emerald-700">Overdue</p>
					<p className="mt-2 text-2xl font-bold text-emerald-800">
						{data?.receivables.overdueCount ?? 0}
					</p>
				</div>
			</section>

			<section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
				{loading ? <p className="mb-3 text-xs text-slate-500">Memuat dashboard sales...</p> : null}
				<p className="font-semibold text-slate-800">Ringkasan Toko Naungan</p>
				<div className="mt-3 grid gap-3 md:grid-cols-3">
					{data?.stores.slice(0, 6).map((store) => (
						<div key={store.storeId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
							<p className="font-medium text-slate-800">{store.storeName}</p>
							<p className="text-xs text-slate-500">
								Grade {store.grade} - Outstanding {formatRupiah(store.totalOutstandingAmount)}
							</p>
						</div>
					))}
					{!loading && !data?.stores.length ? (
						<p className="text-xs text-slate-500">Belum ada toko naungan untuk sales ini.</p>
					) : null}
				</div>
			</section>
		</SalesPortalShell>
	);
}
