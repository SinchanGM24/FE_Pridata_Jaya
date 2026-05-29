"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { buildRestockRecommendations, type RestockRecommendation } from "@/lib/order-insights";
import { catalogProductsService } from "@/services/catalog-products";
import { ordersService } from "@/services/orders";
import { tokoService, type TokoDashboardData } from "@/services/toko";
import { readTokoCart, setActiveTokoCartStore } from "@/services/toko-cart";

interface ErrorWithMessage {
	response?: {
		data?: {
			message?: string;
		};
	};
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

export default function TokoDashboardPage() {
	const [data, setData] = useState<TokoDashboardData | null>(null);
	const [restockRecommendations, setRestockRecommendations] = useState<RestockRecommendation[]>([]);
	const [cartCount, setCartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
	const [loading, setLoading] = useState(true);
	const [recommendationsLoading, setRecommendationsLoading] = useState(false);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		setRestockRecommendations([]);
		try {
			const dashboard = await tokoService.getDashboard();
			if (dashboard.store?.storeId) {
				setActiveTokoCartStore(dashboard.store.storeId);
			}
			setData(dashboard);
		} catch (err: unknown) {
			setError(
				(err as ErrorWithMessage)?.response?.data?.message ||
					"Gagal memuat dashboard toko.",
			);
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
		const syncCart = () =>
			setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
		const timer = window.setTimeout(() => {
			void load();
			void loadRecommendations();
		}, 0);
		window.addEventListener("toko-cart-updated", syncCart);
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("toko-cart-updated", syncCart);
		};
	}, [load, loadRecommendations]);

	const quickActions = useMemo(
		() => [
			{
				label: "Belanja Produk",
				href: "/toko/katalog",
				description: "Lihat katalog dan masukkan produk ke keranjang.",
			},
			{
				label: "Cek Keranjang",
				href: "/toko/purchase-order",
				description: "Review item lalu ajukan purchase order ke fakturis.",
			},
			{
				label: "Lihat Tagihan",
				href: "/toko/hutang-toko",
				description: "Pantau invoice yang belum lunas dan tanggal jatuh tempo.",
			},
			{
				label: "Ajukan Pembayaran",
				href: "/toko/pembayaran-online",
				description: "Input bukti bayar untuk diverifikasi oleh akuntan.",
			},
		],
		[],
	);

	return (
		<TokoStorefrontShell title="Dashboard Toko" cartCount={cartCount}>
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
				<div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
					<div>
						<p className="text-2xl font-semibold text-slate-900">
							{data?.store?.storeName || "Portal Operasional Toko"}
						</p>
						<p className="mt-1 text-sm text-slate-600">
							Gunakan dashboard ini untuk memantau grade, pesanan, tagihan, dan pembayaran
							dalam satu tampilan kerja toko.
						</p>
						<div className="mt-4 flex flex-wrap gap-2">
							<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
								Verifikasi: {data?.store?.verificationStatus || "-"}
							</span>
							<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
								Grade: {data?.store?.grade || "-"}
							</span>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						{quickActions.slice(0, 4).map((action) => (
							<Link
								key={action.href}
								href={action.href}
								className="rounded-xl border border-white/70 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
							>
								<p className="text-sm font-semibold text-slate-900">{action.label}</p>
								<p className="mt-1 text-xs text-slate-500">{action.description}</p>
							</Link>
						))}
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{
						label: "Grade Toko",
						value: data?.store?.grade ?? "-",
						tone: "border-cyan-200 bg-cyan-50 text-cyan-800",
					},
					{
						label: "Total Order",
						value: data?.store?.totalOrders ?? 0,
						tone: "border-indigo-200 bg-indigo-50 text-indigo-800",
					},
					{
						label: "Tagihan Berjalan",
						value: formatRupiah(data?.receivableStatement.totalOutstandingAmount ?? 0),
						tone: "border-amber-200 bg-amber-50 text-amber-800",
					},
					{
						label: "Pembayaran Masuk",
						value: formatRupiah(data?.receivableStatement.totalPaidAmount ?? 0),
						tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
					},
				].map((item) => (
					<div key={item.label} className={`rounded-lg border p-4 ${item.tone}`}>
						<p className="text-xs">{item.label}</p>
						<p className="mt-2 text-xl font-bold">{item.value}</p>
					</div>
				))}
			</section>

			<section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Rekomendasi Restock</h2>
							<p className="mt-1 text-xs text-slate-500">
								Produk diprioritaskan dari pola pembelian toko dan stok katalog aktif.
							</p>
						</div>
						<Link href="/toko/katalog" className="text-sm font-semibold text-sky-700">
							Buka katalog
						</Link>
					</div>
					<div className="mt-4 space-y-3">
						{recommendationsLoading ? (
							<p className="text-sm text-slate-500">Menghitung rekomendasi restock...</p>
						) : restockRecommendations.length ? (
							restockRecommendations.map((item) => (
								<div key={item.productId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="font-medium text-slate-900">{item.productName}</p>
											<p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
										</div>
										<span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700">
											Skor {item.score}
										</span>
									</div>
									<div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
										<span className="rounded-full bg-white px-2 py-1">Stok {item.availableStock}</span>
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
				</div>

				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Prioritas Toko</h2>
							<p className="mt-1 text-xs text-slate-500">
								Aksi yang paling berdampak untuk menjaga order dan pembayaran tetap lancar.
							</p>
						</div>
						<Link href="/toko/pembayaran-online" className="text-sm font-semibold text-sky-700">
							Bayar
						</Link>
					</div>
					<div className="mt-4 space-y-3">
						{loading ? (
							<p className="text-sm text-slate-500">Memuat prioritas toko...</p>
						) : null}
						<div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
							<p className="font-medium text-amber-900">Tagihan berjalan</p>
							<p className="mt-1 text-sm text-amber-800">
								{formatRupiah(data?.receivableStatement.totalOutstandingAmount ?? 0)} belum lunas.
							</p>
						</div>
						<div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3">
							<p className="font-medium text-sky-900">Keranjang aktif</p>
							<p className="mt-1 text-sm text-sky-800">
								{cartCount > 0
									? `${cartCount} item siap direview sebelum checkout.`
									: "Belum ada item di keranjang."}
							</p>
						</div>
						<div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3">
							<p className="font-medium text-emerald-900">Grade toko</p>
							<p className="mt-1 text-sm text-emerald-800">
								Grade {data?.store?.grade ?? "-"} - {data?.store?.gradeReason || "jaga order dan pembayaran rutin."}
							</p>
						</div>
					</div>
				</div>
			</section>
		</TokoStorefrontShell>
	);
}
