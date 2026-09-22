"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, PackageSearch, ShoppingBag } from "lucide-react";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { catalogProductsService, type CatalogProduct } from "@/services/catalog-products";
import { tokoService, type TokoDashboardData } from "@/services/toko";
import { getProductImage, getProductPrice, readTokoCart, setActiveTokoCartStore } from "@/services/toko-cart";

const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const categoryLabel = (product: CatalogProduct) => product.product.category?.name || product.product.brand?.name || product.division?.name || product.product.division?.name || "Produk";

export default function TokoDashboardPage() {
	const [data, setData] = useState<TokoDashboardData | null>(null);
	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [cartCount, setCartCount] = useState(() => readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [dashboard, featuredProducts] = await Promise.all([
				tokoService.getDashboard(),
				catalogProductsService.listPublished({ page: 1, limit: 8, sortBy: "marketingName", sortOrder: "asc" }),
			]);
			if (dashboard.store?.storeId) {
				setActiveTokoCartStore(dashboard.store.storeId);
				setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
			}
			setData(dashboard);
			setProducts(featuredProducts.items);
		} catch {
			setError("Beranda toko belum dapat dimuat. Silakan coba lagi.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const loadTimer = window.setTimeout(() => void load(), 0);
		const syncCart = () => setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
		window.addEventListener("toko-cart-updated", syncCart);
		return () => {
			window.clearTimeout(loadTimer);
			window.removeEventListener("toko-cart-updated", syncCart);
		};
	}, [load]);

	const storeName = data?.store?.storeName || "Toko Anda";

	return (
		<TokoStorefrontShell title="Beranda" hideTitle cartCount={cartCount}>
			{error ? <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">Coba lagi</button></section> : null}

			<section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-sky-600 to-indigo-700 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-10">
				<div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
				<div className="absolute -bottom-24 right-1/4 h-44 w-44 rounded-full bg-indigo-300/20 blur-2xl" />
				<div className="relative max-w-2xl">
					<p className="text-sm font-semibold text-sky-100">Selamat datang di Pridata Store</p>
					<h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">Lengkapi kebutuhan {storeName} dengan lebih mudah.</h2>
					<p className="mt-3 max-w-xl text-sm leading-6 text-sky-50 sm:text-base">Temukan produk yang tersedia, lihat detailnya, lalu susun pesanan sesuai kebutuhan toko Anda.</p>
					<div className="mt-6 flex flex-wrap gap-3">
						<Link href="/toko/katalog" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50"><PackageSearch className="h-4 w-4" /> Jelajahi Produk</Link>
						<Link href="/toko/purchase-order" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"><ShoppingBag className="h-4 w-4" /> Keranjang{cartCount > 0 ? ` (${cartCount})` : ""}</Link>
					</div>
				</div>
			</section>

			<section>
				<div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Katalog</p><h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Produk Pilihan</h2><p className="mt-1 text-sm text-slate-600">Jelajahi produk yang tersedia untuk kebutuhan toko Anda.</p></div><Link href="/toko/katalog" className="hidden items-center gap-1 text-sm font-bold text-sky-700 hover:text-sky-800 sm:inline-flex">Lihat semua <ArrowRight className="h-4 w-4" /></Link></div>

				{loading ? <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="h-28 animate-pulse bg-slate-100 sm:h-40" /><div className="space-y-2 p-3"><div className="h-3 w-2/5 animate-pulse rounded bg-slate-100" /><div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" /><div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" /></div></div>)}</div> : products.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">{products.map((product) => {
					const image = getProductImage(product);
					const price = getProductPrice(product);
					const stock = Math.max(0, product.product.stockQuantity ?? 0);
					return <Link key={product.id} href={`/toko/katalog?q=${encodeURIComponent(product.marketingName)}`} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"><div className="h-28 bg-slate-100 sm:h-40">{image ? <Image src={image} alt={product.marketingName} width={640} height={320} unoptimized className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center px-3 text-center text-xs font-medium text-slate-400">Belum ada gambar</div>}</div><div className="space-y-2 p-3 sm:p-4"><p className="line-clamp-1 text-[11px] text-slate-500 sm:text-xs">{categoryLabel(product)}</p><p className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-900 sm:text-base">{product.marketingName}</p><div className="flex items-end justify-between gap-2"><p className="text-sm font-bold text-rose-600 sm:text-base">{price > 0 ? formatRupiah(price) : "Belum ada harga"}</p><span className={`shrink-0 text-[10px] font-semibold ${stock > 0 ? "text-emerald-700" : "text-rose-600"}`}>{stock > 0 ? `Stok ${stock}` : "Habis"}</span></div></div></Link>;
				})}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-600">Belum ada produk yang dapat ditampilkan saat ini.</div>}

				<Link href="/toko/katalog" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-sky-700 hover:text-sky-800 sm:hidden">Lihat semua produk <ArrowRight className="h-4 w-4" /></Link>
			</section>
		</TokoStorefrontShell>
	);
}
