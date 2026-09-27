import apiClient from "@/lib/api-client";
import { toIsoEndOfLocalDay, toIsoStartOfLocalDay } from "@/lib/datetime";

export type CustomReportDataset = "sales_items" | "invoices" | "payments" | "receivables";
export type CustomReportFormat = "pdf" | "xlsx";
export interface ReportTemplateColumn { key: string; header: string }
export interface ReportTemplate { id: string; name: string; dataset: CustomReportDataset; columns: ReportTemplateColumn[]; groupBy?: string | null; createdAt: string; updatedAt: string }
export interface ReportField { key: string; label: string; type: "string" | "number" | "date"; display?: "text" | "date" | "quantity" | "currency" | "percent" }
export type ReportFieldCatalog = Record<CustomReportDataset, ReportField[]>;
export interface CustomReportPreview {
	templateId: string;
	columns: ReportTemplateColumn[];
	groupBy: string | null;
	totalRows: number;
	previewLimit: number;
	groups: Array<{
		label: string | null;
		customerLabel?: string;
		invoiceSummary?: { invoiceNumber: string; invoiceDate: unknown; salesName: string; totalAmount: unknown; paidAmount: unknown };
		rows: Array<Record<string, unknown>>;
	}>;
}
export interface CustomReportFilters { dateFrom?: string; dateTo?: string; storeId?: string; status?: string; search?: string }
export interface ReportTemplatePdfDraft {
	name?: string;
	dataset: CustomReportDataset;
	columns: ReportTemplateColumn[];
	groupBy?: string | null;
	filters?: CustomReportFilters;
}
interface ApiResponse<T> { success: boolean; message: string; data: T }
interface PaginationMeta { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number }

const normalizeFilters = (params: CustomReportFilters): CustomReportFilters => ({
	...params,
	dateFrom: params.dateFrom ? (params.dateFrom.includes("T") ? params.dateFrom : toIsoStartOfLocalDay(params.dateFrom)) : undefined,
	dateTo: params.dateTo ? (params.dateTo.includes("T") ? params.dateTo : toIsoEndOfLocalDay(params.dateTo)) : undefined,
	storeId: params.storeId || undefined,
	status: params.status || undefined,
	search: params.search || undefined,
});

export const reportTemplatesService = {
	async fieldCatalog(): Promise<ReportFieldCatalog> { return (await apiClient.get<ApiResponse<ReportFieldCatalog>>("/report-templates/field-catalog")).data.data; },
	async list(params?: { page?: number; limit?: number; search?: string; dataset?: CustomReportDataset }): Promise<{ items: ReportTemplate[]; meta: PaginationMeta }> {
		const response = await apiClient.get<ApiResponse<ReportTemplate[]> & { meta: PaginationMeta }>("/report-templates", { params }); return { items: response.data.data, meta: response.data.meta };
	},
	async create(payload: Pick<ReportTemplate, "name" | "dataset" | "columns" | "groupBy">): Promise<ReportTemplate> { return (await apiClient.post<ApiResponse<ReportTemplate>>("/report-templates", payload)).data.data; },
	async update(id: string, payload: Partial<Pick<ReportTemplate, "name" | "columns" | "groupBy">>): Promise<ReportTemplate> { return (await apiClient.put<ApiResponse<ReportTemplate>>(`/report-templates/${id}`, payload)).data.data; },
	async remove(id: string): Promise<void> { await apiClient.delete(`/report-templates/${id}`); },
	async preview(id: string, params: CustomReportFilters): Promise<CustomReportPreview> { return (await apiClient.get<ApiResponse<CustomReportPreview>>(`/report-templates/${id}/preview`, { params: normalizeFilters(params) })).data.data; },
	async previewDraftPdf(draft: ReportTemplatePdfDraft): Promise<Blob> {
		const payload = { ...draft, filters: draft.filters ? normalizeFilters(draft.filters) : undefined };
		return (await apiClient.post("/report-templates/preview-pdf", payload, { responseType: "blob" })).data as Blob;
	},
	async previewPdf(id: string, params: CustomReportFilters): Promise<Blob> {
		return (await apiClient.get(`/report-templates/${id}/preview-pdf`, { params: normalizeFilters(params), responseType: "blob" })).data as Blob;
	},
	async createExportJob(id: string, params: CustomReportFilters & { format: CustomReportFormat }): Promise<{ exportLogId: string }> { return (await apiClient.post<ApiResponse<{ exportLogId: string }>>(`/report-templates/${id}/export-jobs`, undefined, { params: { ...normalizeFilters(params), format: params.format } })).data.data; },
};
