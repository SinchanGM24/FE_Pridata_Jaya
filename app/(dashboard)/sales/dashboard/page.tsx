"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { buildSalesOrderOpportunities, type SalesOrderOpportunity } from "@/lib/order-insights";
import { catalogProductsService } from "@/services/catalog-products";
import { invoicesService } from "@/services/invoices";
import { ordersService } from "@/services/orders";
import { salesService, type SalesDashboardData } from "@/services/sales";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function SalesDashboardPage() {
	const [data, setData] = useState<SalesDashboardData | null>(null);
	const [opportunities, setOpportunities] = useState<SalesOrderOpportunity[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setError("");
			try {
				const [dashboard, orders, invoices, catalogProducts] = await Promise.all([
					salesService.getDashboard(),
					ordersService.listAllForSales({ sortBy: "documentDate", sortOrder: "desc" }).catch(() => []),
					invoicesService.listAllForSales({ sortBy: "invoiceDate", sortOrder: "desc" }).catch(() => []),
					catalogProductsService.listAllPublished({
						sortBy: "marketingName",
						sortOrder: "asc",
					}).catch(() => []),
				]);
				setData(dashboard);
				setOpportunities(
					buildSalesOrderOpportunities(dashboard.stores, orders, invoices, catalogProducts),
				);
			} catch {
				setError("Gagal memuat dashboard sales.");
			} finally {
				setLoading(false);
			}
		};

		void load();
	}, []);

	const actionSummary = useMemo(() => {
		const ready = opportunities.filter((item) => item.status === "Siap follow up").length;
		const collectFirst = opportunities.filter((item) => item.status === "Tagih dulu").length;
		return { ready, collectFirst };
	}, [opportunities]);

	return (
		<SalesPortalShell title="Dasbor Sales">
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
					<p className="text-xs text-violet-700">Toko Kelolaan</p>
					<p className="mt-2 text-2xl font-bold text-violet-800">{data?.stores.length ?? 0}</p>
				</div>
				<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
					<p className="text-xs text-blue-700">Siap Follow Up</p>
					<p className="mt-2 text-2xl font-bold text-blue-800">{actionSummary.ready}</p>
				</div>
				<div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
					<p className="text-xs text-rose-700">Sisa Piutang</p>
					<p className="mt-2 text-2xl font-bold text-rose-800">
						{formatRupiah(data?.receivables.totalOutstandingAmount ?? 0)}
					</p>
				</div>
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
					<p className="text-xs text-emerald-700">Tagih Dulu</p>
					<p className="mt-2 text-2xl font-bold text-emerald-800">
						{actionSummary.collectFirst || data?.receivables.overdueCount || 0}
					</p>
				</div>
			</section>

			<section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
				<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="font-semibold text-slate-800">Peluang Order Toko</p>
							<p className="mt-1 text-xs text-slate-500">
								Diurutkan dari pola reorder, nilai order, kesehatan limit, dan stok katalog.
							</p>
						</div>
						<Link href="/sales/toko-kelolaan" className="text-sm font-semibold text-sky-700">
							Lihat toko
						</Link>
					</div>
					<div className="mt-4 space-y-3">
						{loading ? <p className="text-xs text-slate-500">Menghitung peluang order...</p> : null}
						{opportunities.map((item) => (
							<div key={item.storeId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div>
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium text-slate-900">{item.storeName}</p>
											<span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
												Grade {item.grade}
											</span>
										</div>
										<p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
										{item.suggestedProducts.length ? (
											<p className="mt-2 text-xs text-slate-600">
												Produk: {item.suggestedProducts.join(", ")}
											</p>
										) : (
											<p className="mt-2 text-xs text-slate-600">
												Produk: mulai dari katalog fast-moving.
											</p>
										)}
									</div>
									<div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
										<span
											className={`rounded-full px-2 py-1 text-xs font-semibold ${
												item.status === "Siap follow up"
													? "bg-emerald-100 text-emerald-700"
													: item.status === "Tagih dulu"
														? "bg-rose-100 text-rose-700"
														: "bg-amber-100 text-amber-700"
											}`}
										>
											{item.status}
										</span>
										<span className="text-xs font-semibold text-slate-500">Skor {item.score}</span>
									</div>
								</div>
								<div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
									<span className="rounded-lg bg-white px-2 py-2">
										Avg order {formatRupiah(item.averageOrderValue)}
									</span>
									<span className="rounded-lg bg-white px-2 py-2">
										Piutang {formatRupiah(item.outstandingAmount)}
									</span>
									<span className="rounded-lg bg-white px-2 py-2">
										Overdue {item.overdueCount}
									</span>
								</div>
							</div>
						))}
						{!loading && !opportunities.length ? (
							<p className="text-xs text-slate-500">Belum ada histori cukup untuk peluang order.</p>
						) : null}
					</div>
				</div>

				<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
					<p className="font-semibold text-slate-800">Ritme Penagihan</p>
					<p className="mt-1 text-xs text-slate-500">
						Pakai panel ini untuk menentukan toko yang bisa ditawari order atau perlu ditagih dulu.
					</p>
					<div className="mt-4 space-y-3">
						<div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-3">
							<p className="text-xs font-medium text-rose-700">Total piutang</p>
							<p className="mt-1 text-lg font-bold text-rose-900">
								{formatRupiah(data?.receivables.totalOutstandingAmount ?? 0)}
							</p>
						</div>
						<div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
							<p className="text-xs font-medium text-amber-700">Lewat jatuh tempo</p>
							<p className="mt-1 text-lg font-bold text-amber-900">
								{data?.receivables.overdueCount ?? 0} invoice
							</p>
						</div>
						<div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
							<p className="text-xs font-medium text-slate-700">Aging 1-30 hari</p>
							<p className="mt-1 text-lg font-bold text-slate-900">
								{formatRupiah(data?.receivables.aging.days1To30.amount ?? 0)}
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
				<p className="font-semibold text-slate-800">Ringkasan Toko Naungan</p>
				<div className="mt-3 grid gap-3 md:grid-cols-3">
					{data?.stores.slice(0, 6).map((store) => (
						<div key={store.storeId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
							<p className="font-medium text-slate-800">{store.storeName}</p>
							<p className="text-xs text-slate-500">
								Grade {store.grade} - Sisa piutang {formatRupiah(store.totalOutstandingAmount)}
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
