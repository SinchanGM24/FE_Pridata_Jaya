"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PaginationControls from "@/components/shared/PaginationControls";
import SalesKpiSummary from "@/components/dashboard/SalesKpiSummary";
import { formatRupiah } from "@/lib/format";
import {
	salesKpiService,
	type SalesKpiCategoryKey,
	type SalesKpiConfig,
	type SalesKpiRankedResult,
} from "@/services/salesKpi";

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const keys: Array<{ key: SalesKpiCategoryKey; label: string }> = [
	{ key: "omzet", label: "Omzet" }, { key: "activeStores", label: "Toko Aktif" },
	{ key: "newActiveStores", label: "New Toko Aktif" }, { key: "collectionRate", label: "Tagihan" },
];

type TargetForm = { targetAmount: string; targetActiveStores: string; targetNewActiveStores: string; targetCollectionRate: string };
const emptyTarget: TargetForm = { targetAmount: "", targetActiveStores: "", targetNewActiveStores: "", targetCollectionRate: "" };
const errorMessage = (error: unknown, fallback: string) =>
	typeof error === "object" && error !== null && "response" in error && typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
		? (error as { response: { data: { message: string } } }).response.data.message : fallback;

export default function KelolaSalesPage() {
	const [period, setPeriod] = useState(currentPeriod);
	const [effectiveFrom, setEffectiveFrom] = useState(currentPeriod);
	const [config, setConfig] = useState<SalesKpiConfig | null>(null);
	const [weights, setWeights] = useState<Record<SalesKpiCategoryKey, string>>({ omzet: "40", activeStores: "25", newActiveStores: "15", collectionRate: "20" });
	const [cap, setCap] = useState("120");
	const [items, setItems] = useState<SalesKpiRankedResult[]>([]);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [savingConfig, setSavingConfig] = useState(false);
	const [savingTarget, setSavingTarget] = useState(false);
	const [selected, setSelected] = useState<SalesKpiRankedResult | null>(null);
	const [target, setTarget] = useState<TargetForm>(emptyTarget);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const load = useCallback(async () => {
		setLoading(true); setError("");
		try {
			const [nextConfig, ranking] = await Promise.all([
				salesKpiService.getConfig(period), salesKpiService.getRanking({ period, page, limit: 10, search: search.trim() || undefined }),
			]);
			setConfig(nextConfig); setWeights(Object.fromEntries(keys.map(({ key }) => [key, String(nextConfig.weights[key])])) as Record<SalesKpiCategoryKey, string>);
			setCap(String(nextConfig.achievementCapPercent)); setItems(ranking.items); setTotalPages(ranking.totalPages);
		} catch (loadError) { setError(errorMessage(loadError, "Gagal memuat konfigurasi dan daftar KPI sales.")); }
		finally { setLoading(false); }
	}, [page, period, search]);

	useEffect(() => { const id = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(id); }, [load]);
	const weightTotal = useMemo(() => keys.reduce((sum, { key }) => sum + (Number(weights[key]) || 0), 0), [weights]);
	const effectiveFromValid = effectiveFrom >= currentPeriod();
	const canSaveConfig = weightTotal === 100 && Number(cap) >= 100 && Number(cap) <= 1000 && effectiveFromValid;

	const saveConfig = async () => {
		if (!canSaveConfig) return;
		setSavingConfig(true); setError("");
		try {
			await salesKpiService.updateConfig({ effectiveFrom, achievementCapPercent: Number(cap), weights: Object.fromEntries(keys.map(({ key }) => [key, Number(weights[key])])) as SalesKpiConfig["weights"] });
			setNotice("Konfigurasi KPI berhasil disimpan."); await load();
		} catch (saveError) { setError(errorMessage(saveError, "Gagal menyimpan konfigurasi KPI.")); }
		finally { setSavingConfig(false); }
	};

	const openTarget = (sales: SalesKpiRankedResult) => {
		const byKey = Object.fromEntries(sales.categories.map((category) => [category.key, category.target]));
		setSelected(sales);
		setTarget({ targetAmount: String(byKey.omzet ?? ""), targetActiveStores: byKey.activeStores === null ? "" : String(byKey.activeStores ?? ""), targetNewActiveStores: byKey.newActiveStores === null ? "" : String(byKey.newActiveStores ?? ""), targetCollectionRate: byKey.collectionRate === null ? "" : String(byKey.collectionRate ?? "") });
	};
	const saveTarget = async () => {
		if (!selected) return;
		const amount = Number(target.targetAmount);
		const active = target.targetActiveStores === "" ? null : Number(target.targetActiveStores);
		const newActive = target.targetNewActiveStores === "" ? null : Number(target.targetNewActiveStores);
		const collection = target.targetCollectionRate === "" ? null : Number(target.targetCollectionRate);
		if (target.targetAmount === "" || !Number.isFinite(amount) || amount < 0 || [active, newActive].some((value) => value !== null && (!Number.isInteger(value) || value < 0)) || (collection !== null && (!Number.isFinite(collection) || collection < 0 || collection > 100))) { setError("Periksa target: omzet wajib diisi; jumlah toko harus non-negatif; collection rate harus 0–100."); return; }
		setSavingTarget(true); setError("");
		try {
			await salesKpiService.upsertTarget(selected.salesUserId, { period, targetAmount: amount, targetActiveStores: active, targetNewActiveStores: newActive, targetCollectionRate: collection });
			setSelected(null); setNotice(`Target KPI ${selected.salesUserName} berhasil disimpan.`); await load();
		} catch (saveError) { setError(errorMessage(saveError, "Gagal menyimpan target sales.")); }
		finally { setSavingTarget(false); }
	};

	return <FeaturePage title="Kelola Sales" description="Atur bobot KPI dan target sales per periode. Target omzet di sini juga menjadi sumber untuk analitik Target vs Realisasi Sales.">
		{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
		{notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Konfigurasi KPI</h2><p className="mt-1 text-sm text-slate-500">Bobot berlaku dari periode yang dipilih dan tidak dapat berlaku surut.</p></div>{config?.isDefault ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">Konfigurasi bawaan</span> : null}</div>
			<div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm text-slate-700">Lihat konfigurasi periode<input type="month" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm text-slate-700">Berlaku mulai<input type="month" min={currentPeriod()} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm text-slate-700">Cap capaian (%)<input type="number" min={100} max={1000} value={cap} onChange={(event) => setCap(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label></div>
			<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{keys.map(({ key, label }) => <label key={key} className="text-sm text-slate-700">Bobot {label} (%)<input type="number" min={0} max={100} step="0.01" value={weights[key]} onChange={(event) => setWeights((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label>)}</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className={weightTotal === 100 ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>Total bobot: {weightTotal}% {weightTotal === 100 ? "· siap disimpan" : "· harus tepat 100%"}</p><button type="button" disabled={!canSaveConfig || savingConfig} onClick={() => void saveConfig()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingConfig ? "Menyimpan..." : "Simpan Konfigurasi"}</button></div>
		</section>
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Target Sales per Periode</h2><p className="mt-1 text-sm text-slate-500">Kosongkan target sekunder untuk mengeluarkannya dari skor KPI.</p></div><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari sales..." className="rounded-xl border border-slate-300 px-3 py-2 text-sm" /></div>
			<div className="mt-4 space-y-3">{loading ? <p className="text-sm text-slate-500">Memuat sales...</p> : items.map((sales) => <div key={sales.salesUserId} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">#{sales.rank} · {sales.salesUserName}</p><p className="mt-1 text-sm text-slate-500">{sales.managedStoreCount} toko · Skor {sales.totalScore}/{sales.achievementCapPercent}</p></div><button type="button" onClick={() => openTarget(sales)} className="rounded-xl border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700">Atur Target</button></div><div className="mt-3 text-sm text-slate-600">Target omzet: {formatRupiah(sales.categories.find((category) => category.key === "omzet")?.target ?? 0)} · {sales.hasCompleteTarget ? "Target lengkap" : "Sebagian target belum diatur"}</div></div>)}{!loading && !items.length ? <p className="text-sm text-slate-500">Tidak ada sales pada periode ini.</p> : null}</div>
			<div className="mt-5"><PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={items.length} currentItemCount={items.length} itemLabel="sales" /></div>
		</section>
		{selected ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Atur Target KPI</h2><p className="mt-1 text-sm text-slate-500">{selected.salesUserName} · {period}</p></div><button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-500">Tutup</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{([['targetAmount', 'Target Omzet', 1000], ['targetActiveStores', 'Target Toko Aktif', 1], ['targetNewActiveStores', 'Target New Toko Aktif', 1], ['targetCollectionRate', 'Target Collection Rate (%)', 0.1]] as const).map(([key, label, step]) => <label key={key} className="text-sm text-slate-700">{label}<input type="number" min={0} max={key === 'targetCollectionRate' ? 100 : undefined} step={step} value={target[key]} onChange={(event) => setTarget((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label>)}</div><p className="mt-3 text-xs text-slate-500">Field toko aktif, new toko aktif, dan tagihan yang dikosongkan akan dikirim sebagai target kosong (`null`).</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Batal</button><button type="button" disabled={savingTarget} onClick={() => void saveTarget()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingTarget ? "Menyimpan..." : "Simpan Target"}</button></div></div></div> : null}
	</FeaturePage>;
}
