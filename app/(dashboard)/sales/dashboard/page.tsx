"use client";

import { useEffect, useMemo, useState } from "react";
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
	const [error, setError] = useState("");

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setError("");
			try {
				const [dashboard, gradeStores, orders, invoices, catalogProducts] = await Promise.all([
					salesService.getDashboard(),
					gradeService.listForSales(),
					ordersService.listAllForSales({ sortBy: "documentDate", sortOrder: "desc" }).catch(() => []),
					invoicesService.listAllForSales({ sortBy: "invoiceDate", sortOrder: "desc" }).catch(() => []),
					catalogProductsService.listAllPublished({
						sortBy: "name",
						sortOrder: "asc",
					}).catch(() => []),
				]);
				const resolvedDashboard = { ...dashboard, stores: gradeStores };
				setData(resolvedDashboard);
				setOpportunities(
					buildSalesOrderOpportunities(resolvedDashboard.stores, orders, invoices, catalogProducts),
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
		<SalesPortalShell title="Dashboard Sales">
			<PageFeedback error={error} onDismissError={() => setError("")} />

			<StatGrid columns={4}>
				<StatCard label="Toko Kelolaan" value={data?.stores.length ?? 0} loading={loading} />
				<StatCard
					label="Siap Follow Up"
					value={actionSummary.ready}
					tone={actionSummary.ready > 0 ? "success" : "neutral"}
					loading={loading}
				/>
				<StatCard
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
					<div className="mt-4 space-y-3">
						{loading ? (
							<SkeletonList rows={3} />
						) : (
							opportunities.map((item) => (
								<div
									key={item.storeId}
									className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
								>
									<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium text-slate-900">{item.storeName}</p>
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
										<div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
											<Badge
												tone={
													item.status === "Siap follow up"
														? "success"
														: item.status === "Tagih dulu"
															? "danger"
															: "warning"
												}
											>
												{item.status}
											</Badge>
											<span className="text-xs font-semibold text-slate-500">
												Skor {item.score}
											</span>
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
											Terlambat {item.overdueCount}
										</span>
									</div>

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
							className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 transition hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
