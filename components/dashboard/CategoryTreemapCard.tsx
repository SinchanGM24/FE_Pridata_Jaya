"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/dashboard/EChart";
import { formatPercentage, formatRupiah } from "@/components/dashboard/chart-utils";
import type {
	OwnerCategoryPenetrationDetails,
	OwnerCategoryPenetrationSegment,
} from "@/services/dashboard";

export interface CategoryTreemapItem {
	id: string;
	categoryKey: string;
	label: string;
	salesAmount: number;
	salesShare: number;
	buyerStoreCount: number;
	totalTransactingStoreCount: number;
	penetrationRate: number;
	opportunityStoreCount: number;
	repeatStoreCount: number;
	repeatRate: number;
}

interface SelectedInsight {
	title: string;
	item: CategoryTreemapItem;
	segment: OwnerCategoryPenetrationSegment;
}

const formatDate = (value: string | null) =>
	value
		? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
		: "-";

export default function CategoryTreemapCard({
	title,
	helper,
	items,
	footer,
	onPointClick,
	loadDetails,
	className,
}: {
	title: string;
	helper: string;
	items: CategoryTreemapItem[];
	footer?: string;
	onPointClick?: (item: CategoryTreemapItem) => void;
	loadDetails?: (params: {
		categoryKey: string;
		segment: OwnerCategoryPenetrationSegment;
		search: string;
		page: number;
		limit: number;
	}) => Promise<OwnerCategoryPenetrationDetails>;
	className?: string;
}) {
	const rankedItems = useMemo(() => [...items].sort((a, b) => b.salesAmount - a.salesAmount), [items]);
	const [selectedInsight, setSelectedInsight] = useState<SelectedInsight | null>(null);
	const [details, setDetails] = useState<OwnerCategoryPenetrationDetails | null>(null);
	const [loadingDetails, setLoadingDetails] = useState(false);
	const [detailError, setDetailError] = useState("");
	const [draftSearch, setDraftSearch] = useState("");
	const [activeSearch, setActiveSearch] = useState("");
	const requestSequence = useRef(0);

	const insights = useMemo(() => {
		const activeItems = rankedItems.filter((item) => item.salesAmount > 0);
		const widestReach = [...activeItems].sort(
			(a, b) => b.buyerStoreCount - a.buyerStoreCount || b.salesAmount - a.salesAmount,
		)[0] ?? null;
		const crossSell = [...activeItems]
			.filter((item) => item.opportunityStoreCount > 0)
			.sort((a, b) => {
				const scoreA = a.salesShare * (1 - a.penetrationRate / 100);
				const scoreB = b.salesShare * (1 - b.penetrationRate / 100);
				return scoreB - scoreA || b.salesAmount - a.salesAmount;
			})[0] ?? null;
		const repeatPool = activeItems.some((item) => item.buyerStoreCount >= 2)
			? activeItems.filter((item) => item.buyerStoreCount >= 2)
			: activeItems;
		const strongestRepeat = [...repeatPool].sort(
			(a, b) => b.repeatRate - a.repeatRate || b.repeatStoreCount - a.repeatStoreCount || b.salesAmount - a.salesAmount,
		)[0] ?? null;

		return { widestReach, crossSell, strongestRepeat };
	}, [rankedItems]);

	const option = useMemo<EChartsOption>(() => ({
		animationDuration: 700,
		tooltip: {
			trigger: "item",
			backgroundColor: "#0f172a",
			borderWidth: 0,
			textStyle: { color: "#f8fafc" },
			formatter: (params: unknown) => {
				const point = params as { name?: string; value?: number; data?: { salesShare?: number } };
				return `<div style="min-width:180px">
					<div style="font-weight:600;margin-bottom:6px">${point.name ?? "-"}</div>
					<div>${formatRupiah(Number(point.value ?? 0))}</div>
					<div style="margin-top:4px;color:#cbd5e1">${formatPercentage(point.data?.salesShare ?? 0)} kontribusi</div>
				</div>`;
			},
		},
		series: [{
			type: "treemap",
			breadcrumb: { show: false },
			nodeClick: false,
			roam: false,
			label: { show: true, formatter: "{b}", color: "#f8fafc", fontWeight: 600 },
			upperLabel: { show: false },
			itemStyle: { borderColor: "#ffffff", borderWidth: 3, gapWidth: 3 },
			color: ["#0f172a", "#0ea5e9", "#10b981", "#f59e0b", "#f97316", "#6366f1", "#f43f5e"],
			data: rankedItems.map((item) => ({ name: item.label, value: item.salesAmount, salesShare: item.salesShare })),
		}],
	}), [rankedItems]);

	const fetchDetails = async (selection: SelectedInsight, page: number, search: string) => {
		if (!loadDetails) return;
		const sequence = ++requestSequence.current;
		setLoadingDetails(true);
		setDetailError("");
		try {
			const result = await loadDetails({
				categoryKey: selection.item.categoryKey,
				segment: selection.segment,
				search,
				page,
				limit: 10,
			});
			if (sequence === requestSequence.current) setDetails(result);
		} catch {
			if (sequence === requestSequence.current) {
				setDetailError("Gagal memuat detail penetrasi kategori.");
				setDetails(null);
			}
		} finally {
			if (sequence === requestSequence.current) setLoadingDetails(false);
		}
	};

	const openInsight = (selection: SelectedInsight) => {
		setSelectedInsight(selection);
		setDetails(null);
		setDraftSearch("");
		setActiveSearch("");
		void fetchDetails(selection, 1, "");
	};

	const submitSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedInsight) return;
		const search = draftSearch.trim();
		setActiveSearch(search);
		void fetchDetails(selectedInsight, 1, search);
	};

	const changePage = (page: number) => {
		if (!selectedInsight) return;
		void fetchDetails(selectedInsight, page, activeSearch);
	};

	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
			<h2 className="text-base font-semibold text-slate-900">{title}</h2>
			<p className="mt-1 text-sm text-slate-500">{helper}</p>

			{rankedItems.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
					Belum ada data kategori untuk ditampilkan.
				</div>
			) : (
				<>
					<EChart
						option={option}
						height={340}
						className="mt-5"
						onClick={onPointClick ? (params) => {
							const name = (params as { name?: string }).name;
							const item = rankedItems.find((entry) => entry.label === name);
							if (item) onPointClick(item);
						} : undefined}
					/>

					<div className="mt-5 grid gap-3 md:grid-cols-3">
						<button
							type="button"
							disabled={!insights.widestReach || !loadDetails}
							onClick={() => insights.widestReach && openInsight({ title: "Jangkauan Terluas", item: insights.widestReach, segment: "buyers" })}
							className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-default disabled:hover:bg-white"
						>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Jangkauan Terluas</p>
							<p className="mt-2 font-semibold text-slate-900">{insights.widestReach?.label ?? "Belum tersedia"}</p>
							{insights.widestReach ? <>
								<p className="mt-1 text-2xl font-semibold text-sky-600">{formatPercentage(insights.widestReach.penetrationRate)}</p>
								<p className="mt-1 text-xs leading-5 text-slate-500">
									{insights.widestReach.buyerStoreCount} dari {insights.widestReach.totalTransactingStoreCount} toko transaksi membeli kategori ini.
								</p>
							</> : null}
						</button>

						<button
							type="button"
							disabled={!insights.crossSell || !loadDetails}
							onClick={() => insights.crossSell && openInsight({ title: "Peluang Cross-sell", item: insights.crossSell, segment: "opportunities" })}
							className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-default disabled:hover:bg-white"
						>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Peluang Cross-sell</p>
							<p className="mt-2 font-semibold text-slate-900">{insights.crossSell?.label ?? "Belum ada peluang"}</p>
							{insights.crossSell ? <>
								<p className="mt-1 text-2xl font-semibold text-amber-600">{insights.crossSell.opportunityStoreCount} toko</p>
								<p className="mt-1 text-xs leading-5 text-slate-500">
									Belum membeli kategori ini; perlu ditinjau kesesuaiannya oleh sales.
								</p>
							</> : null}
						</button>

						<button
							type="button"
							disabled={!insights.strongestRepeat || !loadDetails}
							onClick={() => insights.strongestRepeat && openInsight({ title: "Repeat Terkuat", item: insights.strongestRepeat, segment: "repeat" })}
							className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-default disabled:hover:bg-white"
						>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Repeat Terkuat</p>
							<p className="mt-2 font-semibold text-slate-900">{insights.strongestRepeat?.label ?? "Belum tersedia"}</p>
							{insights.strongestRepeat ? <>
								<p className="mt-1 text-2xl font-semibold text-emerald-600">{formatPercentage(insights.strongestRepeat.repeatRate)}</p>
								<p className="mt-1 text-xs leading-5 text-slate-500">
									{insights.strongestRepeat.repeatStoreCount} dari {insights.strongestRepeat.buyerStoreCount} toko pembeli melakukan repeat.
								</p>
							</> : null}
						</button>
					</div>

					{selectedInsight ? (
						<section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
							<div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<p className="text-sm font-semibold text-slate-900">{selectedInsight.title} — {selectedInsight.item.label}</p>
									<p className="mt-1 text-xs text-slate-500">Klik sub-card lain untuk mengganti kelompok toko yang ditampilkan.</p>
								</div>
								<form onSubmit={submitSearch} className="flex gap-2">
									<input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Cari toko atau sales" className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500" />
									<button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Cari</button>
								</form>
							</div>

							{loadingDetails ? <div className="px-4 py-10 text-center text-sm text-slate-500">Memuat detail toko...</div> : detailError ? <div className="px-4 py-10 text-center text-sm text-rose-600">{detailError}</div> : details?.stores.length ? (
								<>
									<div className="overflow-x-auto">
										<table className="min-w-full divide-y divide-slate-200 text-sm">
											<thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Toko</th><th className="px-4 py-3">Sales</th><th className="px-4 py-3 text-right">Omzet Kategori</th><th className="px-4 py-3 text-right">Invoice</th><th className="px-4 py-3">Transaksi Terakhir</th></tr></thead>
											<tbody className="divide-y divide-slate-200 bg-white">
												{details.stores.map((store) => <tr key={store.storeId}><td className="px-4 py-3"><p className="font-medium text-slate-900">{store.storeName}</p><p className="mt-1 text-xs text-slate-500">{store.isActive ? "Aktif" : "Tidak aktif"}</p></td><td className="px-4 py-3 text-slate-700">{store.salesUserName}</td><td className="px-4 py-3 text-right text-slate-700">{formatRupiah(store.categorySalesAmount)}</td><td className="px-4 py-3 text-right text-slate-700">{store.categoryInvoiceCount}</td><td className="px-4 py-3 text-slate-700">{formatDate(store.lastCategoryInvoiceDate ?? store.lastTransactionDate)}</td></tr>)}
											</tbody>
										</table>
									</div>
									<div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm"><span className="text-slate-500">{details.total} toko</span><div className="flex items-center gap-2"><button type="button" disabled={details.page <= 1} onClick={() => changePage(details.page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Sebelumnya</button><span className="text-slate-600">{details.page}/{Math.max(details.totalPages, 1)}</span><button type="button" disabled={details.page >= details.totalPages} onClick={() => changePage(details.page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Berikutnya</button></div></div>
								</>
							) : <div className="px-4 py-10 text-center text-sm text-slate-500">Tidak ada toko yang sesuai untuk insight ini.</div>}
						</section>
					) : null}

					{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
				</>
			)}
		</div>
	);
}
