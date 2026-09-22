import apiClient from "@/lib/api-client";

export type ProductImportStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface ProductImportRowError { row: number; name: string; message: string }
export interface ProductImportLog {
	id: string;
	filename: string;
	status: ProductImportStatus;
	totalRows?: number | null;
	processedRows: number;
	successRows: number;
	failedRows: number;
	errors?: ProductImportRowError[] | null;
	errorsTruncated?: boolean;
	errorMessage?: string | null;
	actorEmail?: string | null;
	queuedAt?: string | null;
	startedAt?: string | null;
	completedAt?: string | null;
	failedAt?: string | null;
	createdAt?: string;
}

interface ApiResponse<T> { success: boolean; message: string; data: T }
interface PaginationMeta { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number }

export const productImportsService = {
	async downloadTemplate(format: "xlsx" | "csv" = "xlsx") {
		const response = await apiClient.get("/product-imports/template", { params: { format }, responseType: "blob" });
		return response.data as Blob;
	},
	async upload(file: File): Promise<{ importLogId: string; jobId?: string | null; status: ProductImportStatus }> {
		const form = new FormData(); form.append("file", file);
		const response = await apiClient.post<ApiResponse<{ importLogId: string; jobId?: string | null; status: ProductImportStatus }>>("/product-imports", form);
		return response.data.data;
	},
	async list(params?: { page?: number; limit?: number; status?: ProductImportStatus; sortBy?: "createdAt"; sortOrder?: "asc" | "desc" }): Promise<{ items: ProductImportLog[]; meta: PaginationMeta }> {
		const response = await apiClient.get<ApiResponse<ProductImportLog[]> & { meta: PaginationMeta }>("/product-imports", { params });
		return { items: response.data.data, meta: response.data.meta };
	},
	async getStatus(id: string): Promise<ProductImportLog & { done: boolean }> {
		const response = await apiClient.get<ApiResponse<ProductImportLog & { done: boolean }>>(`/product-imports/${id}`);
		return response.data.data;
	},
};
