"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import { useServerValue } from "@/hooks/useServerValue";
import { formatAppDate } from "@/lib/datetime";
import {
	damagedGoodsService,
	damagedGoodsSourceLabel,
	type DamagedGoodsSource,
} from "@/services/damaged-goods";

const PAGE_SIZE = 20;

const sourceTone: Record<DamagedGoodsSource, string> = {
	receipt: "border border-amber-200 bg-amber-50 text-amber-700",
	return: "bg-sky-100 text-sky-800",
};

// Server mengirim `description: null` untuk catatan kosong; teks bawaan tetap milik halaman.
const defaultDescription: Record<DamagedGoodsSource, string> = {
	receipt: "Barang rusak terdeteksi saat penerimaan supplier.",
	return: "Barang retur diverifikasi rusak oleh gudang.",
};

export default function BarangRusakDetailPage() {
	const { productId } = useParams<{ productId: string }>();
	// key: pindah produk = state pencarian/halaman baru, bukan sisa produk sebelumnya.
	return <BarangRusakDetail key={productId} productId={productId} />;
}

function BarangRusakDetail({ productId }: { productId: string }) {
	const [search, setSearch] = useState("");
	const [sourceFilter, setSourceFilter] = useState<"" | DamagedGoodsSource>("");
	const debouncedSearch = useDebouncedValue(search.trim());

	// Kartu header = total produk tanpa filter rincian, seperti halaman lama.
	const header = useServerValue(
		async () => (await damagedGoodsService.list({ productId, limit: 1 })).items[0] ?? null,
		{ key: productId, errorMessage: "Gagal memuat detail barang rusak." },
	);
	const list = usePagedList(
		(page, limit) =>
			damagedGoodsService.entries({
				productId,
				source: sourceFilter || undefined,
				search: debouncedSearch || undefined,
				page,
				limit,
			}),
		{
			filterKey: `${productId}|${sourceFilter}|${debouncedSearch}`,
			errorMessage: "Gagal memuat rincian sumber barang rusak.",
			pageSize: PAGE_SIZE,
		},
	);

	const loadError = header.error || list.error;
	const retryLoad = () => {
		if (header.error) header.reload();
		if (list.error) list.reload();
	};
	const group = header.data;

	return (
		<FeaturePage
			title="Detail Barang Rusak"
			description="Rincian sumber pembentuk stok barang rusak untuk satu jenis produk."
		>
			<PageFeedback error={loadError} onRetry={retryLoad} />

			<div>
				<Link
					href="/gudang/barang-rusak"
					className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
				>
					<span aria-hidden="true">←</span>
					<span>Kembali ke Barang Rusak</span>
				</Link>
			</div>

			{!group ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
					{header.loading
						? "Memuat detail barang rusak..."
						: header.error
							? "Detail barang rusak belum bisa dimuat."
							: "Data barang rusak tidak ditemukan."}
				</section>
			) : (
				<>
					<section className="grid gap-4 md:grid-cols-4">
						{[
							{ label: "Produk", value: group.productName },
							{ label: "Total Rusak", value: group.totalQuantity },
							{ label: "Jumlah Sumber", value: group.entryCount },
							{ label: "Update Terakhir", value: formatAppDate(group.latestReportDate) },
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
							<h2 className="text-lg font-semibold text-slate-900">Rincian Sumber Barang Rusak</h2>
							<div className="grid gap-3 md:grid-cols-[1fr_220px]">
								<input
									value={search}
									maxLength={100}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Cari laporan, referensi, pihak, gudang, atau keterangan..."
									aria-label="Cari rincian barang rusak"
									className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
								/>
								<select
									value={sourceFilter}
									aria-label="Filter sumber"
									onChange={(event) => setSourceFilter(event.target.value as "" | DamagedGoodsSource)}
									className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
								>
									<option value="">Semua Sumber</option>
									<option value="receipt">{damagedGoodsSourceLabel.receipt}</option>
									<option value="return">{damagedGoodsSourceLabel.return}</option>
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
									{list.items.length === 0 ? (
										<tr>
											<td colSpan={8} className="px-4 py-6 text-center text-slate-500">
												{list.loading
													? "Memuat rincian sumber barang rusak..."
													: list.error
														? "Rincian sumber barang rusak belum bisa dimuat."
														: "Tidak ada sumber barang rusak sesuai filter."}
											</td>
										</tr>
									) : null}
									{list.items.map((record) => (
										<tr key={record.id}>
											<td className="px-4 py-3 text-slate-700">{formatAppDate(record.reportDate)}</td>
											<td className="px-4 py-3">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sourceTone[record.source]}`}>
													{damagedGoodsSourceLabel[record.source]}
												</span>
											</td>
											<td className="px-4 py-3 font-medium text-slate-900">{record.reportNumber}</td>
											<td className="px-4 py-3 text-slate-700">{record.referenceNumber || "-"}</td>
											<td className="px-4 py-3 text-slate-700">{record.relatedParty || "-"}</td>
											<td className="px-4 py-3 text-slate-700">{record.warehouseName || "-"}</td>
											<td className="px-4 py-3 text-right font-semibold text-rose-700">{record.quantity}</td>
											<td className="px-4 py-3 text-slate-700">
												{record.description || defaultDescription[record.source]}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<PaginationControls
							currentPage={list.page}
							totalPages={list.totalPages}
							totalItems={list.totalItems}
							currentItemCount={list.items.length}
							pageSize={PAGE_SIZE}
							itemLabel="riwayat barang rusak"
							loading={list.loading}
							onPageChange={list.setPage}
						/>
					</section>
				</>
			)}
		</FeaturePage>
	);
}
