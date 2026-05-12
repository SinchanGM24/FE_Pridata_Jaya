import apiClient from "@/lib/api-client";

export interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

export interface SalesReportInvoice {
	id: string;
	invoiceNumber: string;
	invoiceDate: string;
	dueDate?: string | null;
	status: string;
	storeId: string;
	storeNameSnapshot?: string | null;
	totalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	store?: {
		id: string;
		name: string;
		assignedSalesUser?: {
			id: string;
			name: string;
			email: string;
		} | null;
	};
}

export interface SalesReportSummary {
	totalInvoices: number;
	totalAmount: number;
	totalPaidAmount: number;
	totalRemainingAmount: number;
	byStatus: Record<string, number>;
}

export interface SalesReportFilters {
	page?: number;
	limit?: number;
	sortBy?: "invoiceDate" | "status" | "createdAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
	dateFrom?: string;
	dateTo?: string;
	storeId?: string;
	status?: string;
	search?: string;
}

interface ReportApiResponse<T> {
	success: boolean;
	message: string;
	data: T[];
	meta?: PaginationMeta;
	summary?: SalesReportSummary;
}

export const reportsService = {
	async getSales(params?: SalesReportFilters) {
		const response = await apiClient.get<ReportApiResponse<SalesReportInvoice>>(
			"/reports/sales",
			{ params },
		);
		return {
			items: response.data.data,
			meta: response.data.meta,
			summary: response.data.summary,
		};
	},

	async listAllSales(params?: Omit<SalesReportFilters, "page" | "limit">) {
		const limit = 100;
		const firstPage = await this.getSales({
			...(params || {}),
			page: 1,
			limit,
		});

		const totalPages = firstPage.meta?.totalPages ?? 1;
		if (totalPages <= 1) {
			return firstPage.items;
		}

		const remainingPages = await Promise.all(
			Array.from({ length: totalPages - 1 }, (_, index) =>
				this.getSales({
					...(params || {}),
					page: index + 2,
					limit,
				}),
			),
		);

		return [firstPage, ...remainingPages].flatMap((page) => page.items);
	},

	async exportSales(format: "pdf" | "csv", params?: SalesReportFilters): Promise<Blob> {
		const response = await apiClient.get("/reports/sales/export", {
			params: { ...(params || {}), format },
			responseType: "blob",
		});
		return response.data as Blob;
	},
};
