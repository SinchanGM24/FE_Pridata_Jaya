"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card, { CardHeader } from "@/components/shared/Card";
import PageFeedback from "@/components/shared/PageFeedback";
import { SkeletonList } from "@/components/shared/Skeleton";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { formatRupiah } from "@/lib/format";
import { buildSalesOrderOpportunities, type SalesOrderOpportunity } from "@/lib/order-insights";
import { catalogProductsService } from "@/services/catalog-products";
import { gradeService } from "@/services/grade";
import { invoicesService } from "@/services/invoices";
import { ordersService } from "@/services/orders";
import { salesService, type SalesDashboardData } from "@/services/sales";

export default function SalesDashboardPage() {
	const [data, setData] = useState<SalesDashboardData | null>(null);
	const [opportunities, setOpportunities] = useState<SalesOrderOpportunity[]>([]);
	const [loading, setLoading] = useState(true);
	const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
	const [error, setError] = useState("");

	/*
	 * Dulu satu Promise.all atas lima endpoint — tiga di antaranya menarik
	 * koleksi penuh tanpa paginasi — memblokir seluruh layar, dan `catch`-nya
	 * hanya menyetel satu string sehingga halaman kosong selamanya di 3G.
	 *
	 * Sekarang dua tahap: KPI dan daftar toko tampil dari dua panggilan ringan,
	 * peluang order menyusul dengan skeleton sendiri.
	 */
	const loadOpportunities = useCallback(async (stores: SalesDashboardData["stores"]) => {
		setOpportunitiesLoading(true);
		try {
			const [orders, invoices, catalogProducts] = await Promise.all([
				ordersService.listAllForSales({ sortBy: "documentDate", sortOrder: "desc" }).catch(() => []),
				invoicesService.listAllForSales({ sortBy: "invoiceDate", sortOrder: "desc" }).catch(() => []),
				catalogProductsService
					.listAllPublished({ sortBy: "name", sortOrder: "asc" })
					.catch(() => []),
			]);
			setOpportunities(buildSalesOrderOpportunities(stores, orders, invoices, catalogProducts));
		} finally {
			setOpportunitiesLoading(false);
		}
	}, []);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [dashboard, gradeStores] = await Promise.all([
				salesService.getDashboard(),
				gradeService.listForSales(),
			]);
			setData({ ...dashboard, stores: gradeStores });
			// Peluang order menyusul; KPI dan daftar toko tidak menunggunya.
			void loadOpportunities(gradeStores);
		} catch {
			setError("Gagal memuat dashboard sales.");
		} finally {
			setLoading(false);
		}
	}, [loadOpportunities]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const actionSummary = useMemo(() => {
		const ready = opportunities.filter((item) => item.status === "Siap follow up").length;
		const collectFirst = opportunities.filter((item) => item.status === "Tagih dulu").length;
		return { ready, collectFirst };
	}, [opportunities]);

	return (
		<SalesPortalShell title="Dashboard Sales">
			<PageFeedback error={error} onDismissError={() => setError("")} onRetry={() => void load()} />

			<StatGrid columns={4}>
				<StatCard label="Toko Kelolaan" value={data?.stores.length ?? 0} loading={loading} />
				<StatCard
					label="Siap Follow Up"
					value={actionSummary.ready}
					tone={actionSummary.ready > 0 ? "success" : "neutral"}
					loading={loading}
				/>
				<StatCard
					lead
					label="Sisa Piutang"
					value={formatRupiah(data?.receivables.totalOutstandingAmount ?? 0)}
					tone={(data?.receivables.totalOutstandingAmount ?? 0) > 0 ? "warning" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Tagih Dulu"
					value={actionSummary.collectFirst || data?.receivables.overdueCount || 0}
					tone={
						(actionSummary.collectFirst || data?.receivables.overdueCount || 0) > 0
							? "danger"
							: "neutral"
					}
					loading={loading}
				/>
			</StatGrid>

			<section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
				<Card>
					<CardHeader
						title="Peluang Order Toko"
						description="Diurutkan dari pola reorder, nilai order, kesehatan limit, dan stok katalog."
						action={
							<Button href="/sales/toko-kelolaan" variant="secondary" size="sm">
								Lihat toko
							</Button>
						}
					/>
					<div className="mt-4">
						{opportunitiesLoading ? (
							<SkeletonList rows={3} />
						) : (
							opportunities.map((item) => (
								/*
								 * Dulu kartu di dalam kartu di dalam kartu: kotak abu di dalam <Card>,
								 * lalu chip putih di dalam kotak abu — ketiganya memakai slate-100/200,
								 * jadi mata tidak dapat isyarat kedalaman apa pun. Sekarang satu garis
								 * pemisah; kedalaman datang dari ruang.
								 */
								<div
									key={item.storeId}
									className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"
								>
									<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<p className="type-title text-slate-900">{item.storeName}</p>
												<Badge>Grade {item.grade}</Badge>
											</div>
											<p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
											<p className="mt-2 text-xs text-slate-600">
												Produk:{" "}
												{item.suggestedProducts.length
													? item.suggestedProducts.join(", ")
													: "mulai dari katalog fast-moving."}
											</p>
										</div>
										{/*
										  * "Skor 47" tidak pernah menyebut dari berapa dan tidak bisa
										  * dijelaskan sales ke atasannya. Status bernama dihitung dari skor
										  * yang sama, dan itu yang bisa ditindaklanjuti.
										  */}
										<Badge
											tone={
												item.status === "Siap follow up"
													? "success"
													: item.status === "Tagih dulu"
														? "danger"
														: "warning"
											}
											className="shrink-0 self-start"
										>
											{item.status}
										</Badge>
									</div>

									<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
										<div>
											<dt className="type-label text-slate-500">Rata-rata order</dt>
											<dd className="mt-0.5 text-sm font-medium text-slate-900">
												{formatRupiah(item.averageOrderValue)}
											</dd>
										</div>
										<div>
											<dt className="type-label text-slate-500">Sisa piutang</dt>
											<dd
												className={`mt-0.5 text-sm font-medium ${
													item.outstandingAmount > 0 ? "text-rose-700" : "text-slate-900"
												}`}
											>
												{formatRupiah(item.outstandingAmount)}
											</dd>
										</div>
										<div>
											<dt className="type-label text-slate-500">Faktur terlambat</dt>
											<dd className="mt-0.5 text-sm font-medium text-slate-900">{item.overdueCount}</dd>
										</div>
									</dl>

									{/* Wawasan tanpa aksi tidak berguna di lapangan — beri jalannya. */}
									<div className="mt-3 flex flex-wrap gap-2">
										<Button
											href={`/sales/toko-kelolaan/${item.storeId}/katalog`}
											variant="commerce"
											size="sm"
										>
											Buat Order
											<ArrowRight className="h-4 w-4" />
										</Button>
										{item.outstandingAmount > 0 ? (
											<Button
												href={`/sales/aging-piutang?storeId=${item.storeId}`}
												variant="secondary"
												size="sm"
											>
												Lihat piutang
											</Button>
										) : null}
									</div>
								</div>
							))
						)}
						{!loading && !opportunities.length ? (
							<p className="text-sm text-slate-500">
								Belum ada histori cukup untuk peluang order.
							</p>
						) : null}
					</div>
				</Card>

				<Card>
					<CardHeader
						title="Ritme Penagihan"
						description="Menentukan toko yang bisa ditawari order atau perlu ditagih dulu."
					/>
					<div className="mt-4 space-y-3">
						<div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
							<p className="text-xs font-medium text-rose-700">Total piutang</p>
							<p className="mt-1 text-lg font-bold text-rose-900">
								{formatRupiah(data?.receivables.totalOutstandingAmount ?? 0)}
							</p>
						</div>
						<div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
							<p className="text-xs font-medium text-amber-700">Lewat jatuh tempo</p>
							<p className="mt-1 text-lg font-bold text-amber-900">
								{data?.receivables.overdueCount ?? 0} invoice
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
							<p className="text-xs font-medium text-slate-700">Aging 1-30 hari</p>
							<p className="mt-1 text-lg font-bold text-slate-900">
								{formatRupiah(data?.receivables.aging.days1To30.amount ?? 0)}
							</p>
						</div>
						<Button href="/sales/aging-piutang" variant="secondary" size="sm" block>
							Buka aging piutang
						</Button>
					</div>
				</Card>
			</section>

			<Card>
				<CardHeader title="Ringkasan Toko Naungan" />
				<div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{data?.stores.slice(0, 6).map((store) => (
						<Link
							key={store.storeId}
							href={`/sales/toko-kelolaan/${store.storeId}`}
							className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 transition hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
						>
							<p className="font-medium text-slate-800">{store.storeName}</p>
							<p className="mt-0.5 text-xs text-slate-500">
								Grade {store.grade} · Sisa piutang{" "}
								{formatRupiah(store.totalOutstandingAmount)}
							</p>
						</Link>
					))}
					{!loading && !data?.stores.length ? (
						<p className="text-sm text-slate-500">Belum ada toko naungan untuk sales ini.</p>
					) : null}
				</div>
			</Card>
		</SalesPortalShell>
	);
}
