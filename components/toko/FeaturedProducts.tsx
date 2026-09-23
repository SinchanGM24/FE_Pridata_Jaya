"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card, { CardHeader } from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";
import { formatRupiah } from "@/lib/format";
import { catalogProductsService, type CatalogProduct } from "@/services/catalog-products";
import { getProductImage, getProductPrice } from "@/services/toko-cart";

const categoryLabel = (product: CatalogProduct) =>
	product.product.category?.name ||
	product.product.brand?.name ||
	product.division?.name ||
	product.product.division?.name ||
	"Produk";

/**
 * Etalase singkat: 8 produk terbit, masing-masing menaut ke katalog dengan
 * `?q=` supaya pencarian di sana langsung menyorot produk yang dipilih.
 * `basePath` = "/toko" untuk portal toko, "/sales/toko-kelolaan/:id" untuk mode sales.
 */
export default function FeaturedProducts({ basePath }: { basePath: string }) {
	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setFailed(false);
		try {
			const result = await catalogProductsService.listPublished({
				page: 1,
				limit: 8,
				sortBy: "marketingName",
				sortOrder: "asc",
			});
			setProducts(result.items);
		} catch {
			setFailed(true);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const catalogHref = `${basePath}/katalog`;

	return (
		<Card>
			<CardHeader
				title="Produk Pilihan"
				description="Jelajahi produk yang tersedia untuk kebutuhan toko."
				action={
					<Link
						href={catalogHref}
						className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800 md:min-h-9"
					>
						Lihat semua <ArrowRight className="h-4 w-4" />
					</Link>
				}
			/>
			{failed ? (
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
					<span>Produk pilihan belum dapat dimuat.</span>
					<Button variant="secondary" size="sm" onClick={() => void load()}>
						Coba lagi
					</Button>
				</div>
			) : loading ? (
				<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
					{Array.from({ length: 8 }, (_, index) => (
						<div key={index} className="rounded-xl border border-slate-200 p-3">
							<Skeleton className="h-28 w-full" />
							<Skeleton className="mt-3 h-4 w-3/4" />
						</div>
					))}
				</div>
			) : products.length === 0 ? (
				<p className="type-body mt-4 text-slate-600">Belum ada produk yang dapat ditampilkan saat ini.</p>
			) : (
				<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
					{products.map((product) => {
						const image = getProductImage(product);
						const price = getProductPrice(product);
						const stock = Math.max(0, product.product.stockQuantity ?? 0);
						return (
							<Link
								key={product.id}
								href={`${catalogHref}?q=${encodeURIComponent(product.marketingName)}`}
								className="hover-lift overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
							>
								<span className="block h-28 bg-slate-100 sm:h-36">
									{image ? (
										<Image
											src={image}
											alt=""
											width={640}
											height={320}
											unoptimized
											className="h-full w-full object-cover"
										/>
									) : (
										<span className="flex h-full items-center justify-center text-xs font-medium text-slate-400">
											Belum ada gambar
										</span>
									)}
								</span>
								<span className="block space-y-1.5 p-3">
									<span className="block truncate text-xs text-slate-500">{categoryLabel(product)}</span>
									<span className="line-clamp-2 block min-h-10 text-sm font-semibold text-slate-900">
										{product.marketingName}
									</span>
									<span className="flex items-end justify-between gap-2">
										<span className="text-sm font-bold text-accent-700">
											{price > 0 ? formatRupiah(price) : "Belum ada harga"}
										</span>
										<Badge tone={stock > 0 ? "success" : "danger"}>{stock > 0 ? `Stok ${stock}` : "Habis"}</Badge>
									</span>
								</span>
							</Link>
						);
					})}
				</div>
			)}
		</Card>
	);
}
