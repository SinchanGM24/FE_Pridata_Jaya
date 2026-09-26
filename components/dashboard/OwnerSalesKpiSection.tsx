"use client";

import { useCallback, useEffect, useState } from "react";
import SalesKpiSummary from "@/components/dashboard/SalesKpiSummary";
import { salesKpiService, type SalesKpiRankedResult, type SalesKpiResult } from "@/services/salesKpi";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function OwnerSalesKpiSection() {
	const [period, setPeriod] = useState(currentPeriod);
	const [items, setItems] = useState<SalesKpiRankedResult[]>([]);
	const [selected, setSelected] = useState<SalesKpiResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const load = useCallback(async () => {
		setLoading(true); setError("");
		try {
			const ranking = await salesKpiService.getRanking({ period, page: 1, limit: 100 });
			setItems(ranking.items);
			setSelected((current) => current?.period === period ? current : ranking.items[0] ?? null);
		} catch { setError("Gagal memuat leaderboard KPI sales."); }
		finally { setLoading(false); }
	}, [period]);
	useEffect(() => { const id = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(id); }, [load]);
	const choose = async (item: SalesKpiRankedResult) => {
		setSelected(item);
		try { setSelected(await salesKpiService.getOne(item.salesUserId, period)); } catch { /* ranking already has the complete KPI shape */ }
	};
	return <section className="grid items-start gap-4 xl:grid-cols-[0.85fr_1.15fr]">
		<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Leaderboard KPI Sales</h2><p className="mt-1 text-sm text-slate-500">Peringkat berdasarkan skor KPI bulanan, bukan omzet saja.</p></div><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></div>
			<div className="mt-4 space-y-2">{loading ? <p className="text-sm text-slate-500">Memuat KPI...</p> : error ? <p className="text-sm text-rose-700">{error}</p> : items.map((item) => <button key={item.salesUserId} type="button" onClick={() => void choose(item)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${selected?.salesUserId === item.salesUserId ? "border-indigo-300 bg-indigo-50" : "border-slate-100 hover:border-slate-300"}`}><span><span className="font-semibold text-slate-900">#{item.rank} · {item.salesUserName}</span><span className="mt-1 block text-xs text-slate-500">{item.managedStoreCount} toko · {item.scoredCategoryCount}/4 kategori dinilai</span></span><span className="text-lg font-semibold text-indigo-700">{item.totalScore}</span></button>)}{!items.length && !loading ? <p className="text-sm text-slate-500">Belum ada sales untuk periode ini.</p> : null}</div>
		</div>
		{selected ? <SalesKpiSummary result={selected} title={`Detail KPI ${selected.salesUserName}`} /> : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">Pilih sales untuk melihat detail KPI.</div>}
	</section>;
}
