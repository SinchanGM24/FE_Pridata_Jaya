"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PaginationControls from "@/components/shared/PaginationControls";
import { getApiErrorMessage } from "@/lib/api-errors";
import type { DamagedGoodsItem } from "@/services/damaged-goods";
import {
	groupDamagedGoodsRows,
	loadDamagedGoodsRows,
	type DamagedGoodsGroup,
} from "@/services/damaged-goods-groups";

const PAGE_SIZE = 10;

const sourceTone: Record<DamagedGoodsItem["source"], string> = {
	"Penerimaan Barang": "border border-amber-200 bg-amber-50 text-amber-700",
	"Retur Barang": "bg-sky-100 text-sky-800",
};

export default function BarangRusakDetailPage() {
	const params = useParams<{ groupId: string }>();
	const groupId = params.groupId;
	const [group, setGroup] = useState<DamagedGoodsGroup | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [sourceFilter, setSourceFilter] = useState<"Semua Sumber" | DamagedGoodsItem["source"]>("Semua Sumber");
	const [page, setPage] = useState(1);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const rows = await loadDamagedGoodsRows();
			const groups = groupDamagedGoodsRows(rows);
			setGroup(groups.find((item) => item.id === groupId) ?? null);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat detail barang rusak."));
		} finally {
			setLoading(false);
		}
	}, [groupId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const filteredRecords = useMemo(() => {
		const query = search.trim().toLowerCase();
		return (group?.records ?? []).filter((record) => {
			const matchSource = sourceFilter === "Semua Sumber" || record.source === sourceFilter;
			const matchSearch =
				!query ||
				[
					record.reportNumber,
					record.referenceNumber,
					record.relatedParty,
					record.warehouseName,
					record.description,
					record.reportDate,
				]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(query));
			return matchSource && matchSearch;
		});
	}, [group, search, sourceFilter]);
	const filteredTotalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
	const filteredCurrentPage = Math.min(page, filteredTotalPages);
	const paginatedRecords = useMemo(() => {
		const start = (filteredCurrentPage - 1) * PAGE_SIZE;
		return filteredRecords.slice(start, start + PAGE_SIZE);
	}, [filteredCurrentPage, filteredRecords]);

	return (
		<FeaturePage
			title="Detail Barang Rusak"
			description="Rincian sumber pembentuk stok barang rusak untuk satu jenis produk."
		>
			<div>
				<Link
					href="/gudang/barang-rusak"
					className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
				>
					<span aria-hidden="true">←</span>
					<span>Kembali ke Barang Rusak</span>
				</Link>
			</div>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{loading ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
					Memuat detail barang rusak...
				</section>
			) : !group ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
					Data barang rusak tidak ditemukan.
				</section>
			) : (
				<>
					<section className="grid gap-4 md:grid-cols-4">
						{[
							{ label: "Produk", value: group.productName },
							{ label: "Total Rusak", value: group.totalQuantity },
							{ label: "Jumlah Sumber", value: group.records.length },
							{ label: "Update Terakhir", value: String(group.latestReportDate).slice(0, 10) },
						].map((item) => (
							<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
									{item.label}
								</p>
								<p className="mt-2 font-semibold text-slate-900">{item.value}</p>
							</div>
						))}
					</section>

					<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-3">
							<div>
								<h2 className="text-lg font-semibold text-slate-900">Rincian Sumber Barang Rusak</h2>
								<p className="mt-1 text-sm text-slate-500">
									Menampilkan {paginatedRecords.length} dari {filteredRecords.length} sumber terfilter. Halaman {filteredCurrentPage} dari {filteredTotalPages}
								</p>
							</div>
							<div className="grid gap-3 md:grid-cols-[1fr_220px]">
								<input
									value={search}
									onChange={(event) => {
										setSearch(event.target.value);
										setPage(1);
									}}
									placeholder="Cari laporan, referensi, pihak, gudang, atau keterangan..."
									className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
								/>
								<select
									value={sourceFilter}
									onChange={(event) => {
										setSourceFilter(event.target.value as "Semua Sumber" | DamagedGoodsItem["source"]);
										setPage(1);
									}}
									className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
								>
									<option value="Semua Sumber">Semua Sumber</option>
									<option value="Penerimaan Barang">Penerimaan Barang</option>
									<option value="Retur Barang">Retur Barang</option>
								</select>
							</div>
						</div>
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-4 py-3">Tanggal</th>
										<th className="px-4 py-3">Sumber</th>
										<th className="px-4 py-3">Nomor Laporan</th>
										<th className="px-4 py-3">Referensi</th>
										<th className="px-4 py-3">Pihak</th>
										<th className="px-4 py-3">Gudang</th>
										<th className="px-4 py-3 text-right">Qty</th>
										<th className="px-4 py-3">Keterangan</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{paginatedRecords.length === 0 ? (
										<tr>
											<td colSpan={8} className="px-4 py-6 text-center text-slate-500">
												Tidak ada sumber barang rusak sesuai filter.
											</td>
										</tr>
									) : null}
									{paginatedRecords.map((record) => (
										<tr key={record.id}>
											<td className="px-4 py-3 text-slate-700">{String(record.reportDate).slice(0, 10)}</td>
											<td className="px-4 py-3">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sourceTone[record.source]}`}>
													{record.source}
												</span>
											</td>
											<td className="px-4 py-3 font-medium text-slate-900">{record.reportNumber}</td>
											<td className="px-4 py-3 text-slate-700">{record.referenceNumber || "-"}</td>
											<td className="px-4 py-3 text-slate-700">{record.relatedParty || "-"}</td>
											<td className="px-4 py-3 text-slate-700">{record.warehouseName || "-"}</td>
											<td className="px-4 py-3 text-right font-semibold text-rose-700">{record.quantity}</td>
											<td className="px-4 py-3 text-slate-700">{record.description || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<PaginationControls
							currentPage={filteredCurrentPage}
							totalPages={filteredTotalPages}
							totalItems={filteredRecords.length}
							currentItemCount={paginatedRecords.length}
							pageSize={PAGE_SIZE}
							itemLabel="riwayat barang rusak"
							onPageChange={setPage}
						/>
					</section>
				</>
			)}
		</FeaturePage>
	);
}
