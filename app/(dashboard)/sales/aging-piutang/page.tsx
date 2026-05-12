"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { salesService } from "@/services/sales";
import { receivableService, type ReceivableAging, type ReceivableRow } from "@/services/receivable";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

const statusColors: Record<string, string> = {
	UNPAID: "bg-amber-100 text-amber-800",
	PARTIAL: "bg-blue-100 text-blue-800",
	PAID: "bg-emerald-100 text-emerald-800",
	CANCELLED: "bg-slate-100 text-slate-600",
};

export default function SalesAgingPage() {
	const searchParams = useSearchParams();
	const storeId = searchParams.get("storeId") ?? undefined;
	const [aging, setAging] = useState<ReceivableAging | null>(null);
	const [rows, setRows] = useState<ReceivableRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [agingData, receivableData] = await Promise.all([
				salesService.getAging(storeId),
				receivableService.listForSales({ page: 1, limit: 100, storeId }),
			]);
			setAging(agingData);
			setRows(receivableData.data);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat data aging piutang.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, [storeId]);

	const filteredRows = useMemo(() => {
		if (!search) return rows;
		const q = search.toLowerCase();
		return rows.filter(
			(r) =>
				r.invoiceNumber.toLowerCase().includes(q) ||
				(r.storeNameSnapshot ?? r.customerName ?? "").toLowerCase().includes(q),
		);
	}, [rows, search]);

	const buckets = [
		{ label: "Current", count: aging?.current.count ?? 0, amount: aging?.current.amount ?? 0, color: "text-emerald-700" },
		{ label: "1–30 Hari", count: aging?.days1To30.count ?? 0, amount: aging?.days1To30.amount ?? 0, color: "text-amber-700" },
		{ label: "31–60 Hari", count: aging?.days31To60.count ?? 0, amount: aging?.days31To60.amount ?? 0, color: "text-orange-700" },
		{ label: "61–90 Hari", count: aging?.days61To90.count ?? 0, amount: aging?.days61To90.amount ?? 0, color: "text-red-600" },
		{ label: "90+ Hari", count: aging?.daysOver90.count ?? 0, amount: aging?.daysOver90.amount ?? 0, color: "text-red-800" },
	];

	return (
		<SalesPortalShell title="Aging Piutang Sales">
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				{buckets.map((b) => (
					<div key={b.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{b.label}</p>
						<p className={`mt-3 text-2xl font-semibold ${b.color}`}>{formatRupiah(b.amount)}</p>
						<p className="mt-1 text-xs text-slate-500">{b.count} invoice</p>
					</div>
				))}
			</section>

			<section className="grid gap-4 md:grid-cols-3">
				{[
					{ label: "Total Piutang", value: formatRupiah(aging?.totalOutstandingAmount ?? 0) },
					{ label: "Total Invoice", value: aging?.totalReceivables ?? 0 },
					{ label: "Jatuh Tempo", value: aging?.overdueCount ?? 0 },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
				<div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between border-b border-slate-200">
					<h2 className="font-semibold text-slate-900">Daftar Piutang</h2>
					<div className="flex gap-2">
						<input
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm w-56"
							placeholder="Cari invoice / toko..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Refresh
						</button>
					</div>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
							<th className="px-4 py-3">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
						) : filteredRows.length === 0 ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Tidak ada data piutang.</td></tr>
						) : (
							filteredRows.map((r) => (
								<tr key={r.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{r.invoiceNumber}</td>
									<td className="px-4 py-3 text-slate-700">{r.storeNameSnapshot ?? r.customerName ?? "-"}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(r.dueDate)}</td>
									<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(r.totalAmount ?? r.amount)}</td>
									<td className="px-4 py-3 text-right font-medium text-slate-900">{formatRupiah(r.remainingAmount)}</td>
									<td className="px-4 py-3">
										<span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[r.status] ?? "bg-slate-100 text-slate-700"}`}>
											{r.status}
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
