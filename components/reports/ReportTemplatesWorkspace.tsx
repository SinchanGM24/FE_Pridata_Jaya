"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Play, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ReportTemplateEditor } from "@/components/reports/ReportTemplateEditor";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	reportTemplatesService,
	type CustomReportDataset,
	type CustomReportFilters,
	type CustomReportFormat,
	type ReportFieldCatalog,
	type ReportTemplate,
} from "@/services/report-templates";

const datasets: CustomReportDataset[] = ["sales_items", "invoices", "payments", "receivables"];
const labels: Record<CustomReportDataset, string> = { sales_items: "Item Penjualan", invoices: "Faktur", payments: "Pembayaran", receivables: "Piutang" };
const emptyFilters: CustomReportFilters = { dateFrom: "", dateTo: "", storeId: "", status: "", search: "" };
type EditorState = { template?: ReportTemplate; duplicate?: boolean } | null;

export function ReportTemplatesWorkspace() {
	const router = useRouter();
	const pathname = usePathname();
	const [catalog, setCatalog] = useState<ReportFieldCatalog | null>(null);
	const [items, setItems] = useState<ReportTemplate[]>([]);
	const [filter, setFilter] = useState<CustomReportDataset | "">("");
	const [search, setSearch] = useState("");
	const [editor, setEditor] = useState<EditorState>(null);
	const [runner, setRunner] = useState<ReportTemplate | null>(null);
	const [filters, setFilters] = useState<CustomReportFilters>(emptyFilters);
	const [loading, setLoading] = useState(true);
	const [queueing, setQueueing] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [fields, templates] = await Promise.all([reportTemplatesService.fieldCatalog(), reportTemplatesService.list({ limit: 100, search: search || undefined, dataset: filter || undefined })]);
			setCatalog(fields); setItems(templates.items);
		} catch (cause) { setError(getApiErrorMessage(cause, "Gagal memuat template laporan.")); }
		finally { setLoading(false); }
	}, [filter, search]);

	useEffect(() => { const timer = window.setTimeout(() => void load(), 150); return () => window.clearTimeout(timer); }, [load]);
	const openRunner = (template: ReportTemplate) => { setRunner(template); setFilters(emptyFilters); setError(""); };
	const queue = async (format: CustomReportFormat) => {
		if (!runner) return;
		setQueueing(true);
		try {
			const result = await reportTemplatesService.createExportJob(runner.id, { ...filters, format });
			router.push(`${pathname.startsWith("/owner") ? "/owner/riwayat-ekspor" : "/akuntan/export-logs"}?highlight=${result.exportLogId}&queued=1`);
		} catch (cause) { setError(getApiErrorMessage(cause, "Gagal membuat job ekspor.")); }
		finally { setQueueing(false); }
	};
	const remove = async (template: ReportTemplate) => {
		if (!window.confirm(`Hapus template ${template.name}?`)) return;
		try { await reportTemplatesService.remove(template.id); setSuccess("Template dihapus."); await load(); }
		catch (cause) { setError(getApiErrorMessage(cause, "Gagal menghapus template.")); }
	};
	const totalColumns = useMemo(() => items.reduce((total, item) => total + item.columns.length, 0), [items]);

	if (editor && catalog) return <ReportTemplateEditor catalog={catalog} initial={editor.template} duplicate={editor.duplicate} onCancel={() => setEditor(null)} onSaved={async () => { setEditor(null); setSuccess("Template laporan berhasil disimpan."); await load(); }} />;

	return <FeaturePage title="Template Laporan" description="Simpan format pribadi lalu antrekan PDF atau Excel." actions={[{ label: "Buat Template", onClick: () => setEditor({}), tone: "primary" }]} actionsDescription="Editor terbuka sebagai halaman kerja penuh tanpa menu aplikasi.">
		<PageFeedback error={error} success={success} onDismissError={() => setError("")} onDismissSuccess={() => setSuccess("")} />
		<section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">Format laporan pribadi</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-xl font-bold text-slate-900">Susun format laporan sesuai kebutuhan.</h2><p className="mt-2 text-sm text-slate-600">Preview PDF tersedia saat membuat atau mengubah template.</p></div><p className="text-sm text-slate-600"><b>{items.length}</b> template · <b>{totalColumns}</b> kolom</p></div></section>
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama template..." className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm"/><select value={filter} onChange={(event) => setFilter(event.target.value as CustomReportDataset | "")} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm sm:w-56"><option value="">Semua jenis data</option>{datasets.map((dataset) => <option key={dataset} value={dataset}>{labels[dataset]}</option>)}</select></div></section>
		{loading ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Memuat template...</section> : items.length ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Nama Template</th><th className="px-4 py-3">Jenis Data</th><th className="px-4 py-3 text-center">Kolom</th><th className="px-4 py-3">Diperbarui</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100 text-slate-700 hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-slate-900">{item.name}</td><td className="px-4 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{labels[item.dataset]}</span></td><td className="px-4 py-4 text-center">{item.columns.length}</td><td className="px-4 py-4 text-xs text-slate-500">{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.updatedAt))}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openRunner(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><Play className="h-3.5 w-3.5"/>Jalankan</button><button type="button" onClick={() => setEditor({ template: item })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Edit</button><button type="button" onClick={() => setEditor({ template: item, duplicate: true })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Duplikasi</button><button type="button" onClick={() => void remove(item)} className="rounded-lg px-2 py-2 text-xs font-semibold text-rose-600">Hapus</button></div></td></tr>)}</tbody></table></div></section> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><FileText className="mx-auto h-10 w-10 text-slate-300"/><h2 className="mt-3 font-semibold text-slate-900">Belum ada template laporan</h2><button type="button" onClick={() => setEditor({})} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Buat Template</button></section>}
		<Modal isOpen={Boolean(runner)} onClose={() => !queueing && setRunner(null)} title={runner ? `Jalankan: ${runner.name}` : "Jalankan Template"} maxWidthClassName="max-w-2xl"><div className="space-y-5"><p className="text-sm text-slate-600">Atur filter bila diperlukan, lalu pilih format untuk mengantrekan ekspor.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-700">Dari tanggal<input type="date" value={filters.dateFrom ?? ""} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3"/></label><label className="text-sm text-slate-700">Sampai tanggal<input type="date" value={filters.dateTo ?? ""} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3"/></label><label className="text-sm text-slate-700 sm:col-span-2">Pencarian<input value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Cari data laporan" className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3"/></label></div><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setRunner(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Batal</button><button type="button" onClick={() => void queue("xlsx")} disabled={queueing} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Ekspor Excel</button><button type="button" onClick={() => void queue("pdf")} disabled={queueing} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Ekspor PDF</button></div></div></Modal>
	</FeaturePage>;
}
