"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { getApiErrorMessage } from "@/lib/api-errors";
import { digitalMarketingCatalogService } from "@/services/digital-marketing-catalog";
import type { CatalogProduct, CatalogStatus, CatalogSummary } from "@/services/catalog-products";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

type StatusFilter = "all" | CatalogStatus;

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
	{ value: "all", label: "Semua status" },
	{ value: "published", label: "Published" },
	{ value: "draft", label: "Draft" },
	{ value: "not_created", label: "Belum dibuat" },
];

const emptySummary: CatalogSummary = {
	activeStockProducts: 0,
	configured: 0,
	published: 0,
	draft: 0,
	withoutImages: 0,
	notCreated: 0,
	contentReadinessPercent: 0,
};

export default function CatalogManagementList() {
	const [items, setItems] = useState<CatalogProduct[]>([]);
	const [stockByProduct, setStockByProduct] = useState<Map<string, number>>(new Map());
	const [summary, setSummary] = useState<CatalogSummary>(emptySummary);
	const [totalItems, setTotalItems] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [page, setPage] = useState(1);

	// Search, status and ordering are applied by the backend across the whole
	// dataset, so a product on page 3 is still found from page 1.
	const load = useCallback(async (query: string) => {
		setLoading(true);
		try {
			// The summary counts the whole catalog, not the current filter, so it
			// rides along with the page load and stays fresh after every save.
			const [result, summaryResult] = await Promise.all([
				digitalMarketingCatalogService.listPage({
					page,
					limit: PAGE_SIZE,
					...(query ? { search: query } : {}),
					...(status === "all" ? {} : { status }),
				}),
				digitalMarketingCatalogService.summary().catch(() => null),
			]);
			setItems(result.items);
			setStockByProduct(result.stockByProduct);
			setTotalItems(result.meta?.totalItems ?? result.items.length);
			setTotalPages(Math.max(1, result.meta?.totalPages ?? 1));
			if (summaryResult) setSummary(summaryResult);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat katalog."));
		} finally {
			setLoading(false);
		}
	}, [page, status]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load(search.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => window.clearTimeout(timer);
	}, [load, search]);

	const visible = items;
	const currentPage = page;
	const firstUnconfigured = useMemo(
		() => items.find((item) => item.status === "not_created"),
		[items],
	);

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
			actions={firstUnconfigured ? [{ label: "Lengkapi Katalog Berikutnya", href: `/digital-marketing/kelola-katalog/${firstUnconfigured.productId}` }] : []}
		>
			<PageFeedback error={error} onDismissError={() => setError("")} />

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Produk Stok Aktif", value: summary.activeStockProducts, helper: "Siap dikelola pada katalog", tone: "text-slate-900" },
					{ label: "Published", value: summary.published, helper: "Tampil pada katalog", tone: "text-emerald-600" },
					{ label: "Draft", value: summary.draft, helper: "Belum ditayangkan", tone: "text-amber-600" },
					{ label: "Belum Dibuat", value: summary.notCreated, helper: "Perlu dilengkapi", tone: "text-rose-600" },
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
						<select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400">
							{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
						</select>
						<button type="button" onClick={resetFilters} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Reset</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
					<p>Menampilkan {visible.length} produk dari {totalItems} hasil filter.</p>
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
							) : visible.map((item) => {
								const isConfigured = item.status !== "not_created";
								const master = item.product;
								const image = item.imageList?.find(Boolean) ?? master.productDetail?.imageList?.find(Boolean);
								return (
									<tr key={item.productId} className="transition hover:bg-slate-50/70">
										<td className="px-4 py-3 align-middle"><div className="flex items-center gap-3">
											{image ? <Image src={image} alt={item.marketingName} width={48} height={48} unoptimized className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-400">Tanpa foto</div>}
											<div><p className="font-medium text-slate-900">{item.marketingName}</p><p className="mt-0.5 text-xs text-slate-500">{isConfigured ? `Master: ${master.name}` : "Informasi katalog belum dibuat"}</p></div>
										</div></td>
										<td className="px-4 py-3 text-slate-700"><p>{master.category?.name ?? "-"}</p><p className="mt-0.5 text-xs text-slate-500">{master.brand?.name ?? "Tanpa brand"}</p></td>
										<td className="px-4 py-3 text-right font-medium text-slate-900">{(stockByProduct.get(item.productId) ?? 0).toLocaleString("id-ID")}</td>
										<td className="px-4 py-3 text-right text-slate-700">{isConfigured ? `Rp ${item.sellingPrice.toLocaleString("id-ID")}` : "-"}</td>
										<td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "published" ? "bg-emerald-50 text-emerald-700" : isConfigured ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.status === "published" ? "Published" : isConfigured ? "Draft" : "Belum Dibuat"}</span></td>
										<td className="px-4 py-3 text-right"><Link href={`/digital-marketing/kelola-katalog/${item.productId}`} className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700">Kelola Detail</Link></td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} currentItemCount={visible.length} pageSize={PAGE_SIZE} itemLabel="produk" loading={loading} onPageChange={setPage} />
			</section>
		</FeaturePage>
	);
}
