import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

// Types
export type MonthlyReportType =
	| "sales"
	| "orders"
	| "invoices"
	| "payments"
	| "receivables"
	| "stocks"
	| "shipments";

export type MonthlyReportFormat = "pdf" | "csv" | "xlsx";

export type DeliveryStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface MonthlyReportSchedule {
	id: string;
	name: string;
	reportType: MonthlyReportType;
	dayOfMonth: number;
	format: MonthlyReportFormat;
	recipients: string[];
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface MonthlyReportDeliveryLog {
	id: string;
	scheduleId: string;
	status: DeliveryStatus;
	reportMonth: string;
	startedAt: string;
	completedAt: string | null;
	errorMessage: string | null;
	downloadUrl?: string | null;
	fileSize?: number | null;
}

export interface CreateSchedulePayload {
	name: string;
	reportType: MonthlyReportType;
	dayOfMonth: number;
	format: MonthlyReportFormat;
	recipients: string[];
	isActive: boolean;
}

export interface UpdateSchedulePayload {
	name?: string;
	reportType?: MonthlyReportType;
	dayOfMonth?: number;
	format?: MonthlyReportFormat;
	recipients?: string[];
	isActive?: boolean;
}

export interface RunMonthlyReportPayload {
	reportType: MonthlyReportType;
	year: number;
	month: number;
	format: MonthlyReportFormat;
}

export interface RunReportResponse {
	jobId: string;
	message: string;
}

interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

interface ListSchedulesResponse {
	items: MonthlyReportSchedule[];
}

interface ListDeliveryLogsResponse {
	items: MonthlyReportDeliveryLog[];
	meta: PaginationMeta;
}

interface ListDeliveryLogsParams {
	page?: number;
	limit?: number;
	scheduleId?: string;
	status?: DeliveryStatus;
	year?: number;
	month?: number;
}

/**
 * Monthly Reports Service
 * Handles scheduled report generation and delivery logs
 */
export const monthlyReportsService = {
	/**
	 * List all monthly report schedules
	 */
	async listSchedules(): Promise<{ items: MonthlyReportSchedule[] }> {
		const response = await apiClient.get<ApiResponse<ListSchedulesResponse>>(
			"/monthly-reports/schedules"
		);
		return response.data.data;
	},

	/**
	 * Create a new monthly report schedule
	 */
	async createSchedule(
		payload: CreateSchedulePayload
	): Promise<MonthlyReportSchedule> {
		const response = await apiClient.post<ApiResponse<MonthlyReportSchedule>>(
			"/monthly-reports/schedules",
			payload
		);
		return response.data.data;
	},

	/**
	 * Update an existing monthly report schedule
	 */
	async updateSchedule(
		id: string,
		payload: UpdateSchedulePayload
	): Promise<MonthlyReportSchedule> {
		const response = await apiClient.patch<ApiResponse<MonthlyReportSchedule>>(
			`/monthly-reports/schedules/${id}`,
			payload
		);
		return response.data.data;
	},

	/**
	 * Run a monthly report manually
	 */
	async runReport(payload: RunMonthlyReportPayload): Promise<RunReportResponse> {
		const response = await apiClient.post<ApiResponse<RunReportResponse>>(
			"/monthly-reports/run",
			payload
		);
		return response.data.data;
	},

	/**
	 * List delivery logs with optional filters
	 */
	async listDeliveryLogs(
		params?: ListDeliveryLogsParams
	): Promise<{ items: MonthlyReportDeliveryLog[]; meta: PaginationMeta }> {
		const response = await apiClient.get<ApiResponse<ListDeliveryLogsResponse>>(
			"/monthly-reports/delivery-logs",
			{ params }
		);
		return response.data.data;
	},

	/**
	 * Get a single delivery log by ID
	 */
	async getDeliveryLog(id: string): Promise<MonthlyReportDeliveryLog> {
		const response = await apiClient.get<ApiResponse<MonthlyReportDeliveryLog>>(
			`/monthly-reports/delivery-logs/${id}`
		);
		return response.data.data;
	},

	/**
	 * Download a delivery log file
	 * Returns a blob URL for downloading
	 */
	async downloadDeliveryLog(id: string): Promise<string> {
		const response = await apiClient.get(
			`/monthly-reports/delivery-logs/${id}/download`,
			{
				responseType: "blob",
			}
		);
		const blob = response.data as Blob;
		return URL.createObjectURL(blob);
	},
};

// Monthly report type labels for UI
export const monthlyReportTypeLabels: Record<MonthlyReportType, string> = {
	sales: "Laporan Penjualan",
	orders: "Laporan Order",
	invoices: "Laporan Invoice",
	payments: "Laporan Pembayaran",
	receivables: "Laporan Piutang",
	stocks: "Laporan Stok",
	shipments: "Laporan Pengiriman",
};

// Monthly report format labels for UI
export const monthlyReportFormatLabels: Record<MonthlyReportFormat, string> = {
	pdf: "PDF",
	csv: "CSV",
	xlsx: "Excel (XLSX)",
};

// Delivery status labels for UI
export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
	PENDING: "Menunggu",
	PROCESSING: "Diproses",
	SUCCESS: "Berhasil",
	FAILED: "Gagal",
};
