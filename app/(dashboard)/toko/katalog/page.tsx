"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { LayoutGrid, List, Search, X } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import PageFeedback from "@/components/shared/PageFeedback";
import QuantityStepper from "@/components/shared/QuantityStepper";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import Skeleton from "@/components/shared/Skeleton";
import EmptyState from "@/components/shared/EmptyState";
import CatalogProductDetailModal from "@/components/toko/CatalogProductDetailModal";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { formatRupiah } from "@/lib/format";
import {
	catalogProductsService,
	type CatalogProduct,
} from "@/services/catalog-products";
import {
	addProductToTokoCart,
	getProductImage,
	getProductPrice,
	readTokoCart,
	setActiveTokoCartStore,
} from "@/services/toko-cart";
import { tokoService } from "@/services/toko";

const getCategoryLabel = (product: CatalogProduct) =>
	product.product.category?.name ||
	product.product.brand?.name ||
	product.division?.name ||
	product.product.division?.name ||
	"Produk";

export default function StoreCatalogPage() {
	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [storeName, setStoreName] = useState("Toko");
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("ALL");
	const [inStockOnly, setInStockOnly] = useState(false);
	const [mode, setMode] = useState<"katalog" | "list">("katalog");
	const [qtyById, setQtyById] = useState<Record<string, number>>({});
	const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
	const [cartCount, setCartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
	const [feedback, setFeedback] = useState("");

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const [productItems, dashboard] = await Promise.all([
					catalogProductsService.listAllPublished({
						sortBy: "marketingName",
						sortOrder: "asc",
					}),
					tokoService.getDashboard().catch(() => null),
				]);
				setProducts(productItems);
				if (dashboard?.store?.storeId) {
					setActiveTokoCartStore(dashboard.store.storeId);
				}
				if (dashboard?.store?.storeName) setStoreName(dashboard.store.storeName);
			} finally {
				setLoading(false);
			}
		};
		const syncCart = () =>
			setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		window.addEventListener("toko-cart-updated", syncCart);
		return () => {
			window.clearTimeout(timeoutId);
			window.removeEventListener("toko-cart-updated", syncCart);
		};
	}, []);

	/*
	 * Katalog distributor berisi ratusan SKU. Pencarian teks bebas saja memaksa
	 * pemilik toko sudah tahu nama produknya — itu mengandalkan ingatan, bukan
	 * pengenalan, di layar paling penting produk ini. Facet kategorinya sudah
	 * dihitung getCategoryLabel untuk ditampilkan; tinggal dipakai menyaring.
	 */
	const categories = useMemo(() => {
		const counts = new Map<string, number>();
		for (const product of products) {
			const label = getCategoryLabel(product);
			counts.set(label, (counts.get(label) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	}, [products]);

	const filteredProducts = useMemo(() => {
		const query = search.trim().toLowerCase();
		return products.filter((product) => {
			if (category !== "ALL" && getCategoryLabel(product) !== category) return false;
			if (inStockOnly && (product.product.stockQuantity ?? 0) <= 0) return false;
			if (!query) return true;
			return (
				product.marketingName.toLowerCase().includes(query) ||
				getCategoryLabel(product).toLowerCase().includes(query) ||
				(product.description ?? "").toLowerCase().includes(query) ||
				product.product.name.toLowerCase().includes(query)
			);
		});
	}, [category, inStockOnly, products, search]);

	// Keadaan kosong harus menyebut saringan mana yang menyembunyikan produknya,
	// bukan hanya kata kunci — sejak ada chip kategori, pencarian bisa kosong.
	const hasActiveFilter = Boolean(search.trim()) || category !== "ALL" || inStockOnly;

	const describeActiveFilter = () => {
		const parts: string[] = [];
		if (search.trim()) parts.push(`kata kunci "${search.trim()}"`);
		if (category !== "ALL") parts.push(`kategori ${category}`);
		if (inStockOnly) parts.push("saringan ada stok");
		return parts.join(" dan ");
	};

	const resetFilters = () => {
		setSearch("");
		setCategory("ALL");
		setInStockOnly(false);
	};

	const addToCart = (product: CatalogProduct) => {
		const price = getProductPrice(product);
		if (price <= 0) {
			setFeedback("Produk belum punya harga jual katalog.");
			return;
		}
		if ((product.product.stockQuantity ?? 0) <= 0) {
			setFeedback("Stok produk habis.");
			return;
		}
		const qty = Math.min(qtyById[product.id] ?? 1, product.product.stockQuantity ?? 1);
		const next = addProductToTokoCart(product, qty);
		setCartCount(next.reduce((sum, item) => sum + item.quantity, 0));
		setQtyById((prev) => ({ ...prev, [product.id]: 1 }));
		setFeedback(`${product.marketingName} masuk keranjang.`);
		setTimeout(() => setFeedback(""), 2500);
	};

	const updateQuantity = (productId: string, value: number) => {
		setQtyById((prev) => ({
			...prev,
			[productId]: Math.max(1, value),
		}));
	};

	const listColumns: ResponsiveColumn<CatalogProduct>[] = [
		{
			key: "marketingName",
			head: "Produk",
			role: "title",
			render: (product) => (
				<span className="block">
					<span className="block font-semibold text-slate-900">{product.marketingName}</span>
					<span className="block text-xs text-slate-500">{getCategoryLabel(product)}</span>
				</span>
			),
		},
		{
			key: "stock",
			head: "Stok",
			role: "status",
			render: (product) => {
				const stock = product.product.stockQuantity ?? 0;
				return (
					<Badge tone={stock > 0 ? "success" : "danger"}>
						{stock > 0 ? `Stok ${stock}` : "Stok habis"}
					</Badge>
				);
			},
		},
		{
			key: "price",
			head: "Harga",
			role: "amount",
			align: "right",
			render: (product) =>
				getProductPrice(product) > 0 ? (
					formatRupiah(getProductPrice(product))
				) : (
					<span className="type-body text-slate-500">Belum ada harga</span>
				),
		},
		{
			key: "quantity",
			head: "Jumlah",
			render: (product) => (
				<QuantityStepper
					value={qtyById[product.id] ?? 1}
					max={Math.max(1, product.product.stockQuantity ?? 1)}
					onChange={(next) => updateQuantity(product.id, next)}
				/>
			),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (product) => (
				<Button
					variant="commerce"
					size="sm"
					disabled={(product.product.stockQuantity ?? 0) <= 0 || getProductPrice(product) <= 0}
					onClick={() => addToCart(product)}
				>
					Pesan
				</Button>
			),
		},
	];

	return (
		<TokoStorefrontShell title={`Katalog ${storeName}`} cartCount={cartCount}>
			<PageFeedback success={feedback} onDismissSuccess={() => setFeedback("")} />

			<section className="rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5">
				<h2 className="type-title text-slate-900">
					Temukan katalog untuk toko Anda
				</h2>
				<p className="type-body mt-1 text-slate-600">
					Pilih produk, atur jumlah, lalu tambahkan ke keranjang sebelum diajukan ke fakturis.
				</p>

				<div className="mt-4 flex gap-2">
					<div className="relative min-w-0 flex-1">
						<Search
							aria-hidden
							className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
						/>
						<input
							type="search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Cari produk, brand, atau kategori"
							aria-label="Cari produk"
							className="h-11 w-full rounded-lg border border-brand-200 bg-white pl-9 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
						/>
						{search ? (
							<button
								type="button"
								onClick={() => setSearch("")}
								aria-label="Bersihkan pencarian"
								className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
							>
								<X className="h-4 w-4" />
							</button>
						) : null}
					</div>

					{/* Segmented control: keadaan aktif terlihat, bukan tombol yang menyebut mode lain. */}
					<div
						role="group"
						aria-label="Tampilan katalog"
						className="flex shrink-0 overflow-hidden rounded-xl border border-brand-200 bg-white"
					>
						{(
							[
								["katalog", "Kartu", LayoutGrid],
								["list", "Daftar", List],
							] as const
						).map(([value, label, Icon]) => (
							<button
								key={value}
								type="button"
								aria-pressed={mode === value}
								onClick={() => setMode(value)}
								className={`inline-flex h-11 w-11 items-center justify-center transition ${
									mode === value
										? "bg-brand-700 text-white"
										: "text-slate-500 hover:bg-slate-100"
								}`}
							>
								<Icon className="h-4 w-4" />
								<span className="sr-only">{label}</span>
							</button>
						))}
					</div>
				</div>

				{/*
				 * Chip kategori: pengenalan, bukan ingatan. Digulir horizontal supaya
				 * di 360px ia tetap satu baris dan tidak mendorong grid ke bawah lipatan.
				 */}
				{categories.length > 1 ? (
					<div
						role="group"
						aria-label="Saring kategori"
						className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
					>
						<button
							type="button"
							aria-pressed={category === "ALL"}
							onClick={() => setCategory("ALL")}
							className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs font-semibold transition md:min-h-9 ${
								category === "ALL"
									? "border-brand-700 bg-brand-700 text-white"
									: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
							}`}
						>
							Semua ({products.length})
						</button>
						{categories.map(([label, count]) => (
							<button
								key={label}
								type="button"
								aria-pressed={category === label}
								onClick={() => setCategory(label)}
								className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs font-semibold transition md:min-h-9 ${
									category === label
										? "border-brand-700 bg-brand-700 text-white"
										: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
								}`}
							>
								{label} ({count})
							</button>
						))}
						<button
							type="button"
							aria-pressed={inStockOnly}
							onClick={() => setInStockOnly((prev) => !prev)}
							className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs font-semibold transition md:min-h-9 ${
								inStockOnly
									? "border-slate-900 bg-slate-900 text-white"
									: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
							}`}
						>
							Ada stok
						</button>
					</div>
				) : null}
			</section>

			{loading ? (
				<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{Array.from({ length: 8 }, (_, index) => (
						<div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
							<Skeleton className="h-32 w-full" />
							<Skeleton className="mt-3 h-4 w-3/4" />
							<Skeleton className="mt-2 h-4 w-1/3" />
						</div>
					))}
				</section>
			) : filteredProducts.length === 0 ? (
				<section className="rounded-2xl border border-slate-200 bg-white">
					<EmptyState
						title="Produk tidak ditemukan"
						description={
							hasActiveFilter
								? `Tidak ada produk yang cocok dengan ${describeActiveFilter()}.`
								: "Katalog belum berisi produk terbit."
						}
						action={
							hasActiveFilter ? (
								<Button variant="secondary" onClick={resetFilters}>
									Tampilkan semua produk
								</Button>
							) : undefined
						}
					/>
				</section>
			) : mode === "list" ? (
				<ResponsiveTable
					columns={listColumns}
					data={filteredProducts}
					getRowKey={(product) => product.id}
					onRowClick={(product) => setSelectedProduct(product)}
				/>
			) : (
				<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{filteredProducts.map((product) => {
						const price = getProductPrice(product);
						const image = getProductImage(product);
						const stock = product.product.stockQuantity ?? 0;
						return (
							<article
								key={product.id}
								className="hover-lift flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow"
							>
								<button
									type="button"
									onClick={() => setSelectedProduct(product)}
									className="block text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-700"
								>
									<span className="block h-36 bg-slate-100 sm:h-40">
										{image ? (
											<Image
												src={image}
												alt=""
												width={640}
												height={320}
												className="h-full w-full object-cover"
												unoptimized
											/>
										) : (
											<span className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
												Belum ada gambar
											</span>
										)}
									</span>
									<span className="block space-y-2 px-4 pt-4">
										<Badge tone={stock > 0 ? "success" : "danger"}>
											{stock > 0 ? `Stok ${stock}` : "Stok habis"}
										</Badge>
										<span className="line-clamp-2 block min-h-10 font-semibold text-slate-900">
											{product.marketingName}
										</span>
										<span className="block text-xs text-slate-500">
											{getCategoryLabel(product)}
										</span>
									</span>
								</button>

								<div className="mt-auto space-y-3 px-4 pb-4 pt-3">
									<p className="type-title text-accent-700">
										{price > 0 ? formatRupiah(price) : "Belum ada harga"}
									</p>
									<div className="flex items-center gap-2">
										<QuantityStepper
											value={qtyById[product.id] ?? 1}
											max={Math.max(1, stock)}
											onChange={(next) => updateQuantity(product.id, next)}
										/>
										<Button
											variant="commerce"
											onClick={() => addToCart(product)}
											disabled={stock <= 0 || price <= 0}
											className="flex-1"
										>
											Pesan
										</Button>
									</div>
								</div>
							</article>
						);
					})}
				</section>
			)}

			<CatalogProductDetailModal
				product={selectedProduct}
				quantity={selectedProduct ? qtyById[selectedProduct.id] ?? 1 : 1}
				onQuantityChange={(value) => {
					if (selectedProduct) updateQuantity(selectedProduct.id, value);
				}}
				onAddToCart={addToCart}
				onClose={() => setSelectedProduct(null)}
			/>
		</TokoStorefrontShell>
	);
}
