"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, PackageSearch, ShoppingBag } from "lucide-react";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { catalogProductsService, type CatalogProduct } from "@/services/catalog-products";
import { storesService } from "@/services/stores";
import { getProductImage, getProductPrice } from "@/services/toko-cart";
import { getSalesActingStoreProfile, readSalesTokoCart } from "@/services/sales-toko-cart";

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const category = (item: CatalogProduct) => item.product.category?.name || item.product.brand?.name || item.division?.name || "Produk";

export default function SalesActingStorefrontHome({ storeId }: { storeId: string }) {
	const [storeName, setStoreName] = useState("Toko");
	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [cartCount, setCartCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const basePath = `/sales/toko-kelolaan/${storeId}`;
	const syncCart = useCallback(() => setCartCount(readSalesTokoCart(storeId).reduce((sum, item) => sum + item.quantity, 0)), [storeId]);
	const load = useCallback(async () => {
		setLoading(true); setError("");
		try {
			const [store, featured] = await Promise.all([storesService.getById(storeId), catalogProductsService.listPublished({ page: 1, limit: 8, sortBy: "marketingName", sortOrder: "asc" })]);
			setStoreName(store.name || getSalesActingStoreProfile()?.storeName || "Toko");
			setProducts(featured.items); syncCart();
		} catch { setError("Beranda toko belum dapat dimuat. Silakan coba lagi."); }
		finally { setLoading(false); }
	}, [storeId, syncCart]);
	useEffect(() => { void load(); const listener = (event: Event) => { const id = (event as CustomEvent<{ storeId?: string }>).detail?.storeId; if (!id || id === storeId) syncCart(); }; window.addEventListener("sales-toko-cart-updated", listener); return () => window.removeEventListener("sales-toko-cart-updated", listener); }, [load, storeId, syncCart]);
	const acting = getSalesActingStoreProfile();
	return <TokoStorefrontShell title="Beranda" hideTitle basePath={basePath} cartCount={cartCount} profileName={storeName} profileRoleLabel="Sales Mode Toko" salesName={acting?.salesName ?? null}>
		{error ? <section className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Coba lagi</button></section> : null}
		<section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-sky-600 to-indigo-700 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-10"><div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" /><div className="relative max-w-2xl"><p className="text-sm font-semibold text-sky-100">Belanja untuk {storeName}</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">Lengkapi kebutuhan {storeName} dengan lebih mudah.</h2><p className="mt-3 text-sm leading-6 text-sky-50 sm:text-base">Temukan produk yang tersedia, lihat detailnya, lalu susun pesanan sesuai kebutuhan toko.</p><div className="mt-6 flex flex-wrap gap-3"><Link href={`${basePath}/katalog`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-sky-700 shadow-sm"><PackageSearch className="h-4 w-4" /> Jelajahi Produk</Link><Link href={`${basePath}/purchase-order`} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white"><ShoppingBag className="h-4 w-4" /> Keranjang{cartCount ? ` (${cartCount})` : ""}</Link></div></div></section>
		<section><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Katalog</p><h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Produk Pilihan</h2><p className="mt-1 text-sm text-slate-600">Jelajahi produk yang tersedia untuk kebutuhan toko.</p></div><Link href={`${basePath}/katalog`} className="hidden items-center gap-1 text-sm font-bold text-sky-700 sm:inline-flex">Lihat semua <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">{loading ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />) : products.map((item) => { const image = getProductImage(item); const price = getProductPrice(item); const stock = Math.max(0, item.product.stockQuantity ?? 0); return <Link key={item.id} href={`${basePath}/katalog?q=${encodeURIComponent(item.marketingName)}`} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"><div className="h-28 bg-slate-100 sm:h-40">{image ? <Image src={image} alt={item.marketingName} width={640} height={320} unoptimized className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Belum ada gambar</div>}</div><div className="space-y-2 p-3 sm:p-4"><p className="line-clamp-1 text-[11px] text-slate-500">{category(item)}</p><p className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-900 sm:text-base">{item.marketingName}</p><div className="flex items-end justify-between gap-2"><p className="text-sm font-bold text-rose-600">{price > 0 ? rupiah(price) : "Belum ada harga"}</p><span className={`text-[10px] font-semibold ${stock > 0 ? "text-emerald-700" : "text-rose-600"}`}>{stock > 0 ? `Stok ${stock}` : "Habis"}</span></div></div></Link>; })}</div></section>
	</TokoStorefrontShell>;
}
