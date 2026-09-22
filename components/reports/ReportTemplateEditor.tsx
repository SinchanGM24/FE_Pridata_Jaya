"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Save, Trash2 } from "lucide-react";
import { ReportTemplateDraftPreview, type DraftGrouping } from "@/components/reports/ReportTemplateDraftPreview";
import PageFeedback from "@/components/shared/PageFeedback";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	reportTemplatesService,
	type CustomReportDataset,
	type ReportFieldCatalog,
	type ReportTemplate,
	type ReportTemplateColumn,
} from "@/services/report-templates";

const datasetLabels: Record<CustomReportDataset, string> = {
	sales_items: "Item Penjualan",
	invoices: "Faktur",
	payments: "Pembayaran",
	receivables: "Piutang",
};

interface Draft {
	name: string;
	dataset: CustomReportDataset;
	columns: ReportTemplateColumn[];
	groupBy: DraftGrouping;
}

interface Props {
	catalog: ReportFieldCatalog;
	initial?: ReportTemplate | null;
	duplicate?: boolean;
	onCancel: () => void;
	onSaved: () => void | Promise<void>;
}

const normalizeGrouping = (template?: ReportTemplate | null): DraftGrouping => {
	const value = template?.groupBy ?? "";
	const supported: DraftGrouping[] = ["", "storeName", "invoiceDate", "paymentDate", "storeName_then_invoiceDate", "storeName_then_invoiceNumber", "invoiceDate_then_storeName", "storeName_then_paymentDate", "paymentDate_then_storeName"];
	if (supported.includes(value as DraftGrouping)) return value as DraftGrouping;
	return template?.columns.some((column) => column.key === "storeName") ? "storeName" : "";
};

export function ReportTemplateEditor({ catalog, initial, duplicate = false, onCancel, onSaved }: Props) {
	const [draft, setDraft] = useState<Draft>(() => ({
		name: duplicate && initial ? `${initial.name} (Salinan)` : initial?.name ?? "",
		dataset: initial?.dataset ?? "sales_items",
		columns: initial?.columns.map((column) => ({ ...column })) ?? [],
		groupBy: normalizeGrouping(initial),
	}));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const isEditing = Boolean(initial && !duplicate);
	const selectedKeys = useMemo(() => new Set(draft.columns.map((column) => column.key)), [draft.columns]);
	const hasCustomer = selectedKeys.has("storeName");
	const hasInvoice = selectedKeys.has("invoiceNumber");
	const dateKey = draft.dataset === "payments" ? "paymentDate" : "invoiceDate";
	const hasDate = selectedKeys.has(dateKey);

	useEffect(() => {
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => { document.body.style.overflow = previous; };
	}, []);

	const toggleColumn = (key: string, label: string) => setDraft((current) => {
		const selected = current.columns.some((column) => column.key === key);
		if (!selected && current.columns.length >= 30) return current;
		const columns = selected
			? current.columns.filter((column) => column.key !== key)
			: [...current.columns, { key, header: label }];
		const groupBy = current.groupBy.includes(key) ? "" : current.groupBy;
		return { ...current, columns, groupBy };
	});

	const moveColumn = (index: number, direction: -1 | 1) => setDraft((current) => {
		const target = index + direction;
		if (target < 0 || target >= current.columns.length) return current;
		const columns = [...current.columns];
		[columns[index], columns[target]] = [columns[target], columns[index]];
		return { ...current, columns };
	});

	const save = async () => {
		if (!draft.name.trim()) { setError("Nama template wajib diisi."); return; }
		if (!draft.columns.length) { setError("Pilih minimal satu kolom."); return; }
		setSaving(true); setError("");
		try {
			const payload = { name: draft.name.trim(), columns: draft.columns, groupBy: draft.groupBy || null };
			if (isEditing && initial) await reportTemplatesService.update(initial.id, payload);
			else await reportTemplatesService.create({ ...payload, dataset: draft.dataset, groupBy: draft.groupBy || undefined });
			await onSaved();
		} catch (cause) {
			setError(getApiErrorMessage(cause, "Gagal menyimpan template laporan."));
		} finally { setSaving(false); }
	};

	return <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-100">
		<header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:px-6">
			<div className="mx-auto flex max-w-[1800px] items-center justify-between gap-2">
				<button type="button" onClick={onCancel} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><ArrowLeft className="h-4 w-4"/><span className="hidden sm:inline">Kembali</span></button>
				<div className="min-w-0 text-center"><h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{isEditing ? "Edit Template Laporan" : duplicate ? "Duplikasi Template" : "Buat Template Laporan"}</h1><p className="text-[11px] text-slate-500">Perubahan tampil langsung pada preview</p></div>
				<button type="button" onClick={() => void save()} disabled={saving || !draft.columns.length} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 sm:px-4"><Save className="h-4 w-4"/>{saving ? "Menyimpan..." : "Simpan"}</button>
			</div>
		</header>

		<main className="mx-auto grid max-w-[1800px] gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)] lg:p-6">
			<section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
				<PageFeedback error={error} onDismissError={() => setError("")} />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
					<label className="text-sm font-medium text-slate-700">Nama template<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Penjualan per Pelanggan" className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"/></label>
					<label className="text-sm font-medium text-slate-700">Jenis data<select disabled={isEditing} value={draft.dataset} onChange={(event) => setDraft({ name: draft.name, dataset: event.target.value as CustomReportDataset, columns: [], groupBy: "" })} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100">{Object.entries(datasetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
				</div>

				<div className="border-t border-slate-100 pt-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Pilih kolom</h2><p className="mt-1 text-xs text-slate-500">Kolom yang dipilih langsung muncul di preview.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{draft.columns.length}/30</span></div><div className="mt-3 grid max-h-64 gap-1 overflow-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2 lg:grid-cols-1">{catalog[draft.dataset].map((field) => <label key={field.key} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${selectedKeys.has(field.key) ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-700 hover:bg-slate-50"}`}><input type="checkbox" checked={selectedKeys.has(field.key)} onChange={() => toggleColumn(field.key, field.label)} className="h-4 w-4 accent-indigo-600"/>{field.label}</label>)}</div></div>

				<div className="border-t border-slate-100 pt-5"><h2 className="font-semibold text-slate-900">Urutan dan judul kolom</h2>{draft.columns.length ? <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">{draft.columns.map((column, index) => <div key={column.key} className="flex items-center gap-1.5 rounded-xl border border-slate-200 p-2"><span className="w-5 text-center text-xs font-bold text-slate-400">{index + 1}</span><input value={column.header} onChange={(event) => setDraft((current) => ({ ...current, columns: current.columns.map((item) => item.key === column.key ? { ...item, header: event.target.value } : item) }))} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"/><button type="button" title="Naikkan" disabled={index === 0} onClick={() => moveColumn(index, -1)} className="rounded-lg p-1.5 text-indigo-700 hover:bg-indigo-50 disabled:opacity-25"><ArrowUp className="h-4 w-4"/></button><button type="button" title="Turunkan" disabled={index === draft.columns.length - 1} onClick={() => moveColumn(index, 1)} className="rounded-lg p-1.5 text-indigo-700 hover:bg-indigo-50 disabled:opacity-25"><ArrowDown className="h-4 w-4"/></button><button type="button" title="Hapus" onClick={() => toggleColumn(column.key, column.header)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Belum ada kolom dipilih.</p>}</div>

				<div className="border-t border-slate-100 pt-5"><h2 className="font-semibold text-slate-900">Susun laporan</h2><p className="mt-1 text-xs leading-5 text-slate-500">Pilih cara paling mudah untuk membaca data. Opsi muncul setelah kolom yang dibutuhkan dipilih.</p><select value={draft.groupBy} onChange={(event) => setDraft((current) => ({ ...current, groupBy: event.target.value as DraftGrouping }))} className="mt-3 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">Ikuti urutan data</option>{hasCustomer ? <option value="storeName">Per pelanggan</option> : null}{hasDate ? <option value={dateKey}>Per tanggal</option> : null}{hasCustomer && hasInvoice ? <option value="storeName_then_invoiceNumber">Pelanggan, lalu invoice</option> : null}{hasCustomer && hasDate ? <><option value={`storeName_then_${dateKey}`}>Pelanggan, lalu tanggal</option><option value={`${dateKey}_then_storeName`}>Tanggal, lalu pelanggan</option></> : null}</select></div>
			</section>
			<aside className="min-w-0 lg:sticky lg:top-24 lg:self-start"><ReportTemplateDraftPreview name={draft.name} columns={draft.columns} dataset={draft.dataset} grouping={draft.groupBy}/></aside>
		</main>
	</div>;
}
