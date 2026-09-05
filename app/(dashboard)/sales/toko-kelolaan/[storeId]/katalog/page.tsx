"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import EmptyState from "@/components/shared/EmptyState";
import PageFeedback from "@/components/shared/PageFeedback";
import QuantityStepper from "@/components/shared/QuantityStepper";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import Skeleton from "@/components/shared/Skeleton";
import CatalogProductDetailModal from "@/components/toko/CatalogProductDetailModal";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { formatRupiah } from "@/lib/format";
import {
	catalogProductsService,
	type CatalogProduct,
} from "@/services/catalog-products";
import { salesService } from "@/services/sales";
import { getProductImage, getProductPrice } from "@/services/toko-cart";
import {
	addProductToSalesTokoCart,
	readSalesTokoCart,
	getSalesActingStoreProfile,
	type SalesActingStoreProfile,
} from "@/services/sales-toko-cart";

const getCategoryLabel = (product: CatalogProduct) =>
	product.product.category?.name ||
	product.product.brand?.name ||
	product.division?.name ||
	product.product.division?.name ||
	"Produk";

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
	) {
		return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
	}
	if (error instanceof Error && error.message) return error.message;
	return fallback;
};

export default function SalesStoreCatalogPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const [actingProfile, setActingProfile] = useState<SalesActingStoreProfile | null>(null);
	const [contextReady, setContextReady] = useState(false);
	const accessError =
		contextReady && actingProfile?.storeId !== storeId
			? "Anda belum memilih toko untuk bertindak. Silakan kembali dan pilih toko dari daftar kelolaan."
			: "";

	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [managedStoreName, setManagedStoreName] = useState("");
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [mode, setMode] = useState<"katalog" | "list">("katalog");
	const [qtyById, setQtyById] = useState<Record<string, number>>({});
	const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
	const [cartCount, setCartCount] = useState(0);
	const [feedback, setFeedback] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!storeId) return;
		const timeoutId = window.setTimeout(() => {
			const profile = getSalesActingStoreProfile();
			setActingProfile(profile);
			setContextReady(true);
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [storeId]);

	useEffect(() => {
		if (!storeId || !contextReady) return;
		if (actingProfile?.storeId !== storeId) return;

		const load = async () => {
			setLoading(true);
			setError("");
			try {
				const [productItems, managedStores] = await Promise.all([
					catalogProductsService.listAllPublished({
						sortBy: "name",
						sortOrder: "asc",
					}),
					salesService.getManagedStores().catch(() => []),
				]);
				setProducts(productItems);
				const matched = managedStores.find((item) => item.storeId === storeId);
				if (matched?.storeName) setManagedStoreName(matched.storeName);
				if (!matched) setError("Toko tidak ditemukan dalam daftar kelolaan sales.");
			} catch (error: unknown) {
				setError(getErrorMessage(error, "Gagal memuat katalog sales."));
			} finally {
				setLoading(false);
			}
		};

		const syncCart = (event: Event) => {
			const detail = (event as CustomEvent)?.detail as { storeId?: string } | undefined;
			if (detail?.storeId && detail.storeId !== storeId) return;
			setCartCount(readSalesTokoCart(storeId).reduce((sum, item) => sum + item.quantity, 0));
		};
		const timeoutId = window.setTimeout(() => {
			void load();
			setCartCount(readSalesTokoCart(storeId).reduce((sum, item) => sum + item.quantity, 0));
		}, 0);
		window.addEventListener("sales-toko-cart-updated", syncCart);
		return () => {
			window.clearTimeout(timeoutId);
			window.removeEventListener("sales-toko-cart-updated", syncCart);
		};
	}, [actingProfile?.storeId, contextReady, storeId]);

	const storeName = managedStoreName || actingProfile?.storeName || "Toko";

	const filteredProducts = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return products;
		return products.filter(
			(product) =>
				product.marketingName.toLowerCase().includes(query) ||
				getCategoryLabel(product).toLowerCase().includes(query) ||
				(product.description ?? "").toLowerCase().includes(query) ||
				product.product.name.toLowerCase().includes(query),
		);
	}, [products, search]);

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
		const next = addProductToSalesTokoCart(storeId, product, qty);
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
					<span className="text-sm font-normal text-slate-500">Belum ada harga</span>
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
		<TokoStorefrontShell
			title={`Katalog ${storeName}`}
			basePath={`/sales/toko-kelolaan/${storeId}`}
			cartCount={cartCount}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingProfile?.salesName ?? null}
		>
			<PageFeedback
				error={accessError || error || null}
				success={feedback || null}
				onDismissSuccess={() => setFeedback("")}
			/>

			<section className="rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5">
				<h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
					Temukan katalog untuk toko
				</h2>
				<p className="mt-1 text-sm text-slate-600">
					Cari produk, atur jumlah, lalu tambah ke keranjang sebelum diajukan ke fakturis.
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
							className="h-11 w-full rounded-xl border border-brand-200 bg-white pl-9 pr-9 text-sm outline-none focus:border-brand-500"
						/>
						{search ? (
							<button
								type="button"
								onClick={() => setSearch("")}
								aria-label="Bersihkan pencarian"
								className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
							>
								<X className="h-4 w-4" />
							</button>
						) : null}
					</div>
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
									mode === value ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"
								}`}
							>
								<Icon className="h-4 w-4" />
								<span className="sr-only">{label}</span>
							</button>
						))}
					</div>
				</div>
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
							search
								? `Tidak ada produk yang cocok dengan "${search}". Coba kata kunci lain.`
								: "Katalog belum berisi produk terbit."
						}
						action={
							search ? (
								<Button variant="secondary" onClick={() => setSearch("")}>
									Bersihkan pencarian
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
								className="hover-lift flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
							>
								<button
									type="button"
									onClick={() => setSelectedProduct(product)}
									className="block text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
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
									<p className="text-base font-bold text-accent-600">
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
