"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { receivableService, type ReceivableRow } from "@/services/receivable";

type RisikoPiutang = "Risiko Rendah" | "Risiko Sedang" | "Risiko Tinggi";
type JatuhTempoLevel = "Rendah" | "Sedang" | "Tinggi";

interface AgingPiutangRow {
	id: string;
	idToko: string;
	namaToko: string;
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

const normalizeStoreCode = (row: ReceivableRow, index: number) => {
	const rawStoreId = String(row.storeId || row.store?.id || "").trim();
	if (!rawStoreId) {
		return `TK-${index + 1}`;
	}

	return rawStoreId.slice(0, 12).toUpperCase();
};

const mapReceivableToAgingRow = (row: ReceivableRow, index: number): AgingPiutangRow | null => {
	const totalHutang = Number(row.totalAmount ?? row.amount ?? 0);
	const sisaHutang = Number(row.remainingAmount ?? 0);
	if (sisaHutang <= 0) {
		return null;
	}

	const dibayarkan = Math.max(0, totalHutang - sisaHutang);
	const referenceDate = row.dueDate ?? undefined;
	const dueDate = referenceDate ? new Date(referenceDate) : null;
	const transactionDate = row.invoiceDate ?? row.dueDate ?? null;
	const now = Date.now();
	const jumlahHari =
		dueDate && !Number.isNaN(dueDate.getTime())
			? Math.max(0, Math.floor((now - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
			: 0;
	const risiko = deriveRiskByDays(jumlahHari);

	return {
		id: row.id,
		idToko: normalizeStoreCode(row, index),
		namaToko: row.storeNameSnapshot ?? row.customerName ?? row.store?.name ?? "-",
		nomorDokumen: row.invoiceNumber,
		tanggalTransaksi: dateOnly(transactionDate),
		jumlahHari,
		totalHutang,
		dibayarkan,
		sisaHutang,
		jatuhTempo: riskToJatuhTempo(risiko),
		risiko,
		status: row.status,
	};
};

function SalesAgingPageContent() {
	const searchParams = useSearchParams();
	const storeId = searchParams.get("storeId") ?? undefined;
	const [rows, setRows] = useState<AgingPiutangRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [riskFilter, setRiskFilter] = useState<"all" | RisikoPiutang>("all");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const receivableRows = await receivableService.listAllForSales({
				storeId,
				sortBy: "dueDate",
				sortOrder: "asc",
			});
			const normalized = receivableRows
				.map((row, index) => mapReceivableToAgingRow(row, index))
				.filter((item): item is AgingPiutangRow => item !== null)
				.sort((left, right) => {
					const riskWeight: Record<RisikoPiutang, number> = {
						"Risiko Rendah": 1,
						"Risiko Sedang": 2,
						"Risiko Tinggi": 3,
					};
					const byRisk = riskWeight[right.risiko] - riskWeight[left.risiko];
					if (byRisk !== 0) {
						return byRisk;
					}
					const byAge = right.jumlahHari - left.jumlahHari;
					if (byAge !== 0) {
						return byAge;
					}
					return left.namaToko.localeCompare(right.namaToko);
				});
			setRows(normalized);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data aging piutang."));
		} finally {
			setLoading(false);
		}
	}, [storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return rows.filter((item) => {
			const matchSearch =
				!query ||
				item.idToko.toLowerCase().includes(query) ||
				item.namaToko.toLowerCase().includes(query) ||
				item.nomorDokumen.toLowerCase().includes(query);
			const matchRisk = riskFilter === "all" || item.risiko === riskFilter;
			return matchSearch && matchRisk;
		});
	}, [riskFilter, rows, search]);

	const summary = useMemo(
		() => ({
			totalPiutang: filteredRows.reduce((sum, item) => sum + item.sisaHutang, 0),
			over90: filteredRows.reduce(
				(sum, item) => sum + (item.jumlahHari > 90 ? item.sisaHutang : 0),
				0,
			),
			highRiskCount: filteredRows.filter((item) => item.risiko === "Risiko Tinggi").length,
		}),
		[filteredRows],
	);

	return (
		<SalesPortalShell title="Aging Piutang Toko Kelolaan">
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-3">
				{[
					{ label: "Total Piutang", value: formatRupiah(summary.totalPiutang), tone: "text-slate-900" },
					{ label: "Piutang > 90 Hari", value: formatRupiah(summary.over90), tone: "text-rose-700" },
					{ label: "Risiko Tinggi", value: `${summary.highRiskCount} toko/invoice`, tone: "text-amber-700" },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className={`mt-3 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-2">
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Cari nomor dokumen, kode toko, atau nama toko"
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
					<div className="flex flex-wrap gap-2">
						<select
							value={riskFilter}
							onChange={(event) =>
								setRiskFilter(event.target.value as "all" | RisikoPiutang)
							}
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
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Kode Toko</th>
							<th className="px-4 py-3">Nama Toko</th>
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
								<td colSpan={9} className="px-4 py-4 text-slate-600">
									Memuat data aging piutang...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={9} className="px-4 py-4 text-slate-600">
									Tidak ada data aging piutang sesuai filter.
								</td>
							</tr>
						) : (
							filteredRows.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 text-xs font-semibold text-slate-700">{item.idToko}</td>
									<td className="px-4 py-3 text-slate-700">{item.namaToko}</td>
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
										<span
											className={`rounded-full px-3 py-1 text-xs font-medium ${riskTone[item.risiko]}`}
										>
											{item.jatuhTempo}
										</span>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</SalesPortalShell>
	);
}

export default function SalesAgingPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
					Memuat halaman aging piutang...
				</div>
			}
		>
			<SalesAgingPageContent />
		</Suspense>
	);
}
