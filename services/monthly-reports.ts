import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";
import type { PaginationMeta } from "@/services/pagination";

export type MonthlyReportType =
	| "sales"
	| "orders"
	| "invoices"
	| "payments"
	| "receivables"
	| "stocks"
	| "shipments";

export type MonthlyReportFormat = "pdf";
export type DeliveryStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export interface MonthlyReportSchedule {
	id: string;
	name: string;
	cronExpression: string;
	timezone: string;
	recipientEmails: string[];
	reportTypes: MonthlyReportType[];
	format: MonthlyReportFormat;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface MonthlyReportDeliveryLog {
	id: string;
	scheduleId?: string | null;
	periodStart: string;
	periodEnd: string;
	recipientEmails: string[];
	status: DeliveryStatus;
	filename?: string | null;
	contentType?: string | null;
	sizeBytes?: number | null;
	sentAt?: string | null;
	failedAt?: string | null;
	errorMessage?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateSchedulePayload {
	name: string;
	cronExpression: string;
	timezone: string;
	recipientEmails: string[];
	reportTypes: MonthlyReportType[];
	format: MonthlyReportFormat;
	isActive?: boolean;
}

export type UpdateSchedulePayload = Partial<CreateSchedulePayload>;

export interface RunMonthlyReportPayload {
	periodStart?: string;
	periodEnd?: string;
	recipientEmails?: string[];
}

export interface RunReportResponse {
	deliveryLogId: string;
	jobId: string;
	status: DeliveryStatus;
}

export interface DeliveryLogDownloadInfo {
	url: string;
	expiresIn: number;
	filename: string | null;
	contentType: string | null;
	sizeBytes: number | null;
}

interface PaginatedApiResponse<T> {
	success: boolean;
	message: string;
	data: T[];
	meta: PaginationMeta;
}

interface ListDeliveryLogsParams {
	page?: number;
	limit?: number;
	scheduleId?: string;
	status?: DeliveryStatus;
	periodStartFrom?: string;
	periodStartTo?: string;
	createdFrom?: string;
	createdTo?: string;
}

export const monthlyReportsService = {
	async listSchedules(): Promise<MonthlyReportSchedule[]> {
		const response = await apiClient.get<ApiResponse<MonthlyReportSchedule[]>>(
			"/monthly-reports/schedules",
		);
		return response.data.data ?? [];
	},

	async createSchedule(payload: CreateSchedulePayload): Promise<MonthlyReportSchedule> {
		const response = await apiClient.post<ApiResponse<MonthlyReportSchedule>>(
			"/monthly-reports/schedules",
			payload,
		);
		return response.data.data;
	},

	async updateSchedule(
		id: string,
		payload: UpdateSchedulePayload,
	): Promise<MonthlyReportSchedule> {
		const response = await apiClient.patch<ApiResponse<MonthlyReportSchedule>>(
			`/monthly-reports/schedules/${id}`,
			payload,
		);
		return response.data.data;
	},

	async runReport(payload: RunMonthlyReportPayload): Promise<RunReportResponse> {
		const response = await apiClient.post<ApiResponse<RunReportResponse>>(
			"/monthly-reports/run",
			payload,
		);
		return response.data.data;
	},

	async listDeliveryLogs(
		params?: ListDeliveryLogsParams,
	): Promise<{ items: MonthlyReportDeliveryLog[]; meta: PaginationMeta }> {
		const response = await apiClient.get<PaginatedApiResponse<MonthlyReportDeliveryLog>>(
			"/monthly-reports/delivery-logs",
			{ params },
		);
		return {
			items: response.data.data ?? [],
			meta: response.data.meta,
		};
	},

	async getDeliveryLog(id: string): Promise<MonthlyReportDeliveryLog> {
		const response = await apiClient.get<ApiResponse<MonthlyReportDeliveryLog>>(
			`/monthly-reports/delivery-logs/${id}`,
		);
		return response.data.data;
	},

	async downloadDeliveryLog(id: string): Promise<DeliveryLogDownloadInfo> {
		const response = await apiClient.get<ApiResponse<DeliveryLogDownloadInfo>>(
			`/monthly-reports/delivery-logs/${id}/download`,
		);
		return response.data.data;
	},
};

export const monthlyReportTypeLabels: Record<MonthlyReportType, string> = {
	sales: "Laporan Penjualan",
	orders: "Laporan Order",
	invoices: "Laporan Invoice",
	payments: "Laporan Pembayaran",
	receivables: "Laporan Piutang",
	stocks: "Laporan Stok",
	shipments: "Laporan Pengiriman",
};

export const monthlyReportFormatLabels: Record<MonthlyReportFormat, string> = {
	pdf: "PDF",
};

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
	PENDING: "Menunggu",
	PROCESSING: "Diproses",
	SENT: "Berhasil",
	FAILED: "Gagal",
};
