import apiClient from "@/lib/api-client";

export type ExportStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface ExportLog {
	id: string;
	actorUserId?: string | null;
	actorEmail?: string | null;
	reportType: string;
	format: string;
	filename: string;
	status: ExportStatus;
	jobId?: string | null;
	processingMode?: string | null;
	rowCount?: number | null;
	filters?: Record<string, unknown> | null;
	errorMessage?: string | null;
	queuedAt?: string | null;
	startedAt?: string | null;
	completedAt?: string | null;
	failedAt?: string | null;
	createdAt?: string;
	storageProvider?: string | null;
	bucket?: string | null;
	objectKey?: string | null;
	contentType?: string | null;
	sizeBytes?: number | null;
	checksum?: string | null;
	storedAt?: string | null;
}

interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

interface PaginatedApiResponse<T> {
	success: boolean;
	message: string;
	data: T[];
	meta: PaginationMeta;
}

interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
}

export interface ExportLogDownloadInfo {
	url: string;
	expiresIn: number;
	filename: string;
	contentType?: string | null;
	sizeBytes?: number | null;
}

export interface ExportLogStatusInfo {
	id: string;
	jobId?: string | null;
	reportType: string;
	format: string;
	filename: string;
	status: ExportStatus;
	rowCount?: number | null;
	errorMessage?: string | null;
	storedAt?: string | null;
	downloadAvailable: boolean;
}

export const exportLogsService = {
	async list(params?: {
		page?: number;
		limit?: number;
		reportType?: string;
		format?: string;
		status?: ExportStatus;
		actorUserId?: string;
		dateFrom?: string;
		dateTo?: string;
	}): Promise<{ items: ExportLog[]; meta: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<ExportLog>>("/export-logs", { params });
		return { items: response.data.data, meta: response.data.meta };
	},

	async getStatus(id: string): Promise<ExportLogStatusInfo> {
		const response = await apiClient.get<ApiResponse<ExportLogStatusInfo>>(`/export-logs/${id}/status`);
		return response.data.data;
	},

	async download(id: string): Promise<ExportLogDownloadInfo> {
		const response = await apiClient.get<ApiResponse<ExportLogDownloadInfo>>(`/export-logs/${id}/download`);
		return response.data.data;
	},
};
