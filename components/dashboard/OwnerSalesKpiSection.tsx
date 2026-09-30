"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRupiah } from "@/lib/format";
import PaginationControls from "@/components/shared/PaginationControls";
import { salesKpiService, type SalesKpiCategory, type SalesKpiConfig, type SalesKpiCategoryKey, type SalesKpiRankedResult, type SalesKpiResult, type SalesKpiTargetPayload } from "@/services/salesKpi";

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const manualKeys = ["targetAmount", "targetActiveStores", "targetNewActiveStores"] as const;
const fieldLabels = { targetAmount: "Target omzet", targetActiveStores: "Target outlet aktif", targetNewActiveStores: "Target new open outlet" };
const categoryTone = (category: SalesKpiCategory) => !category.scored ? "bg-slate-100 text-slate-500" : (category.achievementPercent ?? 0) >= 100 ? "bg-emerald-50 text-emerald-700" : (category.achievementPercent ?? 0) >= 80 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
const number = (value: number) => value.toLocaleString("id-ID", { maximumFractionDigits: 1 });
const actualLabel = (category: SalesKpiCategory) => category.unit === "currency" ? formatRupiah(category.actual) : category.key === "collectionRate" ? formatRupiah(category.actual) : number(category.actual);

const monthOptions = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function OwnerSalesKpiSection({ availableYears = [] }: { availableYears?: number[] }) {
  const [period, setPeriod] = useState(currentPeriod);
  const [items, setItems] = useState<SalesKpiRankedResult[]>([]);
  const [selected, setSelected] = useState<SalesKpiResult | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [targetValues, setTargetValues] = useState<Record<(typeof manualKeys)[number], string>>({ targetAmount: "", targetActiveStores: "", targetNewActiveStores: "" });
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SalesKpiConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(currentPeriod);
  const [weights, setWeights] = useState<Record<SalesKpiCategoryKey, string>>({ omzet: "40", activeStores: "25", newActiveStores: "15", collectionRate: "20" });
  const [cap, setCap] = useState("120");
  const [year, month] = period.split("-").map(Number);
  const years = useMemo(() => Array.from(new Set([new Date().getFullYear(), ...availableYears])).sort((a, b) => b - a), [availableYears]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [ranking, nextConfig] = await Promise.all([salesKpiService.getRanking({ period, page: 1, limit: 100 }), salesKpiService.getConfig(period)]); setItems(ranking.items); setSelected(ranking.items[0] ?? null); setConfig(nextConfig); setWeights({ omzet: String(nextConfig.weights.omzet), activeStores: String(nextConfig.weights.activeStores), newActiveStores: String(nextConfig.weights.newActiveStores), collectionRate: String(nextConfig.weights.collectionRate) }); setCap(String(nextConfig.achievementCapPercent)); }
    catch { setError("Gagal memuat monitoring KPI sales."); }
    finally { setLoading(false); }
  }, [period]);
  useEffect(() => { const id = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(id); }, [load]);
  const visible = useMemo(() => items.filter((item) => item.salesUserName.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize);
  const choose = async (item: SalesKpiRankedResult) => {
    setEditing(false); setSelected(item);
    try { setSelected(await salesKpiService.getOne(item.salesUserId, period)); } catch { /* row remains a usable fallback */ }
  };
  const openEditor = () => {
    if (!selected) return;
    setTargetValues(Object.fromEntries(manualKeys.map((key) => {
      const category = selected.categories.find((item) => item.key === (key === "targetAmount" ? "omzet" : key === "targetActiveStores" ? "activeStores" : "newActiveStores"));
      return [key, category?.target === null || category?.target === undefined ? "" : String(category.target)];
    })) as Record<(typeof manualKeys)[number], string>);
    setEditing(true);
  };
  const saveTargets = async () => {
    if (!selected || period < currentPeriod()) return;
    const payload: SalesKpiTargetPayload = { effectiveFrom: period };
    for (const key of manualKeys) {
      const value = targetValues[key];
      if (value === "") { payload[key] = null; continue; }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0 || (key !== "targetAmount" && !Number.isInteger(parsed))) { setError("Target harus berupa angka positif; target outlet harus bilangan bulat."); return; }
      payload[key] = parsed;
    }
    setSaving(true);
    try { await salesKpiService.upsertTarget(selected.salesUserId, payload); setEditing(false); await load(); }
    catch { setError("Gagal menyimpan target KPI sales."); }
    finally { setSaving(false); }
  };
  const saveConfig = async () => {
    const total = Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (total !== 100 || Number(cap) < 100 || Number(cap) > 1000 || effectiveFrom < currentPeriod()) { setError("Bobot harus berjumlah 100% dan cap harus antara 100–1000."); return; }
    setSaving(true);
    try { await salesKpiService.updateConfig({ effectiveFrom, achievementCapPercent: Number(cap), weights: Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number(value)])) as SalesKpiConfig["weights"] }); setConfigOpen(false); await load(); }
    catch { setError("Gagal menyimpan bobot KPI."); }
    finally { setSaving(false); }
  };
  const summary = useMemo(() => ({ scored: items.filter((item) => item.scoredCategoryCount > 0).length, average: items.length ? items.reduce((sum, item) => sum + item.totalScore, 0) / items.length : 0, complete: items.filter((item) => item.hasCompleteTarget).length, unpaid: items.reduce((sum, item) => sum + (item.collection?.unpaidDueAmount ?? 0), 0) }), [items]);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Sales performance</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Monitoring KPI Sales</h2><p className="mt-1 text-sm text-slate-500">Capaian dihitung dari transaksi bulan yang dipilih. Klik sales untuk melihat detail dan mengatur targetnya.</p></div><button type="button" onClick={() => setConfigOpen(true)} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700">Atur Bobot KPI</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Sales dinilai", summary.scored], ["Skor rata-rata", summary.average.toFixed(1)], ["Target lengkap", summary.complete], ["Sisa tagihan bulan ini", formatRupiah(summary.unpaid)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p></div>)}</div>
    {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4"><div><h3 className="font-semibold text-slate-900">Leaderboard KPI</h3><p className="text-xs text-slate-500">Nilai utama adalah realisasi dari transaksi; persen muncul bila target tersedia.</p></div><div className="flex flex-wrap gap-2"><label className="text-sm text-slate-600">Bulan<select value={month} onChange={(event) => { setPeriod(`${year}-${String(Number(event.target.value)).padStart(2, "0")}`); setPage(1); }} className="ml-1 rounded-lg border border-slate-300 px-2 py-2">{monthOptions.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label><label className="text-sm text-slate-600">Tahun<select value={year} onChange={(event) => { setPeriod(`${Number(event.target.value)}-${String(month).padStart(2, "0")}`); setPage(1); }} className="ml-1 rounded-lg border border-slate-300 px-2 py-2">{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari sales..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div></div><div className="overflow-x-auto"><table className="min-w-[1120px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Sales</th><th className="p-3 text-right">Skor</th><th className="p-3 text-center">Omzet</th><th className="p-3 text-center">Outlet aktif</th><th className="p-3 text-center">New outlet</th><th className="p-3 text-center">Tagihan</th><th className="p-3 text-right">Sisa tagihan bulan ini</th><th className="p-3 text-right">Sisa tagihan keseluruhan</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Memuat KPI...</td></tr> : pageItems.map((item) => <tr key={item.salesUserId} onClick={() => void choose(item)} className={`cursor-pointer hover:bg-slate-50 ${selected?.salesUserId === item.salesUserId ? "bg-indigo-50" : ""}`}><td className="p-3"><b>#{item.rank} · {item.salesUserName}</b><span className="block text-xs text-slate-500">{item.managedStoreCount} toko · bobot {item.weightSource === "individual" ? "khusus" : "global"}</span></td><td className="p-3 text-right font-semibold text-indigo-700">{number(item.totalScore)}</td>{item.categories.map((category) => <td key={category.key} className="p-3 text-center"><p className="font-medium text-slate-800">{actualLabel(category)}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${categoryTone(category)}`}>{category.achievementPercent === null ? "Belum dinilai" : `${number(category.achievementPercent)}%`}</span></td>)}<td className="p-3 text-right">{formatRupiah(item.collection?.unpaidDueAmount ?? 0)}</td><td className="p-3 text-right">{formatRupiah(item.collection?.outstandingAmount ?? 0)}</td></tr>)}</tbody></table></div><PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={visible.length} currentItemCount={pageItems.length} pageSize={pageSize} itemLabel="sales" /></div>
    {selected ? <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Detail di bawah tabel</p><h3 className="mt-1 text-lg font-semibold text-slate-900">{selected.salesUserName}</h3><p className="text-sm text-slate-500">{period} · {selected.managedStoreCount} toko · bobot {selected.weightSource === "individual" ? "khusus" : "global"}</p></div><div className="text-right"><p className="text-3xl font-semibold text-indigo-700">{number(selected.totalScore)}</p><p className="text-xs text-slate-500">cap {selected.achievementCapPercent}%</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-4">{selected.categories.map((category) => <div key={category.key} className="rounded-xl border border-slate-200 p-3"><p className="font-medium text-slate-800">{category.label}</p><p className="mt-2 text-lg font-semibold">{category.unit === "currency" ? formatRupiah(category.actual) : number(category.actual) + (category.unit === "percent" ? "%" : "")}</p><p className="text-xs text-slate-500">Target {category.target === null ? "Belum diatur" : category.unit === "currency" ? formatRupiah(category.target) : number(category.target)} · Bobot {category.weightPercent}%</p><p className="mt-1 text-xs text-slate-500">Skor {number(category.score)} · efektif {category.effectiveWeightPercent}%</p></div>)}</div>{selected.collection ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Piutang due bulan ini", formatRupiah(selected.collection.dueAmount)], ["Pembayaran tercatat", formatRupiah(selected.collection.paidAmount)], ["Sisa tagihan bulan ini", formatRupiah(selected.collection.unpaidDueAmount)], ["Sisa tagihan keseluruhan", formatRupiah(selected.collection.outstandingAmount)], ["Invoice berjalan", String(selected.collection.outstandingInvoiceCount)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>)}</div> : null}<div className="mt-5 border-t border-slate-100 pt-4">{period < currentPeriod() ? <p className="text-sm text-slate-500">Target periode lampau dibekukan.</p> : <button type="button" onClick={openEditor} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Atur Target KPI</button>}</div></section> : null}
    {editing && selected ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold text-slate-900">Atur Target KPI</h3><p className="mt-1 text-sm text-slate-500">{selected.salesUserName} · berlaku mulai {period}</p></div><button type="button" onClick={() => setEditing(false)} className="text-slate-500">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{manualKeys.map((key) => <label key={key} className="text-sm font-medium text-slate-700">{fieldLabels[key]}<input type="number" min={1} step={key === "targetAmount" ? 1000 : 1} value={targetValues[key]} onChange={(event) => setTargetValues((current) => ({ ...current, [key]: event.target.value }))} placeholder="Tidak dinilai" className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal" /></label>)}</div><p className="mt-3 text-xs text-slate-500">Kosongkan target bila kategori tidak perlu dinilai.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Batal</button><button type="button" onClick={() => void saveTargets()} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan Target"}</button></div></div></div> : null}
    {configOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-slate-900">Konfigurasi Bobot Global KPI</h3><p className="mt-1 text-sm text-slate-500">{config?.isDefault ? "Memakai konfigurasi bawaan." : `Konfigurasi aktif sejak ${config?.effectiveFrom}.`}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm">Berlaku mulai<input type="month" min={currentPeriod()} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label><label className="text-sm">Cap capaian<input type="number" min={100} max={1000} value={cap} onChange={(event) => setCap(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label>{(Object.keys(weights) as SalesKpiCategoryKey[]).map((key) => <label key={key} className="text-sm">{key}<input type="number" min={0} max={100} step="0.01" value={weights[key]} onChange={(event) => setWeights((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label>)}</div><p className="mt-3 text-sm text-slate-500">Total bobot: {Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0)}%</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setConfigOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Batal</button><button type="button" onClick={() => void saveConfig()} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Simpan Bobot</button></div></div></div> : null}
  </section>;
}
