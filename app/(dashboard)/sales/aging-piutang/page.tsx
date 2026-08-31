"use client";

export const dynamic = "force-dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import PaginationControls from "@/components/shared/PaginationControls";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	receivableService,
	type AgingBucket,
	type PaginatedMeta,
	type ReceivableAging,
	type ReceivableRow,
} from "@/services/receivable";
import { salesService } from "@/services/sales";

type RisikoPiutang = "Risiko Rendah" | "Risiko Sedang" | "Risiko Tinggi";
type JatuhTempoLevel = "Rendah" | "Sedang" | "Tinggi";
type RiskFilter = "all" | RisikoPiutang;

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const riskFilterToApi: Record<Exclude<RiskFilter, "all">, "LOW" | "MEDIUM" | "HIGH"> = {
	"Risiko Rendah": "LOW",
	"Risiko Sedang": "MEDIUM",
	"Risiko Tinggi": "HIGH",
};

type SalesAgingSummary = Partial<ReceivableAging> & {
	total?: AgingBucket;
	aging?: Partial<ReceivableAging>;
};

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
	"Risiko Rendah": "border border-emerald-200 bg-emerald-50 text-emerald-700",
	"Risiko Sedang": "border border-amber-200 bg-amber-50 text-amber-700",
	"Risiko Tinggi": "border border-rose-200 bg-rose-50 text-rose-700",
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
	const [agingSummary, setAgingSummary] = useState<SalesAgingSummary | null>(null);
	const [meta, setMeta] = useState<PaginatedMeta | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

	const loadSummary = useCallback(async () => {
		try {
			const result = await salesService.getAging(storeId);
			setAgingSummary(result as SalesAgingSummary);
		} catch {
			setAgingSummary(null);
		}
	}, [storeId]);

	const loadPage = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const result = await receivableService.listForSales({
				page,
				limit: pageSize,
				storeId,
				sortBy: "dueDate",
				sortOrder: "asc",
				search: search.trim() || undefined,
				agingRisk: riskFilter === "all" ? undefined : riskFilterToApi[riskFilter],
			});
			const resolvedMeta = result.meta ?? {
				currentPage: page,
				totalPages: result.data.length < pageSize ? page : page + 1,
				totalItems: result.data.length,
				itemsPerPage: pageSize,
			};
			const offset = (resolvedMeta.currentPage - 1) * resolvedMeta.itemsPerPage;
			const normalized = result.data
				.map((row, index) => mapReceivableToAgingRow(row, offset + index))
				.filter((item): item is AgingPiutangRow => item !== null);
			setRows(normalized);
			setMeta(resolvedMeta);
			if (resolvedMeta.totalPages > 0 && page > resolvedMeta.totalPages) {
				setPage(resolvedMeta.totalPages);
			}
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data aging piutang."));
			setRows([]);
			setMeta(null);
		} finally {
			setLoading(false);
		}
	}, [page, pageSize, riskFilter, search, storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadSummary();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [loadSummary]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadPage();
		}, 350);
		return () => window.clearTimeout(timer);
	}, [loadPage]);

	const summary = useMemo(() => {
		const source = agingSummary?.aging ?? agingSummary;
		return {
			totalPiutang: agingSummary?.total?.amount ?? agingSummary?.totalOutstandingAmount ?? 0,
			over90: source?.daysOver90?.amount ?? 0,
			highRiskCount: source?.daysOver90?.count ?? 0,
		};
	}, [agingSummary]);

	const totalPages = Math.max(1, meta?.totalPages ?? 1);
	const currentPage = Math.min(meta?.currentPage ?? page, totalPages);

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
					{ label: "Risiko Tinggi", value: `${summary.highRiskCount} invoice`, tone: "text-amber-700" },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className={`mt-3 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_150px]">
					<input
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
						placeholder="Cari nomor dokumen atau nama toko"
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
					<select
						value={riskFilter}
						onChange={(event) => {
							setRiskFilter(event.target.value as RiskFilter);
							setPage(1);
						}}
						className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						<option value="all">Semua Kategori Risiko</option>
						<option value="Risiko Rendah">Risiko Rendah</option>
						<option value="Risiko Sedang">Risiko Sedang</option>
						<option value="Risiko Tinggi">Risiko Tinggi</option>
					</select>
					<select
						value={pageSize}
						onChange={(event) => {
							setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
							setPage(1);
						}}
						className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
						aria-label="Jumlah baris per halaman"
					>
						{PAGE_SIZE_OPTIONS.map((size) => (
							<option key={size} value={size}>{size} baris</option>
						))}
					</select>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
					<p>
						Menampilkan {rows.length} dari {meta?.totalItems ?? rows.length} invoice.
					</p>
					<p>Halaman {currentPage} dari {totalPages}</p>
				</div>
				<div className="overflow-x-auto">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
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
								<td colSpan={8} className="px-4 py-4 text-slate-600">
									Memuat data aging piutang...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={8} className="px-4 py-4 text-slate-600">
									Tidak ada data aging piutang sesuai filter.
								</td>
							</tr>
						) : (
							rows.map((item) => (
								<tr key={item.id}>
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
											className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${riskTone[item.risiko]}`}
										>
											{item.jatuhTempo}
										</span>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
				</div>
				<PaginationControls
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={meta?.totalItems ?? rows.length}
					currentItemCount={rows.length}
					pageSize={pageSize}
					itemLabel="invoice"
					loading={loading}
					onPageChange={setPage}
				/>
			</section>
		</SalesPortalShell>
	);
}
export default function SalesAgingPage() {
	return (
		<Suspense fallback={null}>
			<SalesAgingPageContent />
		</Suspense>
	);
}
