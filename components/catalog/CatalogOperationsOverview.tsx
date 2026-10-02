"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ExecutiveMetricsStrip, { type ExecutiveMetricItem } from "@/components/dashboard/ExecutiveMetricsStrip";
import { formatRupiah } from "@/components/dashboard/chart-utils";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import { getApiErrorMessage } from "@/lib/api-errors";
import { dashboardService, type OwnerAnalyticsSummary } from "@/services/dashboard";
import { activeReadiness } from "@/lib/catalog-attention";
import { digitalMarketingCatalogService } from "@/services/digital-marketing-catalog";
import type { CatalogProduct, CatalogSummary } from "@/services/catalog-products";

const emptySummary: CatalogSummary = { activeStockProducts: 0, configured: 0, published: 0, draft: 0, withoutImages: 0, notCreated: 0, contentReadinessPercent: 0, activeNotCreated: 0, activeDraft: 0, activeWithoutImages: 0 };

export default function CatalogOperationsOverview({ ownerView = false }: { ownerView?: boolean }) {
	const [summary, setSummary] = useState<CatalogSummary>(emptySummary);
	const [attention, setAttention] = useState<CatalogProduct[]>([]);
	const [analytics, setAnalytics] = useState<OwnerAnalyticsSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [reloadTick, setReloadTick] = useState(0);

	useEffect(() => {
		let cancelled = false;
		const marketRequest = ownerView
			? dashboardService.getOwnerAnalytics({ section: "details" }).catch(() => null)
			: Promise.resolve(null);
		void Promise.all([digitalMarketingCatalogService.getOverview(), marketRequest])
			.then(([overview, market]) => {
				if (cancelled) return;
				setSummary(overview.summary);
				setAttention(overview.attention);
				setAnalytics(market);
				setError("");
			})
			.catch((loadError: unknown) => {
				if (!cancelled) setError(getApiErrorMessage(loadError, "Gagal memuat ringkasan katalog."));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => { cancelled = true; };
	}, [ownerView, reloadTick]);

	const active = activeReadiness(summary);
	const categories = (analytics?.categoryContribution ?? []).slice(0, 5);
	const brands = (analytics?.brandPerformance ?? []).slice(0, 5);
	const metricItems: ExecutiveMetricItem[] = [
		{ label: "Produk Stok Aktif", value: loading ? "..." : String(summary.activeStockProducts), helper: "Produk yang siap dipasarkan" },
		{ label: "Siap Katalog", value: loading ? "..." : String(active.configured), helper: `${active.readinessPercent}% dari produk stok aktif`, tone: "positive" },
		{ label: "Published", value: loading ? "..." : String(active.published), helper: "Sudah tampil pada katalog", tone: "positive" },
		{ label: "Perlu Tindakan", value: loading ? "..." : String(active.needAction), helper: `${summary.activeDraft} draft, ${summary.activeWithoutImages} tanpa gambar`, tone: active.allClear ? "positive" : "warning" },
	];

	return (
		<FeaturePage
			title={ownerView ? "Insight Katalog & Market" : "Dashboard Digital Marketing"}
			description={ownerView ? "Pantau kesiapan katalog serta performa kategori dan brand tanpa mengubah konten." : "Pantau kesiapan katalog dan tentukan prioritas konten yang perlu ditangani."}
			actionsDescription="Buka daftar produk untuk mengelola informasi katalog per item."
			actions={ownerView ? [] : [{ label: "Kelola Katalog", href: "/digital-marketing/kelola-katalog" }]}
		>
			<PageFeedback error={error} onRetry={() => { setLoading(true); setReloadTick((tick) => tick + 1); }} onDismissError={() => setError("")} />
			<ExecutiveMetricsStrip items={metricItems} />

			<section className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
				<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div><h2 className="text-lg font-semibold text-slate-900">Kesiapan Konten</h2><p className="mt-1 text-sm text-slate-600">Produk stok aktif yang sudah memiliki informasi katalog.</p></div>
						<p className="text-3xl font-semibold text-indigo-600">{active.readinessPercent}%</p>
					</div>
					<div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${active.readinessPercent}%` }} /></div>
					<div className="mt-5 grid grid-cols-2 gap-3 text-sm">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-slate-500">Sudah dikonfigurasi</p><p className="mt-1 text-xl font-semibold text-slate-900">{active.configured}</p></div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-slate-500">Belum dikonfigurasi</p><p className="mt-1 text-xl font-semibold text-slate-900">{active.notCreated}</p></div>
					</div>
				</div>

				<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
						<div><h2 className="text-lg font-semibold text-slate-900">Prioritas Konten</h2><p className="mt-1 text-sm text-slate-600">Produk yang belum lengkap, belum bergambar, atau belum published.</p></div>
						{!ownerView ? <Link href="/digital-marketing/kelola-katalog" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Lihat Semua</Link> : null}
					</div>
					<div className="divide-y divide-slate-100">
						{attention.length === 0 ? (active.allClear ? <p className="px-5 py-6 text-sm text-emerald-700">Semua produk stok aktif sudah siap ditampilkan.</p> : <p className="px-5 py-6 text-sm text-slate-500">{loading ? "Memuat..." : "Daftar prioritas belum tersedia. Buka Kelola Katalog untuk melihat produk yang perlu ditangani."}</p>) : attention.map((item) => {
							const issue = item.status === "not_created" ? "Belum dibuat" : !item.imageList.length ? "Belum bergambar" : "Belum published";
							return <div key={item.productId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
								<div><p className="text-sm font-medium text-slate-900">{item.marketingName}</p><div className="mt-1 flex items-center gap-2"><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{issue}</span><span className="text-xs text-slate-500">Stok {(item.product.stockQuantity ?? 0).toLocaleString("id-ID")}</span></div></div>
								{!ownerView ? <Link href={`/digital-marketing/kelola-katalog/${item.productId}`} className="inline-flex justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700">Kelola Detail</Link> : null}
							</div>;
						})}
					</div>
				</div>
			</section>

			{ownerView ? <section className="grid gap-5 xl:grid-cols-2">
				<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Kategori Pembentuk Market</h2><p className="mt-1 text-sm text-slate-600">Kontribusi omzet dan penetrasi toko pada periode analitik owner.</p><div className="mt-5 space-y-4">{categories.length === 0 ? <p className="text-sm text-slate-500">Data kategori belum tersedia.</p> : categories.map((item) => <div key={item.categoryId ?? item.categoryName}><div className="flex justify-between text-sm"><span className="font-medium text-slate-800">{item.categoryName}</span><span className="font-semibold text-slate-700">{item.salesShare.toFixed(1)}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, item.salesShare)}%` }} /></div><p className="mt-1 text-xs text-slate-500">{formatRupiah(item.salesAmount)} · penetrasi {item.penetrationRate.toFixed(1)}%</p></div>)}</div></div>
				<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Brand dengan Performa Terbesar</h2><p className="mt-1 text-sm text-slate-600">Brand berdasarkan kontribusi omzet aktual.</p><div className="mt-5 divide-y divide-slate-100">{brands.length === 0 ? <p className="text-sm text-slate-500">Data brand belum tersedia.</p> : brands.map((item, index) => <div key={item.brandId ?? item.brandName} className="flex items-center justify-between gap-4 py-3 first:pt-0"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">{index + 1}</span><div><p className="text-sm font-medium text-slate-900">{item.brandName}</p><p className="text-xs text-slate-500">{item.salesShare.toFixed(1)}% kontribusi internal</p></div></div><p className="text-sm font-semibold text-slate-800">{formatRupiah(item.salesAmount)}</p></div>)}</div></div>
			</section> : null}
		</FeaturePage>
	);
}
