"use client";

import { useState } from "react";
import Link from "next/link";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import { useServerValue } from "@/hooks/useServerValue";
import { APP_TIME_ZONE, formatAppDate } from "@/lib/datetime";
import {
	damagedGoodsPeriodRange,
	damagedGoodsPeriods,
	damagedGoodsService,
	damagedGoodsSourceLabel,
	type DamagedGoodsFilters,
	type DamagedGoodsPeriod,
	type DamagedGoodsSource,
} from "@/services/damaged-goods";

const PAGE_SIZE = 20;
const ALL_PARTIES = "Semua Pihak";

const sourceTone: Record<DamagedGoodsSource, string> = {
	receipt: "border border-amber-200 bg-amber-50 text-amber-700",
	return: "bg-sky-100 text-sky-800",
};

export default function BarangRusakPage() {
	const [search, setSearch] = useState("");
	const [sourceFilter, setSourceFilter] = useState<"" | DamagedGoodsSource>("");
	const [periodFilter, setPeriodFilter] = useState<DamagedGoodsPeriod>("Semua Periode");
	const [partyFilter, setPartyFilter] = useState(ALL_PARTIES);

	const debouncedSearch = useDebouncedValue(search.trim());
	// Hari bisnis WITA, bukan zona waktu browser.
	const today = new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
	const filters: DamagedGoodsFilters = {
		source: sourceFilter || undefined,
		party: partyFilter === ALL_PARTIES ? undefined : partyFilter,
		search: debouncedSearch || undefined,
		...damagedGoodsPeriodRange(periodFilter, today),
	};
	const filterKey = `${debouncedSearch}|${sourceFilter}|${periodFilter}|${today}|${partyFilter}`;

	const list = usePagedList((page, limit) => damagedGoodsService.list({ ...filters, page, limit }), {
		filterKey,
		errorMessage: "Gagal memuat data barang rusak.",
		pageSize: PAGE_SIZE,
	});
	const summary = useServerValue(() => damagedGoodsService.summary(filters), {
		key: filterKey,
		errorMessage: "Gagal memuat ringkasan barang rusak.",
	});

	const loadError = list.error || summary.error;
	const retryLoad = () => {
		if (list.error) list.reload();
		if (summary.error) summary.reload();
	};

	// Pilihan aktif tetap ada walau ringkasan belum/ gagal dimuat.
	const partyOptions = Array.from(
		new Set([ALL_PARTIES, ...(partyFilter === ALL_PARTIES ? [] : [partyFilter]), ...(summary.data?.parties ?? [])]),
	);

	return (
		<FeaturePage
			title="Monitoring Barang Rusak"
			description="Barang rusak terbentuk otomatis dari penerimaan supplier yang tercatat rusak dan retur customer yang diverifikasi rusak."
		>
			{/* Galat muat tidak bisa ditutup: tanpanya tabel tampak kosong atau angka tampak "—" tanpa sebab. */}
			<PageFeedback error={loadError} onRetry={retryLoad} />

			<section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 shadow-sm">
				Sumber kerusakan dipisahkan menjadi <span className="font-semibold">Penerimaan Barang</span>{" "}
				untuk kerusakan dari supplier dan <span className="font-semibold">Retur Barang</span> untuk
				kerusakan dari barang customer yang kembali ke gudang.
			</section>

			<section className="grid gap-4 md:grid-cols-4">
				{(
					[
						["Total Laporan", summary.data?.totalEntries],
						["Total Unit Rusak", summary.data?.totalUnits],
						["Dari Penerimaan", summary.data?.receiptEntries],
						["Dari Retur", summary.data?.returnEntries],
					] as const
				).map(([label, value]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">{label}</p>
						{/* "—" selama ringkasan belum ada (memuat atau gagal), bukan 0 yang menyesatkan. */}
						<p className="mt-2 text-3xl font-semibold text-slate-900">{value ?? "—"}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-4">
					<input
						value={search}
						maxLength={100}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Cari produk, laporan, pihak, atau gudang..."
						aria-label="Cari barang rusak"
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
					/>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Filter sumber"
						value={sourceFilter}
						onChange={(event) => setSourceFilter(event.target.value as "" | DamagedGoodsSource)}
					>
						<option value="">Semua Sumber</option>
						<option value="receipt">{damagedGoodsSourceLabel.receipt}</option>
						<option value="return">{damagedGoodsSourceLabel.return}</option>
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Filter periode"
						value={periodFilter}
						onChange={(event) => setPeriodFilter(event.target.value as DamagedGoodsPeriod)}
					>
						{damagedGoodsPeriods.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						aria-label="Filter pihak"
						value={partyFilter}
						onChange={(event) => setPartyFilter(event.target.value)}
					>
						{partyOptions.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Tanggal</th>
								<th className="px-4 py-3">Produk</th>
								<th className="px-4 py-3">Sumber Data</th>
								<th className="px-4 py-3">Gudang</th>
								<th className="px-4 py-3 text-right">Total Rusak</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{list.items.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={6}>
										{list.loading
											? "Memuat data barang rusak..."
											: list.error
												? "Data barang rusak belum bisa dimuat."
												: "Belum ada barang rusak yang tercatat dari penerimaan atau retur sesuai filter."}
									</td>
								</tr>
							) : (
								list.items.map((item) => (
									<tr key={item.productId}>
										<td className="px-4 py-3 text-slate-700">{formatAppDate(item.latestReportDate)}</td>
										<td className="px-4 py-3 font-medium text-slate-900">{item.productName}</td>
										<td className="px-4 py-3">
											<div className="flex flex-wrap gap-1.5">
												{item.sources.map((source) => (
													<span
														key={source}
														className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sourceTone[source]}`}
													>
														{damagedGoodsSourceLabel[source]}
													</span>
												))}
											</div>
										</td>
										<td className="px-4 py-3 text-slate-700">
											{item.warehouses.length > 2
												? `${item.warehouses.slice(0, 2).join(", ")} +${item.warehouses.length - 2}`
												: item.warehouses.join(", ") || "-"}
										</td>
										<td className="px-4 py-3 text-right font-semibold text-rose-700">{item.totalQuantity}</td>
										<td className="px-4 py-3 text-right">
											<Link
												href={`/gudang/barang-rusak/${item.productId}`}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
											>
												Detail
											</Link>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				<PaginationControls
					currentPage={list.page}
					totalPages={list.totalPages}
					totalItems={list.totalItems}
					currentItemCount={list.items.length}
					pageSize={PAGE_SIZE}
					itemLabel="produk rusak"
					loading={list.loading}
					onPageChange={list.setPage}
				/>
			</section>
		</FeaturePage>
	);
}
