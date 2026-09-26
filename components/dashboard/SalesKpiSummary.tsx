"use client";

import { formatRupiah } from "@/lib/format";
import type { SalesKpiCategory, SalesKpiResult } from "@/services/salesKpi";

const formatValue = (category: SalesKpiCategory, value: number | null) => {
	if (value === null) return "Belum ada target";
	if (category.unit === "currency") return formatRupiah(value);
	if (category.unit === "percent") return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
	return value.toLocaleString("id-ID");
};

export function SalesKpiCategoryRows({ result, compact = false }: { result: SalesKpiResult; compact?: boolean }) {
	return (
		<div className="divide-y divide-slate-100">
			{result.categories.map((category) => (
				<div key={category.key} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-medium text-slate-800">{category.label}</p>
							{!category.scored ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Belum ada target</span> : null}
						</div>
						<p className="mt-1 text-xs text-slate-500">
							Realisasi {formatValue(category, category.actual)} · Target {formatValue(category, category.target)}
						</p>
					</div>
					{!compact ? <p className="text-xs text-slate-500">Bobot {category.weightPercent}%{category.scored ? ` → efektif ${category.effectiveWeightPercent}%` : ""}</p> : null}
					<div className="text-left sm:text-right">
						<p className="font-semibold text-slate-900">{category.achievementPercent === null ? "—" : `${category.achievementPercent}%`}</p>
						<p className="text-xs text-slate-500">Skor {category.score}</p>
					</div>
				</div>
			))}
		</div>
	);
}

export default function SalesKpiSummary({ result, title = "KPI Sales", compact = false }: { result: SalesKpiResult; title?: string; compact?: boolean }) {
	const ratio = Math.min((result.totalScore / result.achievementCapPercent) * 100, 100);
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">Periode {result.period} · {result.managedStoreCount} toko kelolaan</p></div>
				<div className="text-right"><p className="text-3xl font-semibold text-indigo-700">{result.totalScore}</p><p className="text-xs text-slate-500">maks. {result.achievementCapPercent}</p></div>
			</div>
			<div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${ratio}%` }} /></div>
			{!result.hasCompleteTarget ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Sebagian target belum diatur. Bobot kategori yang dinilai sudah dibagi ulang oleh sistem.</p> : null}
			<div className="mt-3"><SalesKpiCategoryRows result={result} compact={compact} /></div>
		</section>
	);
}
