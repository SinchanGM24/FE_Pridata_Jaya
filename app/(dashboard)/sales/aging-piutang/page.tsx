"use client";

export const dynamic = "force-dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatRupiah } from "@/lib/format";
import type { StatusTone } from "@/lib/ui-labels";
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

const riskTone: Record<RisikoPiutang, StatusTone> = {
	"Risiko Rendah": "success",
	"Risiko Sedang": "warning",
	"Risiko Tinggi": "danger",
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

	const agingColumns: ResponsiveColumn<(typeof rows)[number]>[] = [
		{
			key: "nomorDokumen",
			head: "Nomor Dokumen",
			role: "title",
			render: (item) => (
				<span className="block">
					<span className="block font-medium text-slate-900">{item.nomorDokumen}</span>
					<span className="block text-xs text-slate-500">{item.namaToko}</span>
				</span>
			),
		},
		{
			key: "jatuhTempo",
			head: "Jatuh Tempo",
			role: "status",
			render: (item) => <Badge tone={riskTone[item.risiko]}>{item.jatuhTempo}</Badge>,
		},
		{
			key: "sisaHutang",
			head: "Sisa Tagihan",
			role: "amount",
			align: "right",
			render: (item) => (
				<span className="font-semibold text-rose-700">{formatRupiah(item.sisaHutang)}</span>
			),
		},
		{ key: "namaToko", head: "Nama Toko", hideOnCard: true },
		{ key: "tanggalTransaksi", head: "Tanggal Transaksi" },
		{
			key: "jumlahHari",
			head: "Umur",
			align: "right",
			render: (item) => `${item.jumlahHari} hari`,
		},
		{
			key: "totalHutang",
			head: "Total Tagihan",
			align: "right",
			render: (item) => formatRupiah(item.totalHutang),
		},
		{
			key: "dibayarkan",
			head: "Dibayarkan",
			align: "right",
			render: (item) => formatRupiah(item.dibayarkan),
		},
	];

	return (
		<SalesPortalShell title="Aging Piutang Toko Kelolaan">
			<PageFeedback error={error} onDismissError={() => setError("")} />

			<StatGrid columns={3}>
				<StatCard
					label="Total Piutang"
					value={formatRupiah(summary.totalPiutang)}
					loading={loading}
				/>
				<StatCard
					label="Piutang > 90 Hari"
					value={formatRupiah(summary.over90)}
					tone={summary.over90 > 0 ? "danger" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Risiko Tinggi"
					value={`${summary.highRiskCount} invoice`}
					tone={summary.highRiskCount > 0 ? "warning" : "success"}
					loading={loading}
				/>
			</StatGrid>

			<Card>
				<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_220px_150px]">
					<input
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
						placeholder="Cari nomor dokumen atau nama toko"
						className="h-11 rounded-xl border border-slate-300 px-3 text-sm md:h-10"
					/>
					<select
						value={riskFilter}
						onChange={(event) => {
							setRiskFilter(event.target.value as RiskFilter);
							setPage(1);
						}}
						className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm md:h-10"
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
						className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm md:h-10"
						aria-label="Jumlah baris per halaman"
					>
						{PAGE_SIZE_OPTIONS.map((size) => (
							<option key={size} value={size}>{size} baris</option>
						))}
					</select>
				</div>
			</Card>

			<section className="space-y-3">
				<ResponsiveTable
					columns={agingColumns}
					data={rows}
					getRowKey={(item) => item.id}
					loading={loading}
					emptyText="Tidak ada data aging piutang"
					emptyDescription="Coba ubah kata kunci, tingkat risiko, atau rentang filter."
				/>
				<div className="rounded-2xl border border-slate-200 bg-white">
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
				</div>
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
