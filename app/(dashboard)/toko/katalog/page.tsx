"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import CatalogProductDetailModal from "@/components/toko/CatalogProductDetailModal";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { catalogProductsService, type CatalogProduct } from "@/services/catalog-products";
import {
	addProductToTokoDraftCart,
	addProductToTokoCart,
	confirmTokoDraftCart,
	getProductImage,
	getProductPrice,
	readTokoCart,
	readTokoDraftCart,
	setActiveTokoCartStore,
	updateTokoDraftCart,
	type TokoCartItem,
} from "@/services/toko-cart";
import { tokoService } from "@/services/toko";

const PAGE_SIZE = 12;

type PaginationMeta = {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
};

const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const getCategoryLabel = (product: CatalogProduct) => product.product.category?.name || product.product.brand?.name || product.division?.name || product.product.division?.name || "Produk";

export default function StoreCatalogPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const querySearch = searchParams.get("q") ?? "";
	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [meta, setMeta] = useState<PaginationMeta | null>(null);
	const [storeName, setStoreName] = useState("Toko");
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState(querySearch);
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const [mode, setMode] = useState<"katalog" | "list">("katalog");
	const [qtyById, setQtyById] = useState<Record<string, number>>({});
	const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
	const [draftCart, setDraftCart] = useState<TokoCartItem[]>([]);
	const [cartCount, setCartCount] = useState(0);
	const [feedback, setFeedback] = useState("");
	const [loadError, setLoadError] = useState("");
	const [catalogReload, setCatalogReload] = useState(0);

	useEffect(() => {
		const syncTimer = window.setTimeout(() => setSearch(querySearch), 0);
		return () => window.clearTimeout(syncTimer);
	}, [querySearch]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			const normalizedSearch = search.trim();
			setDebouncedSearch(normalizedSearch);
			setPage(1);
			if (normalizedSearch !== querySearch) {
				router.replace(normalizedSearch ? `/toko/katalog?q=${encodeURIComponent(normalizedSearch)}` : "/toko/katalog");
			}
		}, 300);
		return () => window.clearTimeout(timeoutId);
	}, [querySearch, router, search]);

	useEffect(() => {
		let cancelled = false;
		const loadStore = async () => {
			const dashboard = await tokoService.getDashboard().catch(() => null);
			if (cancelled) return;
			if (dashboard?.store?.storeId) {
				setActiveTokoCartStore(dashboard.store.storeId);
				setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
				setDraftCart(readTokoDraftCart());
			}
			if (dashboard?.store?.storeName) setStoreName(dashboard.store.storeName);
		};
		void loadStore();
		return () => { cancelled = true; };
	}, []);

	useEffect(() => {
		let cancelled = false;
		const loadProducts = async () => {
			setLoading(true);
			setLoadError("");
			try {
				const result = await catalogProductsService.listPublished({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined, sortBy: "marketingName", sortOrder: "asc" });
				if (!cancelled) {
					setProducts(result.items);
					setMeta(result.meta ?? null);
				}
			} catch (loadFailure: unknown) {
				if (!cancelled) {
					setProducts([]);
					setMeta(null);
					setLoadError(getApiErrorMessage(loadFailure, "Katalog tidak dapat dimuat. Periksa koneksi Anda lalu coba lagi."));
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void loadProducts();
		return () => { cancelled = true; };
	}, [catalogReload, debouncedSearch, page]);

	useEffect(() => {
		const syncCart = () => setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
		const syncDraft = () => setDraftCart(readTokoDraftCart());
		syncCart();
		syncDraft();
		window.addEventListener("toko-cart-updated", syncCart);
		window.addEventListener("toko-draft-cart-updated", syncDraft);
		return () => {
			window.removeEventListener("toko-cart-updated", syncCart);
			window.removeEventListener("toko-draft-cart-updated", syncDraft);
		};
	}, []);

	const draftSubtotal = useMemo(() => draftCart.reduce((sum, item) => sum + item.quantity * item.unitPriceSnapshot, 0), [draftCart]);
	const draftQuantity = draftCart.reduce((sum, item) => sum + item.quantity, 0);
	const totalPages = Math.max(1, meta?.totalPages ?? 1);
	const selectedListQuantity = products.reduce((sum, product) => sum + Math.max(0, qtyById[product.id] ?? 0), 0);

	const addToDraft = (product: CatalogProduct) => {
		const price = getProductPrice(product);
		const stock = product.product.stockQuantity ?? 0;
		if (price <= 0) return setFeedback("Produk belum punya harga jual katalog.");
		if (stock <= 0) return setFeedback("Stok produk habis.");
		const qty = Math.min(qtyById[product.id] ?? 1, stock);
		const currentQuantity = draftCart.find((item) => item.productId === product.productId)?.quantity ?? 0;
		if (currentQuantity >= stock) return setFeedback("Jumlah produk di pesanan sementara sudah mencapai stok yang tersedia.");
		const next = addProductToTokoDraftCart(product, Math.min(qty, stock - currentQuantity));
		setDraftCart(next);
		setQtyById((previous) => ({ ...previous, [product.id]: 1 }));
		setFeedback(`${product.marketingName} ditambahkan ke pesanan sementara.`);
	};

	const updateListQuantity = (product: CatalogProduct, value: number) => {
		const stock = Math.max(0, product.product.stockQuantity ?? 0);
		setQtyById((previous) => ({
			...previous,
			[product.id]: Math.min(stock, Math.max(0, Math.floor(value || 0))),
		}));
	};

	const addSelectedToDraft = () => {
		let nextDraft = draftCart;
		let addedProductCount = 0;

		for (const product of products) {
			const requestedQuantity = Math.max(0, Math.floor(qtyById[product.id] ?? 0));
			if (requestedQuantity === 0) continue;

			const stock = Math.max(0, product.product.stockQuantity ?? 0);
			const price = getProductPrice(product);
			const currentQuantity = nextDraft.find((item) => item.productId === product.productId)?.quantity ?? 0;
			const quantityToAdd = Math.min(requestedQuantity, Math.max(0, stock - currentQuantity));
			if (price <= 0 || quantityToAdd === 0) continue;

			nextDraft = addProductToTokoDraftCart(product, quantityToAdd);
			addedProductCount += 1;
		}

		if (addedProductCount === 0) {
			setFeedback("Pilih quantity produk yang tersedia dan sudah memiliki harga jual.");
			return;
		}

		setDraftCart(nextDraft);
		setQtyById({});
		setFeedback(`${addedProductCount} produk ditambahkan ke pesanan sementara.`);
	};

	const addToCart = (product: CatalogProduct) => {
		const price = getProductPrice(product);
		const stock = product.product.stockQuantity ?? 0;
		if (price <= 0) return setFeedback("Produk belum punya harga jual katalog.");
		if (stock <= 0) return setFeedback("Stok produk habis.");
		const qty = Math.min(qtyById[product.id] ?? 1, stock);
		const currentQuantity = readTokoCart().find((item) => item.productId === product.productId)?.quantity ?? 0;
		if (currentQuantity >= stock) return setFeedback("Jumlah produk di keranjang sudah mencapai stok yang tersedia.");
		const next = addProductToTokoCart(product, Math.min(qty, stock - currentQuantity));
		setCartCount(next.reduce((sum, item) => sum + item.quantity, 0));
		setQtyById((previous) => ({ ...previous, [product.id]: 1 }));
		setFeedback(`${product.marketingName} masuk ke keranjang.`);
	};

	const updateQuantity = (productId: string, value: number) => setQtyById((previous) => ({ ...previous, [productId]: Math.max(1, value) }));

	const updateDraftQuantity = (item: TokoCartItem, quantity: number) => {
		updateTokoDraftCart(draftCart.map((draftItem) => draftItem.productId === item.productId && draftItem.condition === item.condition ? { ...draftItem, quantity: Math.max(1, Math.floor(quantity || 1)) } : draftItem));
	};

	const removeDraftItem = (item: TokoCartItem) => updateTokoDraftCart(draftCart.filter((draftItem) => !(draftItem.productId === item.productId && draftItem.condition === item.condition)));

	const confirmDraft = () => {
		if (draftCart.length === 0) return;
		const next = confirmTokoDraftCart();
		setDraftCart([]);
		setCartCount(next.reduce((sum, item) => sum + item.quantity, 0));
		router.push("/toko/purchase-order");
	};

	return (
		<TokoStorefrontShell title={`Katalog ${storeName}`} cartCount={cartCount} catalogSearch={{ value: search, onChange: setSearch, placeholder: "Cari produk, brand, atau kategori" }}>
			<section className="rounded-lg border border-sky-100 bg-sky-50 p-4 sm:p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div><p className="text-lg font-semibold text-slate-900 sm:text-2xl">Temukan katalog untuk toko Anda</p><p className="mt-1 text-sm text-slate-600">{mode === "list" ? "Susun pesanan sementara, lalu konfirmasi ketika semua kebutuhan sudah lengkap." : "Tambahkan produk langsung ke keranjang untuk melanjutkan pesanan."}</p></div>
					<div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><button type="button" onClick={() => setMode((current) => current === "list" ? "katalog" : "list")} className="rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-100">{mode === "list" ? "Mode Katalog" : "Mode List"}</button></div>
				</div>
			</section>

			{feedback ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
			{loadError ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{loadError}</span><button type="button" onClick={() => setCatalogReload((current) => current + 1)} className="font-semibold underline underline-offset-2">Coba lagi</button></div> : null}
			{loading ? <p className="text-sm text-slate-600">Memuat katalog produk...</p> : null}

			{mode === "list" ? <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Masukkan quantity tiap produk, lalu tambahkan seluruh pilihan sekaligus.</p><button type="button" onClick={addSelectedToDraft} disabled={selectedListQuantity === 0} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300">Tambahkan ke Pesanan Sementara{selectedListQuantity > 0 ? ` (${selectedListQuantity})` : ""}</button></div><div className="divide-y divide-slate-100 md:hidden">{products.map((product) => { const stock = Math.max(0, product.product.stockQuantity ?? 0); return <article key={product.id} onClick={() => setSelectedProduct(product)} className="flex items-center gap-3 px-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{product.marketingName}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{getCategoryLabel(product)}</p><p className="mt-1 text-xs font-medium text-rose-600">{getProductPrice(product) > 0 ? formatRupiah(getProductPrice(product)) : "Belum ada harga"} <span className="font-normal text-slate-500">· Stok {stock}</span></p></div><input type="number" min={0} max={stock} value={qtyById[product.id] ?? 0} disabled={stock === 0 || getProductPrice(product) <= 0} onClick={(event) => event.stopPropagation()} onChange={(event) => updateListQuantity(product, Number(event.target.value))} className="w-14 shrink-0 rounded-lg border border-slate-300 px-1.5 py-1.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-slate-100" aria-label={`Jumlah ${product.marketingName}`} /></article>; })}</div><div className="hidden overflow-x-auto md:block"><table className="min-w-[640px] divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Produk</th><th className="px-4 py-3">Stok</th><th className="px-4 py-3">Harga</th><th className="px-4 py-3 text-right">Qty Pesan</th></tr></thead><tbody className="divide-y divide-slate-100">{products.map((product) => { const stock = Math.max(0, product.product.stockQuantity ?? 0); return <tr key={product.id} onClick={() => setSelectedProduct(product)} className="cursor-pointer hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{product.marketingName}</p><p className="text-xs text-slate-500">{getCategoryLabel(product)}</p></td><td className="px-4 py-3">{stock}</td><td className="px-4 py-3">{getProductPrice(product) > 0 ? formatRupiah(getProductPrice(product)) : "Belum ada harga"}</td><td className="px-4 py-3 text-right"><input type="number" min={0} max={stock} value={qtyById[product.id] ?? 0} disabled={stock === 0 || getProductPrice(product) <= 0} onClick={(event) => event.stopPropagation()} onChange={(event) => updateListQuantity(product, Number(event.target.value))} className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-right text-sm disabled:cursor-not-allowed disabled:bg-slate-100" aria-label={`Jumlah ${product.marketingName}`} /></td></tr>; })}</tbody></table></div></section> : <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{products.map((product) => {
			const price = getProductPrice(product); const image = getProductImage(product); const stock = product.product.stockQuantity ?? 0;
			return <article key={product.id} onClick={() => setSelectedProduct(product)} className="cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"><div className="h-28 bg-slate-100 sm:h-40">{image ? <Image src={image} alt={product.marketingName} width={640} height={320} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center px-2 text-center text-xs font-medium text-slate-400 sm:text-sm">Belum ada gambar</div>}</div><div className="space-y-2 p-3 sm:space-y-3 sm:p-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px] ${stock > 0 ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>{stock > 0 ? `Stok ${stock}` : "Stok Habis"}</span><div><p className="line-clamp-2 min-h-9 text-sm font-semibold text-slate-900 sm:min-h-10 sm:text-base">{product.marketingName}</p><p className="mt-1 line-clamp-1 text-[11px] text-slate-500 sm:text-xs">{getCategoryLabel(product)}</p></div><p className="text-sm font-bold text-rose-600 sm:text-base">{price > 0 ? formatRupiah(price) : "Belum ada harga"}</p></div></article>;
		})}</section>}

			{!loading && products.length === 0 ? <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Tidak ada produk katalog yang cocok dengan pencarian ini.</section> : null}
			{meta && meta.totalItems > 0 ? <nav className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination katalog"><p className="text-slate-600">Menampilkan {products.length} dari {meta.totalItems} produk · Halaman {page} dari {totalPages}</p><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Berikutnya</button></div></nav> : null}

			{mode === "list" ? <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Pesanan Sementara</h2><p className="mt-1 text-sm text-slate-600">Periksa kembali seluruh item sebelum dipindahkan ke Invoice Sementara.</p></div><span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">{draftCart.length} produk · {draftQuantity} item</span></div>
				{draftCart.length === 0 ? <div className="px-4 py-8 text-center text-sm text-slate-500">Belum ada produk di pesanan sementara. Gunakan tombol Tambah dari Mode List.</div> : <><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Produk</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3 text-right">Subtotal</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{draftCart.map((item) => <tr key={`${item.productId}-${item.condition}`}><td className="px-4 py-3 font-medium text-slate-900">{item.productName}</td><td className="px-4 py-3"><input type="number" min={1} value={item.quantity} onChange={(event) => updateDraftQuantity(item, Number(event.target.value))} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5" /></td><td className="px-4 py-3 text-right font-medium text-slate-900">{formatRupiah(item.quantity * item.unitPriceSnapshot)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => removeDraftItem(item)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Hapus</button></td></tr>)}</tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Total pesanan: <span className="font-semibold text-slate-900">{formatRupiah(draftSubtotal)}</span></p><button type="button" onClick={confirmDraft} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Konfirmasi Pesanan</button></div></>}
			</section> : null}

			<CatalogProductDetailModal product={selectedProduct} quantity={selectedProduct ? qtyById[selectedProduct.id] ?? 1 : 1} onQuantityChange={(value) => { if (selectedProduct) updateQuantity(selectedProduct.id, value); }} onAddToCart={mode === "list" ? addToDraft : addToCart} addActionLabel={mode === "list" ? "Tambah ke Pesanan Sementara" : "Tambah ke Keranjang"} showPurchaseControls={mode !== "list"} onClose={() => setSelectedProduct(null)} />
		</TokoStorefrontShell>
	);
}
