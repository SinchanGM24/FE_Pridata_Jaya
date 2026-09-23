"use client";

import { useEffect, useState } from "react";
import { FileText, LoaderCircle, RefreshCw } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	reportTemplatesService,
	type CustomReportDataset,
	type ReportTemplateColumn,
} from "@/services/report-templates";

export type DraftGrouping = "" | "storeName" | "invoiceDate" | "paymentDate" | "storeName_then_invoiceDate" | "storeName_then_invoiceNumber" | "invoiceDate_then_storeName" | "storeName_then_paymentDate" | "paymentDate_then_storeName";

interface Props {
	name: string;
	columns: ReportTemplateColumn[];
	dataset: CustomReportDataset;
	grouping: DraftGrouping;
}

export function ReportTemplateDraftPreview({ name, columns, dataset, grouping }: Props) {
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [revision, setRevision] = useState(0);

	useEffect(() => {
		if (!columns.length) {
			return;
		}

		let active = true;
		const timer = window.setTimeout(() => {
			setLoading(true);
			setError("");
			void reportTemplatesService.previewDraftPdf({
				name: name.trim() || "Preview Template Laporan",
				dataset,
				columns,
				groupBy: grouping || null,
			}).then((blob) => {
				if (!active) return;
				const nextUrl = URL.createObjectURL(blob);
				setPdfUrl((current) => { if (current) URL.revokeObjectURL(current); return nextUrl; });
			}).catch((cause: unknown) => {
				if (active) setError(getApiErrorMessage(cause, "Preview PDF tidak dapat dibuat."));
			}).finally(() => { if (active) setLoading(false); });
		}, 450);

		return () => { active = false; window.clearTimeout(timer); };
	}, [columns, dataset, grouping, name, revision]);

	useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

	return <section className="rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-sm sm:p-4">
		<div className="mb-3 flex items-center justify-between gap-3">
			<div><h2 className="font-semibold text-slate-900">Preview PDF</h2><p className="text-xs text-slate-500">Dua halaman pertama memakai renderer PDF yang sama dengan ekspor.</p></div>
			<button type="button" onClick={() => setRevision((value) => value + 1)} disabled={!columns.length || loading} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5"/>Muat ulang</button>
		</div>
		{!columns.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center text-sm text-slate-500">Pilih kolom untuk membuat preview PDF.</div> : null}
		{columns.length && loading && !pdfUrl ? <div className="flex min-h-[540px] items-center justify-center rounded-xl bg-white text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-sky-600"/>Menyusun preview PDF...</div> : null}
		{columns.length && error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div> : null}
		{columns.length && pdfUrl ? <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"><iframe title="Preview PDF template laporan" src={pdfUrl} className="h-[620px] w-full bg-white sm:h-[720px]"/>{loading ? <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-white/90 py-2 text-xs font-medium text-slate-600"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-sky-600"/>Memperbarui preview…</div> : null}</div> : null}
		<p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><FileText className="h-3.5 w-3.5"/>Preview dibatasi dua halaman; ekspor akhir tetap memuat seluruh data dan seluruh kolom.</p>
	</section>;
}
