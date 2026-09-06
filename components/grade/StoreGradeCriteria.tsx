"use client";

import { BarChart3, CalendarDays, Info, Scale } from "lucide-react";

type GradeCriterion = {
	grade: string;
	name: string;
	description: string;
	accent: string;
	gradeTone: string;
	dotTone: string;
	items: readonly string[];
};

const performanceCriteria = [
	{ grade: "A+", name: "Prioritas Utama", description: "Nilai pembelian sangat tinggi dengan pembayaran cepat.", accent: "bg-emerald-600", gradeTone: "bg-emerald-100 text-emerald-800 ring-emerald-300", dotTone: "bg-emerald-600", items: ["Rata-rata pembelian bulanan di atas Rp15 juta", "Rata-rata pembayaran 0 sampai 40 hari sejak tanggal invoice"] },
	{ grade: "A", name: "Prioritas", description: "Nilai pembelian tinggi dengan pembayaran cepat.", accent: "bg-emerald-500", gradeTone: "bg-emerald-50 text-emerald-700 ring-emerald-200", dotTone: "bg-emerald-500", items: ["Rata-rata pembelian bulanan Rp7 juta sampai Rp15 juta", "Rata-rata pembayaran 0 sampai 40 hari sejak tanggal invoice"] },
	{ grade: "B+", name: "Sangat Baik", description: "Pembelian kuat dengan tempo pembayaran menengah.", accent: "bg-sky-600", gradeTone: "bg-sky-100 text-sky-800 ring-sky-300", dotTone: "bg-sky-600", items: ["Rata-rata pembelian bulanan di atas Rp7 juta", "Rata-rata pembayaran 41 sampai 54 hari sejak tanggal invoice"] },
	{ grade: "B", name: "Baik", description: "Pembelian reguler dengan pembayaran masih terkendali.", accent: "bg-sky-500", gradeTone: "bg-sky-50 text-sky-700 ring-sky-200", dotTone: "bg-sky-500", items: ["Rata-rata pembelian bulanan maksimal Rp7 juta", "Rata-rata pembayaran 0 sampai 54 hari sejak tanggal invoice"] },
	{ grade: "C+", name: "Potensial", description: "Pembelian sangat tinggi dengan tempo pembayaran panjang.", accent: "bg-amber-500", gradeTone: "bg-amber-100 text-amber-800 ring-amber-300", dotTone: "bg-amber-500", items: ["Rata-rata pembelian bulanan di atas Rp15 juta", "Rata-rata pembayaran 55 sampai 90 hari sejak tanggal invoice"] },
	{ grade: "C", name: "Perhatian", description: "Pembelian reguler dengan tempo pembayaran panjang.", accent: "bg-orange-500", gradeTone: "bg-orange-50 text-orange-700 ring-orange-200", dotTone: "bg-orange-500", items: ["Rata-rata pembelian bulanan maksimal Rp15 juta", "Rata-rata pembayaran 55 sampai 90 hari sejak tanggal invoice"] },
	{ grade: "D", name: "Risiko Tinggi", description: "Membutuhkan perhatian khusus pada kedisiplinan pembayaran.", accent: "bg-rose-500", gradeTone: "bg-rose-50 text-rose-700 ring-rose-200", dotTone: "bg-rose-500", items: ["Rata-rata pembayaran melebihi 90 hari sejak tanggal invoice", "Nilai pembelian tidak mengubah hasil Grade D"] },
] satisfies readonly GradeCriterion[];

const newOutletCriterion = {
	grade: "N",
	name: "Belum Dinilai",
	description: "Status awal sampai outlet memiliki data yang cukup untuk dinilai.",
	accent: "bg-brand-500",
	gradeTone: "bg-brand-50 text-brand-700 ring-brand-200",
	dotTone: "bg-brand-500",
	items: ["Outlet sudah terverifikasi, tetapi berusia kurang dari 30 hari; atau", "Outlet sudah terverifikasi, tetapi belum memiliki invoice penilaian; atau", "Outlet sudah terverifikasi, tetapi belum aktif untuk transaksi"],
} satisfies GradeCriterion;

function GradeCard({ criterion }: { criterion: GradeCriterion }) {
	return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className={`h-1 ${criterion.accent}`} /><div className="p-4"><div className="flex items-start gap-3"><div className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ring-1 ${criterion.gradeTone}`}>{criterion.grade}</div><div className="min-w-0"><h3 className="font-semibold text-slate-900">Grade {criterion.grade} · {criterion.name}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{criterion.description}</p></div></div><ul className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">{criterion.items.map((item) => <li key={item} className="flex gap-2.5 text-sm leading-5 text-slate-700"><span className={`mt-2 size-1.5 shrink-0 rounded-full ${criterion.dotTone}`} /><span>{item}</span></li>)}</ul></div></article>;
}

export default function StoreGradeCriteria() {
	return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div className="border-b border-slate-200 bg-slate-50 px-5 py-5 md:px-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm"><BarChart3 aria-hidden="true" className="size-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Panduan Grade Outlet</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Kriteria Penilaian Grade</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Grade ditentukan dari rata-rata pembelian bulanan dan rata-rata hari pembayaran outlet.</p></div></div><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><CalendarDays aria-hidden="true" className="size-4 text-brand-600" /><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Periode</p><p className="text-sm font-semibold text-slate-900">90 hari</p></div></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><Info aria-hidden="true" className="size-4 text-brand-600" /><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Parameter</p><p className="text-sm font-semibold text-slate-900">Pembelian & Pembayaran</p></div></div></div></div></div>
		<div className="space-y-7 p-5 md:p-6"><div><div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-semibold text-slate-900">Grade Kinerja Outlet</h3><div className="h-px flex-1 bg-slate-200" /><span className="text-xs text-slate-500">A+ sampai D</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{performanceCriteria.map((criterion) => <GradeCard key={criterion.grade} criterion={criterion} />)}</div></div>
			<div><div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-semibold text-slate-900">Status Belum Dinilai</h3><div className="h-px flex-1 bg-slate-200" /><span className="text-xs text-slate-500">Grade N</span></div><div className="max-w-xl"><GradeCard criterion={newOutletCriterion} /></div></div>
			<div className="grid gap-3 lg:grid-cols-2"><div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700"><Scale aria-hidden="true" className="size-4" /></div><div><p className="text-sm font-semibold text-slate-900">Cara menghitung pembelian bulanan</p><p className="mt-1 text-sm leading-6 text-slate-600">Total nilai invoice dalam 90 hari dibagi tiga bulan.</p></div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Cara menghitung hari pembayaran</p><p className="mt-1 text-sm leading-6 text-slate-600">Dihitung dari tanggal invoice sampai pembayaran lunas. Invoice yang belum lunas dihitung sampai tanggal evaluasi.</p></div></div>
		</div>
	</section>;
}
