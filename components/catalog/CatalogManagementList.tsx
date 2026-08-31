"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { getApiErrorMessage } from "@/lib/api-errors";
import { digitalMarketingCatalogService } from "@/services/digital-marketing-catalog";
import type { Product } from "@/services/products";

const PAGE_SIZE = 10;
type CatalogStatus = "all" | "published" | "draft" | "unconfigured";

const statusOptions: Array<{ value: CatalogStatus; label: string }> = [
	{ value: "all", label: "Semua status" },
	{ value: "published", label: "Published" },
	{ value: "draft", label: "Draft" },
	{ value: "unconfigured", label: "Belum dibuat" },
];

const matchesStatus = (product: Product, status: CatalogStatus) => {
	if (status === "published") return product.catalogProduct?.isPublished === true;
	if (status === "draft") return Boolean(product.catalogProduct && !product.catalogProduct.isPublished);
	if (status === "unconfigured") return !product.catalogProduct;
	return true;
};

const catalogStatusPriority = (product: Product) => {
	if (!product.catalogProduct) return 0;
	if (!product.catalogProduct.isPublished) return 1;
	return 2;
};

const catalogDisplayName = (product: Product) =>
	product.catalogProduct?.marketingName?.trim() || product.name;

export default function CatalogManagementList() {
	const [products, setProducts] = useState<Product[]>([]);
	const [stockByProduct, setStockByProduct] = useState<Map<string, number>>(new Map());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<CatalogStatus>("all");
	const [page, setPage] = useState(1);

	useEffect(() => {
		let cancelled = false;
		void digitalMarketingCatalogService.getWorkspace()
			.then(({ products: productRows, inventory }) => {
				if (cancelled) return;
				const stock = new Map<string, number>();
				for (const row of inventory) stock.set(row.productId, (stock.get(row.productId) ?? 0) + row.quantity);
				setProducts(productRows.filter((product) => (stock.get(product.id) ?? 0) > 0));
				setStockByProduct(stock);
			})
			.catch((loadError: unknown) => {
				if (!cancelled) setError(getApiErrorMessage(loadError, "Gagal memuat katalog."));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => { cancelled = true; };
	}, []);

	const summary = useMemo(() => ({
		published: products.filter((product) => product.catalogProduct?.isPublished).length,
		draft: products.filter((product) => product.catalogProduct && !product.catalogProduct.isPublished).length,
		unconfigured: products.filter((product) => !product.catalogProduct).length,
	}), [products]);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		return products
			.filter((product) => {
				if (!matchesStatus(product, status)) return false;
				if (!query) return true;
				return [product.name, product.catalogProduct?.marketingName, product.category?.name, product.brand?.name, product.division?.name]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(query));
			})
			.sort((left, right) =>
				catalogStatusPriority(left) - catalogStatusPriority(right) ||
				catalogDisplayName(left).localeCompare(catalogDisplayName(right), "id-ID", { sensitivity: "base" }),
			);
	}, [products, search, status]);

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
	const firstUnconfigured = products.find((product) => !product.catalogProduct);

	const resetFilters = () => {
		setSearch("");
		setStatus("all");
		setPage(1);
	};

	return (
		<FeaturePage
			title="Kelola Katalog"
			description="Kelola informasi pemasaran setiap produk yang memiliki stok aktif di gudang."
			actionsDescription="Prioritaskan produk yang belum memiliki informasi katalog."
			actions={firstUnconfigured ? [{ label: "Lengkapi Katalog Berikutnya", href: `/digital-marketing/kelola-katalog/${firstUnconfigured.id}` }] : []}
		>
			<PageFeedback error={error} onDismissError={() => setError("")} />

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Produk Stok Aktif", value: products.length, helper: "Siap dikelola pada katalog", tone: "text-slate-900" },
					{ label: "Published", value: summary.published, helper: "Tampil pada katalog", tone: "text-emerald-600" },
					{ label: "Draft", value: summary.draft, helper: "Belum ditayangkan", tone: "text-amber-600" },
					{ label: "Belum Dibuat", value: summary.unconfigured, helper: "Perlu dilengkapi", tone: "text-rose-600" },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className={`mt-3 text-2xl font-semibold ${item.tone}`}>{loading ? "..." : item.value}</p>
						<p className="mt-2 text-sm text-slate-500">{item.helper}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Filter Katalog</h2>
						<p className="mt-1 text-sm text-slate-600">Pencarian dan status diterapkan ke seluruh produk sebelum pagination.</p>
					</div>
					<div className="grid w-full gap-3 sm:grid-cols-[minmax(240px,1fr)_190px_auto] lg:max-w-3xl">
						<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari produk, brand, atau kategori..." className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
						<select value={status} onChange={(event) => { setStatus(event.target.value as CatalogStatus); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400">
							{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
						</select>
						<button type="button" onClick={resetFilters} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Reset</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
					<p>Menampilkan {visible.length} produk dari {filtered.length} hasil filter.</p>
					<p>Halaman {currentPage} dari {totalPages}</p>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr><th className="px-4 py-3">Produk</th><th className="px-4 py-3">Kategori / Brand</th><th className="px-4 py-3 text-right">Stok</th><th className="px-4 py-3 text-right">Harga</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr><td colSpan={6} className="px-4 py-5 text-slate-600">Memuat katalog...</td></tr>
							) : visible.length === 0 ? (
								<tr><td colSpan={6} className="px-4 py-5 text-slate-600">Tidak ada produk pada filter ini.</td></tr>
							) : visible.map((product) => {
								const catalog = product.catalogProduct;
								const image = catalog?.imageList?.find(Boolean) ?? product.productDetail?.imageList?.find(Boolean);
								return (
									<tr key={product.id} className="transition hover:bg-slate-50/70">
										<td className="px-4 py-3 align-middle"><div className="flex items-center gap-3">
											{image ? <Image src={image} alt={catalog?.marketingName ?? product.name} width={48} height={48} unoptimized className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-400">Tanpa foto</div>}
											<div><p className="font-medium text-slate-900">{catalog?.marketingName ?? product.name}</p><p className="mt-0.5 text-xs text-slate-500">{catalog ? `Master: ${product.name}` : "Informasi katalog belum dibuat"}</p></div>
										</div></td>
										<td className="px-4 py-3 text-slate-700"><p>{product.category?.name ?? "-"}</p><p className="mt-0.5 text-xs text-slate-500">{product.brand?.name ?? "Tanpa brand"}</p></td>
										<td className="px-4 py-3 text-right font-medium text-slate-900">{(stockByProduct.get(product.id) ?? 0).toLocaleString("id-ID")}</td>
										<td className="px-4 py-3 text-right text-slate-700">{catalog ? `Rp ${catalog.sellingPrice.toLocaleString("id-ID")}` : "-"}</td>
										<td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${catalog?.isPublished ? "bg-emerald-50 text-emerald-700" : catalog ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{catalog?.isPublished ? "Published" : catalog ? "Draft" : "Belum Dibuat"}</span></td>
										<td className="px-4 py-3 text-right"><Link href={`/digital-marketing/kelola-katalog/${product.id}`} className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700">Kelola Detail</Link></td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} currentItemCount={visible.length} pageSize={PAGE_SIZE} itemLabel="produk" loading={loading} onPageChange={setPage} />
			</section>
		</FeaturePage>
	);
}
