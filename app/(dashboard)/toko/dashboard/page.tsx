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
import { statusTone, toUiLabel, verificationStatusLabel } from "@/lib/ui-labels";
import { catalogProductsService, type CatalogProduct } from "@/services/catalog-products";
import { gradeService, type StoreGradeItem } from "@/services/grade";
import { ordersService } from "@/services/orders";
import { tokoService, type TokoDashboardData } from "@/services/toko";
import { addProductToTokoCart, setActiveTokoCartStore } from "@/services/toko-cart";

const dateOnly = (value?: string | null) => (value ? formatAppDate(value) : "-");

export default function TokoDashboardPage() {
	const [data, setData] = useState<TokoDashboardData | null>(null);
	const [restockRecommendations, setRestockRecommendations] = useState<RestockRecommendation[]>([]);
	const [catalogByProductId, setCatalogByProductId] = useState<Map<string, CatalogProduct>>(new Map());
	const [restockNotice, setRestockNotice] = useState("");
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
			// Katalognya sudah diambil untuk menghitung rekomendasi; menyimpannya
			// membuat baris restock bisa memesan langsung, bukan sekadar bercerita.
			setCatalogByProductId(new Map(catalogProducts.map((item) => [item.productId, item])));
			setRestockRecommendations(buildRestockRecommendations(orders, catalogProducts));
		} finally {
			setRecommendationsLoading(false);
		}
	}, []);

	/*
	 * Toko tidak sedang belanja, mereka restock: ~20 SKU yang sama tiap minggu.
	 * Kuantitas default = rata-rata yang biasa dipesan, bukan 1.
	 */
	const handleRestockOrder = (item: RestockRecommendation) => {
		const product = catalogByProductId.get(item.productId);
		if (!product) return;
		const usual = item.purchaseCount
			? Math.max(1, Math.round(item.totalQuantity / item.purchaseCount))
			: 1;
		const quantity = item.availableStock > 0 ? Math.min(usual, item.availableStock) : usual;
		const next = addProductToTokoCart(product, quantity);
		setRestockNotice(
			`${item.productName} x${quantity} masuk keranjang. Total ${next.reduce((sum, row) => sum + row.quantity, 0)} item.`,
		);
	};

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
			<PageFeedback
				error={error}
				success={restockNotice}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setRestockNotice("")}
				onRetry={() => void load()}
			/>

			<section className="rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5">
				<div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
					<div className="min-w-0">
						<p className="type-title text-slate-900">
							{data?.store?.storeName || "Portal Operasional Toko"}
						</p>
						<p className="type-body mt-1 text-slate-600">
							Pantau pesanan, tagihan, dan pembayaran toko dalam satu tampilan kerja.
						</p>
						{data?.store?.verificationStatus ? (
							<div className="mt-3">
								<Badge tone={statusTone(data.store.verificationStatus)}>
									Verifikasi: {toUiLabel(data.store.verificationStatus, verificationStatusLabel)}
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
									className="flex items-center gap-3 rounded-xl border border-white/70 bg-white px-4 py-3 transition hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
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
					lead
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

			<section className="grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
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
					<div className="mt-4">
						{recommendationsLoading ? (
							<SkeletonList rows={2} />
						) : restockRecommendations.length ? (
							restockRecommendations.map((item) => {
								const orderable = catalogByProductId.has(item.productId) && item.availableStock > 0;
								const usual = item.purchaseCount
									? Math.max(1, Math.round(item.totalQuantity / item.purchaseCount))
									: 1;

								return (
									/*
									 * Diratakan: dulu kotak abu di dalam <Card> dengan chip putih di
									 * dalamnya lagi — tiga tingkat memakai slate yang sama.
									 */
									<div
										key={item.productId}
										className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="type-title text-slate-900">{item.productName}</p>
												<p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
											</div>
											<Badge tone={item.availableStock > 0 ? "neutral" : "danger"} className="shrink-0">
												{item.availableStock > 0 ? `Stok ${item.availableStock}` : "Stok habis"}
											</Badge>
										</div>

										<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
											<div>
												<dt className="type-label text-slate-500">Biasa dipesan</dt>
												<dd className="type-body mt-0.5 font-medium text-slate-900">{usual} unit</dd>
											</div>
											<div>
												<dt className="type-label text-slate-500">Sudah dibeli</dt>
												<dd className="type-body mt-0.5 font-medium text-slate-900">
													{item.purchaseCount}x
												</dd>
											</div>
											<div>
												<dt className="type-label text-slate-500">Terakhir</dt>
												<dd className="type-body mt-0.5 font-medium text-slate-900">
													{dateOnly(item.lastPurchasedAt)}
												</dd>
											</div>
										</dl>

										{/*
										  * Rekomendasi ini dulu hanya bercerita. Toko memesan ulang SKU yang
										  * sama tiap minggu — jalur tercepatnya ada di sini, bukan setelah
										  * mencari lagi namanya di katalog.
										  */}
										<div className="mt-3 flex flex-wrap gap-2">
											<Button
												variant="commerce"
												size="sm"
												disabled={!orderable}
												onClick={() => handleRestockOrder(item)}
											>
												<ShoppingCart className="h-4 w-4" />
												Pesan {usual} unit
											</Button>
											<Button href="/toko/katalog" variant="ghost" size="sm">
												Ubah jumlah di katalog
											</Button>
										</div>
									</div>
								);
							})
						) : (
							<p className="type-body text-slate-500">
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
										<p className="type-body mt-1 text-slate-600">{grade.gradeReason}</p>
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
