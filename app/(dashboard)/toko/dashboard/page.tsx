"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ReceiptText, ShoppingBag, ShoppingCart } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card, { CardHeader } from "@/components/shared/Card";
import PageFeedback from "@/components/shared/PageFeedback";
import Skeleton, { SkeletonList } from "@/components/shared/Skeleton";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { useTokoCartCount } from "@/hooks/useTokoCartCount";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import { buildRestockRecommendations, type RestockRecommendation } from "@/lib/order-insights";
import { statusTone } from "@/lib/ui-labels";
import { catalogProductsService } from "@/services/catalog-products";
import { gradeService, type StoreGradeItem } from "@/services/grade";
import { ordersService } from "@/services/orders";
import { tokoService, type TokoDashboardData } from "@/services/toko";
import { setActiveTokoCartStore } from "@/services/toko-cart";

const dateOnly = (value?: string | null) => (value ? formatAppDate(value) : "-");

export default function TokoDashboardPage() {
	const [data, setData] = useState<TokoDashboardData | null>(null);
	const [restockRecommendations, setRestockRecommendations] = useState<RestockRecommendation[]>([]);
	// /dashboard/store tidak membawa grade maupun totalOrders — sumbernya endpoint grade.
	const [grade, setGrade] = useState<StoreGradeItem | null>(null);
	const cartCount = useTokoCartCount();
	const [loading, setLoading] = useState(true);
	const [recommendationsLoading, setRecommendationsLoading] = useState(false);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		setRestockRecommendations([]);
		try {
			const [dashboard, gradeRows] = await Promise.all([
				tokoService.getDashboard(),
				gradeService.listForToko().catch(() => [] as StoreGradeItem[]),
			]);
			if (dashboard.store?.storeId) {
				setActiveTokoCartStore(dashboard.store.storeId);
			}
			setData(dashboard);
			setGrade(gradeRows[0] ?? null);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat dashboard toko."));
		} finally {
			setLoading(false);
		}
	}, []);

	const loadRecommendations = useCallback(async () => {
		setRecommendationsLoading(true);
		try {
			const [orders, catalogProducts] = await Promise.all([
				ordersService.listAllForToko({ sortBy: "documentDate", sortOrder: "desc" }).catch(() => []),
				catalogProductsService.listAllPublished({
					sortBy: "marketingName",
					sortOrder: "asc",
				}).catch(() => []),
			]);
			setRestockRecommendations(buildRestockRecommendations(orders, catalogProducts));
		} finally {
			setRecommendationsLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
			void loadRecommendations();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load, loadRecommendations]);

	const quickActions = useMemo(
		() => [
			{
				label: "Belanja Produk",
				href: "/toko/katalog",
				description: "Lihat katalog dan masukkan produk ke keranjang.",
				icon: ShoppingBag,
			},
			{
				label: "Cek Keranjang",
				href: "/toko/purchase-order",
				description: "Review item lalu ajukan purchase order ke fakturis.",
				icon: ShoppingCart,
			},
			{
				label: "Tagihan & Pembayaran",
				href: "/toko/hutang-toko",
				description: "Pantau tagihan aktif dan ajukan pembayaran.",
				icon: ReceiptText,
			},
		],
		[],
	);

	const outstanding = data?.receivableStatement.totalOutstandingAmount ?? 0;

	return (
		<TokoStorefrontShell title="Dashboard Toko" cartCount={cartCount}>
			<PageFeedback error={error} onDismissError={() => setError("")} />

			<section className="rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5">
				<div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
					<div className="min-w-0">
						<p className="text-lg font-semibold text-slate-900 sm:text-2xl">
							{data?.store?.storeName || "Portal Operasional Toko"}
						</p>
						<p className="mt-1 text-sm text-slate-600">
							Pantau pesanan, tagihan, dan pembayaran toko dalam satu tampilan kerja.
						</p>
						{data?.store?.verificationStatus ? (
							<div className="mt-3">
								<Badge tone={statusTone(data.store.verificationStatus)}>
									Verifikasi: {data.store.verificationStatus}
								</Badge>
							</div>
						) : null}
					</div>
					{/* Satu kolom di HP: dua kartu sempit berdampingan di 360px tidak terbaca. */}
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
						{quickActions.map((action) => {
							const Icon = action.icon;
							return (
								<Link
									key={action.href}
									href={action.href}
									className="flex items-center gap-3 rounded-xl border border-white/70 bg-white px-4 py-3 shadow-sm transition hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
								>
									<Icon className="h-5 w-5 shrink-0 text-brand-600" />
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-semibold text-slate-900">
											{action.label}
										</span>
										<span className="mt-0.5 block text-xs text-slate-500">
											{action.description}
										</span>
									</span>
									<ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
								</Link>
							);
						})}
					</div>
				</div>
			</section>

			<StatGrid columns={4}>
				<StatCard label="Grade Toko" value={grade?.grade ?? "-"} loading={loading} />
				<StatCard label="Total Order" value={grade?.totalOrders ?? 0} loading={loading} />
				<StatCard
					label="Tagihan Berjalan"
					value={formatRupiah(outstanding)}
					tone={outstanding > 0 ? "warning" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Pembayaran Masuk"
					value={formatRupiah(data?.receivableStatement.totalPaidAmount ?? 0)}
					loading={loading}
				/>
			</StatGrid>

			<section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
				<Card>
					<CardHeader
						title="Rekomendasi Restock"
						description="Diprioritaskan dari pola pembelian toko dan stok katalog aktif."
						action={
							<Button href="/toko/katalog" variant="secondary" size="sm">
								Buka katalog
							</Button>
						}
					/>
					<div className="mt-4 space-y-3">
						{recommendationsLoading ? (
							<SkeletonList rows={2} />
						) : restockRecommendations.length ? (
							restockRecommendations.map((item) => (
								<div
									key={item.productId}
									className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="font-medium text-slate-900">{item.productName}</p>
											<p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
										</div>
										<Badge tone="success">Skor {item.score}</Badge>
									</div>
									<div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
										<span className="rounded-full bg-white px-2 py-1">
											Stok {item.availableStock}
										</span>
										{item.purchaseCount > 0 ? (
											<span className="rounded-full bg-white px-2 py-1">
												{item.purchaseCount}x pembelian
											</span>
										) : null}
										{item.lastPurchasedAt ? (
											<span className="rounded-full bg-white px-2 py-1">
												Terakhir {dateOnly(item.lastPurchasedAt)}
											</span>
										) : null}
									</div>
								</div>
							))
						) : (
							<p className="text-sm text-slate-500">
								Belum ada histori yang cukup. Mulai dari katalog untuk membentuk pola restock.
							</p>
						)}
					</div>
				</Card>

				{/* Panel aksi: setiap baris membawa tombolnya sendiri, bukan sekadar angka. */}
				<Card>
					<CardHeader
						title="Prioritas Toko"
						description="Aksi paling berdampak untuk menjaga order dan pembayaran tetap lancar."
					/>
					<div className="mt-4 space-y-3">
						{loading ? (
							<>
								<Skeleton className="h-20 w-full" />
								<Skeleton className="h-20 w-full" />
							</>
						) : (
							<>
								<div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
									<p className="font-medium text-amber-900">Tagihan berjalan</p>
									<p className="mt-1 text-sm text-amber-800">
										{outstanding > 0
											? `${formatRupiah(outstanding)} belum lunas.`
											: "Semua tagihan sudah lunas."}
									</p>
									{outstanding > 0 ? (
										<Button
											href="/toko/hutang-toko"
											variant="commerce"
											size="sm"
											className="mt-3"
										>
											Bayar sekarang
										</Button>
									) : null}
								</div>

								<div className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-3">
									<p className="font-medium text-brand-900">Keranjang aktif</p>
									<p className="mt-1 text-sm text-brand-800">
										{cartCount > 0
											? `${cartCount} item siap direview sebelum checkout.`
											: "Belum ada item di keranjang."}
									</p>
									<Button
										href={cartCount > 0 ? "/toko/purchase-order" : "/toko/katalog"}
										variant="secondary"
										size="sm"
										className="mt-3"
									>
										{cartCount > 0 ? "Lihat keranjang" : "Mulai belanja"}
									</Button>
								</div>

								{grade?.gradeReason ? (
									<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
										<p className="font-medium text-slate-900">Grade {grade.grade}</p>
										<p className="mt-1 text-sm text-slate-600">{grade.gradeReason}</p>
									</div>
								) : null}
							</>
						)}
					</div>
				</Card>
			</section>
		</TokoStorefrontShell>
	);
}
