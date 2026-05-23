"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { receivableService, type ReceivableRow } from "@/services/receivable";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";
import { storesService } from "@/services/stores";

type RisikoPiutang = "Risiko Rendah" | "Risiko Sedang" | "Risiko Tinggi";
type JatuhTempoLevel = "Rendah" | "Sedang" | "Tinggi";

interface AgingPiutangRow {
	id: string;
	nomorDokumen: string;
	tanggalTransaksi: string;
	jumlahHari: number;
	totalHutang: number;
	dibayarkan: number;
	sisaHutang: number;
	jatuhTempo: JatuhTempoLevel;
	risiko: RisikoPiutang;
	status: string;
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

const deriveRiskByDays = (days: number): RisikoPiutang => {
	if (days > 90) return "Risiko Tinggi";
	if (days > 60) return "Risiko Sedang";
	return "Risiko Rendah";
};

const riskToJatuhTempo = (risiko: RisikoPiutang): JatuhTempoLevel => {
	if (risiko === "Risiko Tinggi") return "Tinggi";
	if (risiko === "Risiko Sedang") return "Sedang";
	return "Rendah";
};

const riskTone: Record<RisikoPiutang, string> = {
	"Risiko Rendah": "bg-emerald-100 text-emerald-800",
	"Risiko Sedang": "bg-amber-100 text-amber-800",
	"Risiko Tinggi": "bg-rose-100 text-rose-800",
};

const mapReceivableToAgingRow = (row: ReceivableRow): AgingPiutangRow | null => {
	const totalHutang = Number(row.totalAmount ?? row.amount ?? 0);
	const sisaHutang = Number(row.remainingAmount ?? 0);
	if (sisaHutang <= 0) return null;

	const dueDate = row.dueDate ? new Date(row.dueDate) : null;
	const jumlahHari =
		dueDate && !Number.isNaN(dueDate.getTime())
			? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
			: 0;
	const risiko = deriveRiskByDays(jumlahHari);

	return {
		id: row.id,
		nomorDokumen: row.invoiceNumber,
		tanggalTransaksi: dateOnly(row.invoiceDate ?? row.dueDate ?? null),
		jumlahHari,
		totalHutang,
		dibayarkan: Math.max(0, totalHutang - sisaHutang),
		sisaHutang,
		jatuhTempo: riskToJatuhTempo(risiko),
		risiko,
		status: row.status,
	};
};

export default function SalesStoreAgingPiutangPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();

	const [storeName, setStoreName] = useState(actingStore?.storeName || "Toko");
	const [rows, setRows] = useState<AgingPiutangRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [riskFilter, setRiskFilter] = useState<"all" | RisikoPiutang>("all");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [receivableRows, store] = await Promise.all([
				receivableService.listAllForSales({ storeId, sortBy: "dueDate", sortOrder: "asc" }),
				storesService.getById(storeId).catch(() => null),
			]);
			const normalized = receivableRows
				.map(mapReceivableToAgingRow)
				.filter((item): item is AgingPiutangRow => item !== null)
				.sort((left, right) => right.jumlahHari - left.jumlahHari);
			setRows(normalized);
			setStoreName(store?.name || actingStore?.storeName || "Toko");
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat aging piutang toko."));
		} finally {
			setLoading(false);
		}
	}, [actingStore?.storeName, storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const filteredRows = useMemo(
		() => rows.filter((item) => riskFilter === "all" || item.risiko === riskFilter),
		[riskFilter, rows],
	);

	const summary = useMemo(
		() => ({
			totalPiutang: filteredRows.reduce((sum, item) => sum + item.sisaHutang, 0),
			over90: filteredRows.reduce((sum, item) => sum + (item.jumlahHari > 90 ? item.sisaHutang : 0), 0),
			highRiskCount: filteredRows.filter((item) => item.risiko === "Risiko Tinggi").length,
		}),
		[filteredRows],
	);

	return (
		<TokoFeatureLayout
			title="Aging Piutang"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		>
			<section className="rounded-lg border border-sky-100 bg-sky-50 p-4">
				<p className="text-sm font-semibold text-slate-900">{storeName}</p>
				<p className="mt-1 text-xs text-slate-600">
					Aging piutang ini hanya menampilkan invoice berjalan dari toko ini.
				</p>
			</section>

			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-xs text-slate-500">Total Piutang</p>
					<p className="mt-2 text-xl font-bold text-slate-900">{formatRupiah(summary.totalPiutang)}</p>
				</div>
				<div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
					<p className="text-xs text-rose-700">Piutang &gt; 90 Hari</p>
					<p className="mt-2 text-xl font-bold text-rose-700">{formatRupiah(summary.over90)}</p>
				</div>
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
					<p className="text-xs text-amber-700">Risiko Tinggi</p>
					<p className="mt-2 text-xl font-bold text-amber-700">{summary.highRiskCount} invoice</p>
				</div>
			</section>

			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap gap-2">
					<select
						value={riskFilter}
						onChange={(event) => setRiskFilter(event.target.value as "all" | RisikoPiutang)}
						className="min-w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						<option value="all">Semua Kategori Risiko</option>
						<option value="Risiko Rendah">Risiko Rendah</option>
						<option value="Risiko Sedang">Risiko Sedang</option>
						<option value="Risiko Tinggi">Risiko Tinggi</option>
					</select>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</section>

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Nomor Dokumen</th>
							<th className="px-4 py-3">Tanggal Transaksi</th>
							<th className="px-4 py-3 text-right">Jumlah Hari</th>
							<th className="px-4 py-3 text-right">Total Tagihan</th>
							<th className="px-4 py-3 text-right">Dibayarkan</th>
							<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Memuat data aging piutang...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Tidak ada aging piutang untuk toko ini.
								</td>
							</tr>
						) : (
							filteredRows.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 text-slate-700">
										<div className="font-medium text-slate-900">{item.nomorDokumen}</div>
										<div className="text-xs text-slate-500">{item.status}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{item.tanggalTransaksi}</td>
									<td className="px-4 py-3 text-right text-slate-700">{item.jumlahHari} hari</td>
									<td className="px-4 py-3 text-right text-slate-700">{formatRupiah(item.totalHutang)}</td>
									<td className="px-4 py-3 text-right text-slate-700">{formatRupiah(item.dibayarkan)}</td>
									<td className="px-4 py-3 text-right font-semibold text-rose-700">
										{formatRupiah(item.sisaHutang)}
									</td>
									<td className="px-4 py-3">
										<span className={`rounded-full px-3 py-1 text-xs font-medium ${riskTone[item.risiko]}`}>
											{item.jatuhTempo}
										</span>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</TokoFeatureLayout>
	);
}
