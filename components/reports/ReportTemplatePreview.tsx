import { formatReportValue, reportValueAlignment } from "@/lib/report-value-format";
import type { CustomReportPreview, ReportFieldCatalog, ReportTemplate } from "@/services/report-templates";

interface Props {
	preview: CustomReportPreview;
	template: ReportTemplate;
	catalog: ReportFieldCatalog | null;
}

export function ReportTemplatePreview({ preview, template, catalog }: Props) {
	const fields = new Map((catalog?.[template.dataset] ?? []).map((field) => [field.key, field]));
	const numericColumns = preview.columns.filter((column) => fields.get(column.key)?.type === "number");
	const sum = (rows: Array<Record<string, unknown>>, key: string) => rows.reduce((total, row) => {
		const value = Number(row[key]);
		return total + (Number.isFinite(value) ? value : 0);
	}, 0);
	const allRows = preview.groups.flatMap((group) => group.rows);
	const renderedGroups = preview.groups.flatMap((group, groupIndex) => {
		const previousCustomer = preview.groups[groupIndex - 1]?.customerLabel;
		const showCustomer = Boolean(group.customerLabel && group.customerLabel !== previousCustomer);
		return [
			showCustomer ? <tr key={`customer-${groupIndex}`}><td colSpan={preview.columns.length} className="border-b border-sky-200 bg-sky-100 px-3 py-2 text-xs font-bold text-sky-900">{group.customerLabel}</td></tr> : null,
			group.invoiceSummary ? <tr key={`invoice-${groupIndex}`}><td colSpan={preview.columns.length} className="border-b border-sky-100 bg-slate-50 px-3 py-2 text-xs text-slate-700"><span className="font-bold text-slate-900">{group.invoiceSummary.invoiceNumber}</span><span className="mx-2 text-slate-300">•</span>{formatReportValue(group.invoiceSummary.invoiceDate, "invoiceDate", "date")}<span className="mx-2 text-slate-300">•</span>{group.invoiceSummary.salesName}<span className="mx-2 text-slate-300">•</span><span className="font-semibold">Total {formatReportValue(group.invoiceSummary.totalAmount, "totalAmount", "currency")}</span><span className="mx-2 text-slate-300">•</span>Terbayar {formatReportValue(group.invoiceSummary.paidAmount, "paidAmount", "currency")}</td></tr> : group.label ? <tr key={`group-${groupIndex}`}><td colSpan={preview.columns.length} className="border-b border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">{group.label}</td></tr> : null,
			...group.rows.map((row, rowIndex) => <tr key={`${groupIndex}-${rowIndex}`} className={rowIndex % 2 ? "bg-slate-50/70" : "bg-white"}>{preview.columns.map((column) => {
				const field = fields.get(column.key);
				return <td key={column.key} className={`max-w-64 border-b border-slate-100 px-3 py-2.5 align-top text-slate-700 ${reportValueAlignment(column.key, field?.display)}`}>{formatReportValue(row[column.key], column.key, field?.display)}</td>;
			})}</tr>),
		];
	});

	return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
			<div><p className="text-sm font-semibold text-slate-900">Preview hasil</p><p className="text-xs text-slate-500">Menampilkan hingga {preview.previewLimit} dari {preview.totalRows.toLocaleString("id-ID")} baris.</p></div>
			<span className="text-xs font-medium text-slate-500">Format angka dan tanggal mengikuti PDF</span>
		</div>
		<div className="max-h-[26rem] overflow-auto">
			<table className="min-w-max w-full border-separate border-spacing-0 text-sm">
				<thead className="sticky top-0 z-10 bg-sky-600 text-left text-xs text-white shadow-sm"><tr>{preview.columns.map((column) => {
					const field = fields.get(column.key);
					return <th key={column.key} className={`border-b border-sky-500 px-3 py-2.5 font-semibold ${reportValueAlignment(column.key, field?.display)}`}>{column.header}</th>;
				})}</tr></thead>
				<tbody>{renderedGroups}
				{numericColumns.length ? <tr className="bg-slate-200 font-bold text-slate-900">{preview.columns.map((column, index) => {
					const field = fields.get(column.key);
					return <td key={column.key} className={`border-t border-slate-300 px-3 py-2.5 ${reportValueAlignment(column.key, field?.display)}`}>{field?.type === "number" ? formatReportValue(sum(allRows, column.key), column.key, field.display) : index === 0 ? "Total preview" : ""}</td>;
				})}</tr> : null}
				</tbody>
			</table>
		</div>
	</section>;
}
