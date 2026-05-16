"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
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
} from "@/services/sales-toko-cart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

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
	const actingProfile = getSalesActingStoreProfile();
	const accessError =
		actingProfile?.storeId !== storeId
			? "Anda belum memilih toko untuk bertindak. Silakan kembali dan pilih toko dari daftar kelolaan."
			: "";

	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [managedStoreName, setManagedStoreName] = useState("");
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [mode, setMode] = useState<"katalog" | "list">("katalog");
	const [qtyById, setQtyById] = useState<Record<string, number>>({});
	const [cartCount, setCartCount] = useState(() =>
		storeId ? readSalesTokoCart(storeId).reduce((sum, item) => sum + item.quantity, 0) : 0,
	);
	const [feedback, setFeedback] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!storeId) return;
		if (actingProfile?.storeId !== storeId) return;

		const load = async () => {
			setLoading(true);
			setError("");
			try {
				const [productItems, managedStores] = await Promise.all([
					catalogProductsService.listAllPublished({
						sortBy: "marketingName",
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
	}, [actingProfile?.storeId, storeId]);

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

	const recommended = useMemo(
		() =>
			[...products]
				.sort((a, b) => (b.product.stockQuantity ?? 0) - (a.product.stockQuantity ?? 0))
				.slice(0, 4),
		[products],
	);

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

	return (
		<TokoStorefrontShell
			title={`Katalog ${storeName}`}
			basePath={`/sales/toko-kelolaan/${storeId}`}
			cartCount={cartCount}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={getSalesActingStoreProfile()?.salesName ?? null}
		>
			<section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-sm font-semibold text-slate-900">Flow acting-as toko</p>
					<p className="text-xs text-slate-500">
						Tambahkan item ke keranjang, lalu checkout untuk toko kelolaan.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link
						href={`/sales/toko-kelolaan/${storeId}`}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
					>
						Kembali
					</Link>
					<Link
						href={`/sales/toko-kelolaan/${storeId}/purchase-order`}
						className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
					>
						Keranjang ({cartCount})
					</Link>
				</div>
			</section>

			{accessError || error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{accessError || error}
				</div>
			) : null}

			<section className="rounded-lg border border-sky-100 bg-sky-50 p-5">
				<div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
					<div>
						<p className="text-2xl font-semibold text-slate-900">Temukan katalog untuk toko</p>
						<p className="mt-1 text-sm text-slate-600">
							Cari produk, atur jumlah, lalu tambah ke keranjang sebelum diajukan ke fakturis.
						</p>
						<div className="mt-4 flex flex-col gap-2 md:flex-row">
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Cari produk, brand, atau kategori"
								className="w-full rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500"
							/>
							<button
								type="button"
								onClick={() => setMode((current) => (current === "list" ? "katalog" : "list"))}
								className="rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
							>
								{mode === "list" ? "Katalog" : "List"}
							</button>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						{recommended.map((product) => (
							<div key={product.id} className="rounded-lg bg-white p-3 shadow-sm">
								<p className="line-clamp-1 text-sm font-semibold text-slate-800">
									{product.marketingName}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									Stok {product.product.stockQuantity ?? 0}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{feedback ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{feedback}
				</div>
			) : null}

			{loading ? <p className="text-sm text-slate-600">Memuat katalog produk...</p> : null}

			{mode === "list" ? (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Produk</th>
								<th className="px-4 py-3">Stok</th>
								<th className="px-4 py-3">Harga</th>
								<th className="px-4 py-3">Jumlah</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{filteredProducts.map((product) => (
								<tr key={product.id}>
									<td className="px-4 py-3">
										<p className="font-semibold text-slate-900">{product.marketingName}</p>
										<p className="text-xs text-slate-500">{getCategoryLabel(product)}</p>
									</td>
									<td className="px-4 py-3">{product.product.stockQuantity ?? 0}</td>
									<td className="px-4 py-3">
										{getProductPrice(product) > 0
											? formatRupiah(getProductPrice(product))
											: "Belum ada harga"}
									</td>
									<td className="px-4 py-3">
										<input
											type="number"
											min={1}
											max={Math.max(1, product.product.stockQuantity ?? 1)}
											value={qtyById[product.id] ?? 1}
											onChange={(event) =>
												setQtyById((prev) => ({
													...prev,
													[product.id]: Math.max(1, Number(event.target.value || 1)),
												}))
											}
											className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
										/>
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => addToCart(product)}
											className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
										>
											Pesan
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			) : (
				<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{filteredProducts.map((product) => {
						const price = getProductPrice(product);
						const image = getProductImage(product);
						const stock = product.product.stockQuantity ?? 0;
						return (
							<article
								key={product.id}
								className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
							>
								<div className="h-40 bg-slate-100">
									{image ? (
										<Image
											src={image}
											alt={product.marketingName}
											width={640}
											height={320}
											className="h-full w-full object-cover"
											unoptimized
										/>
									) : (
										<div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
											Belum ada gambar
										</div>
									)}
								</div>
								<div className="space-y-3 p-4">
									<span
										className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
											stock > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
										}`}
									>
										{stock > 0 ? `Stok ${stock}` : "Stok Habis"}
									</span>
									<div>
										<p className="line-clamp-2 min-h-10 font-semibold text-slate-900">
											{product.marketingName}
										</p>
										<p className="mt-1 text-xs text-slate-500">{getCategoryLabel(product)}</p>
									</div>
									<p className="text-base font-bold text-rose-600">
										{price > 0 ? formatRupiah(price) : "Belum ada harga"}
									</p>
									<div className="flex gap-2">
										<input
											type="number"
											min={1}
											max={Math.max(1, stock)}
											value={qtyById[product.id] ?? 1}
											onChange={(event) =>
												setQtyById((prev) => ({
													...prev,
													[product.id]: Math.max(1, Number(event.target.value || 1)),
												}))
											}
											className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-sm"
										/>
										<button
											type="button"
											onClick={() => addToCart(product)}
											className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
										>
											Pesan
										</button>
									</div>
								</div>
							</article>
						);
					})}
				</section>
			)}

			{!loading && filteredProducts.length === 0 ? (
				<section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
					Tidak ada produk katalog yang cocok dengan pencarian ini.
				</section>
			) : null}
		</TokoStorefrontShell>
	);
}
