"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import EmptyState from "@/components/shared/EmptyState";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import QuantityStepper from "@/components/shared/QuantityStepper";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import Skeleton from "@/components/shared/Skeleton";
import CatalogProductDetailModal from "@/components/toko/CatalogProductDetailModal";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
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

const PAGE_SIZE = 20;

const getCategoryLabel = (product: CatalogProduct) =>
	product.product.category?.name ||
	product.product.brand?.name ||
	product.division?.name ||
	product.product.division?.name ||
	"Produk";

function SalesStoreCatalogPageContent() {
	const params = useParams<{ storeId: string }>();
	// `?q=` datang dari tautan tab Etalase.
	const querySearch = useSearchParams().get("q") ?? "";
	const storeId = params.storeId;
	const [actingProfile, setActingProfile] = useState<SalesActingStoreProfile | null>(null);
	const [contextReady, setContextReady] = useState(false);
	const accessError =
		contextReady && actingProfile?.storeId !== storeId
			? "Anda belum memilih toko untuk bertindak. Silakan kembali dan pilih toko dari daftar kelolaan."
			: "";

	const [managedStoreName, setManagedStoreName] = useState("");
	const [search, setSearch] = useState(querySearch);
	const debouncedSearch = useDebouncedValue(search.trim());
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

	const accessOk = Boolean(storeId) && contextReady && actingProfile?.storeId === storeId;
	const list = usePagedList(
		(page, limit) =>
			catalogProductsService.listPublished({
				page,
				limit,
				search: debouncedSearch || undefined,
				sortBy: "marketingName",
				sortOrder: "asc",
			}),
		{ filterKey: debouncedSearch, errorMessage: "Gagal memuat katalog sales.", pageSize: PAGE_SIZE, enabled: accessOk },
	);
	const products = list.items;

	useEffect(() => {
		if (!accessOk) return;

		const load = async () => {
			const managedStores = await salesService.getManagedStores().catch(() => []);
			const matched = managedStores.find((item) => item.storeId === storeId);
			if (matched?.storeName) setManagedStoreName(matched.storeName);
			if (!matched) setError("Toko tidak ditemukan dalam daftar kelolaan sales.");
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
	}, [accessOk, storeId]);

	const storeName = managedStoreName || actingProfile?.storeName || "Toko";

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
		<TokoStorefrontShell
			title={`Katalog ${storeName}`}
			basePath={`/sales/toko-kelolaan/${storeId}`}
			cartCount={cartCount}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingProfile?.salesName ?? null}
		>
			<PageFeedback error={list.error || null} onRetry={list.reload} />
			<PageFeedback
				error={accessError || error || null}
				success={feedback || null}
				onDismissSuccess={() => setFeedback("")}
			/>

			<section className="rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5">
				<h2 className="type-title text-slate-900">
					Temukan katalog untuk toko
				</h2>
				<p className="type-body mt-1 text-slate-600">
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
							maxLength={100}
							placeholder="Cari nama atau kode produk"
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
									mode === value ? "bg-brand-700 text-white" : "text-slate-500 hover:bg-slate-100"
								}`}
							>
								<Icon className="h-4 w-4" />
								<span className="sr-only">{label}</span>
							</button>
						))}
					</div>
				</div>
			</section>

			{list.loading && products.length === 0 && !accessError ? (
				<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{Array.from({ length: 8 }, (_, index) => (
						<div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
							<Skeleton className="h-32 w-full" />
							<Skeleton className="mt-3 h-4 w-3/4" />
							<Skeleton className="mt-2 h-4 w-1/3" />
						</div>
					))}
				</section>
			) : products.length === 0 && list.error ? (
				<p className="type-body py-8 text-center text-slate-500">Katalog belum bisa dimuat.</p>
			) : products.length === 0 ? (
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
					data={products}
					getRowKey={(product) => product.id}
					onRowClick={(product) => setSelectedProduct(product)}
				/>
			) : (
				<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{products.map((product) => {
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

			{products.length > 0 ? (
				<PaginationControls
					currentPage={list.page}
					totalPages={list.totalPages}
					totalItems={list.totalItems}
					currentItemCount={products.length}
					pageSize={PAGE_SIZE}
					itemLabel="produk"
					loading={list.loading}
					onPageChange={list.setPage}
				/>
			) : null}

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

export default function SalesStoreCatalogPage() {
	const { storeId } = useParams<{ storeId: string }>();
	return (
		<Suspense fallback={null}>
			<SalesStoreCatalogPageContent key={storeId} />
		</Suspense>
	);
}
