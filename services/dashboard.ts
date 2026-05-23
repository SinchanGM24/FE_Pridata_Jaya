import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface DashboardSalesSummary {
	totalInvoices: number;
	totalAmount: number;
	totalPaidAmount: number;
	totalRemainingAmount: number;
	byStatus: Record<string, number>;
}

export interface DashboardAgingBucket {
	count: number;
	amount: number;
}

export interface DashboardReceivableSummary {
	totalReceivables: number;
	totalOutstandingAmount: number;
	overdueCount: number;
	aging: {
		current: DashboardAgingBucket;
		days1To30: DashboardAgingBucket;
		days31To60: DashboardAgingBucket;
		days61To90: DashboardAgingBucket;
		daysOver90: DashboardAgingBucket;
	};
}

export interface OverallSummary {
	totalOrders: number;
	totalInvoices: number;
	totalSalesAmount: number;
	totalOutstandingReceivableAmount: number;
	totalDeliveryOrders: number;
	totalOutOfStockSkus: number;
}

export interface StockSummary {
	totalSkus: number;
	totalQuantity: number;
	outOfStockCount: number;
	lowStockCount: number;
	threshold: number;
}

export interface OwnerAnalyticsMonthlyPoint {
	monthNumber: number;
	monthLabel: string;
	salesAmount: number;
	paidAmount: number;
	outstandingAmount: number;
	invoiceCount: number;
	collectionRate: number;
}

export interface OwnerAnalyticsDailyPoint {
	dayNumber: number;
	dayLabel: string;
	salesAmount: number;
	paidAmount: number;
	outstandingAmount: number;
	invoiceCount: number;
	collectionRate: number;
}

export interface OwnerAnalyticsYearlyPoint {
	year: number;
	salesAmount: number;
	paidAmount: number;
	outstandingAmount: number;
	invoiceCount: number;
	collectionRate: number;
}

export interface OwnerAnalyticsExecutiveSummary {
	totalSalesAmount: number;
	totalPaidAmount: number;
	totalOutstandingAmount: number;
	totalInvoices: number;
	collectionRate: number;
	outstandingRatio: number;
	salesShareByTopStores: number;
	salesShareByTopSales: number;
	monthlyGrowthRate: number;
	paymentGrowthRate: number;
}

export interface OwnerAnalyticsStorePortfolio {
	totalStores: number;
	activeStores: number;
	inactiveStores: number;
	verifiedStores: number;
	pendingStores: number;
	rejectedStores: number;
	totalCreditLimit: number;
}

export interface OwnerAnalyticsTopStore {
	storeId: string;
	storeName: string;
	salesUserId: string | null;
	salesUserName: string;
	salesAmount: number;
	paidAmount: number;
	outstandingAmount: number;
	invoiceCount: number;
	verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
	isActive: boolean;
}

export interface OwnerAnalyticsSalesContribution {
	salesUserId: string | null;
	salesUserName: string;
	storeCount: number;
	salesAmount: number;
	paidAmount: number;
	outstandingAmount: number;
	invoiceCount: number;
	salesShare: number;
}

export interface OwnerAnalyticsTargetActualPoint {
	periodLabel: string;
	actualAmount: number;
	targetAmount: number | null;
	achievementRate: number | null;
}

export interface OwnerAnalyticsSalesRankingPoint {
	salesUserId: string | null;
	salesUserName: string;
	salesAmount: number;
	targetAmount: number | null;
	achievementRate: number | null;
	invoiceCount: number;
	storeCount: number;
	salesShare: number;
}

export interface OwnerAnalyticsSalesMonthlyPerformancePoint {
	salesUserId: string;
	salesUserName: string;
	storeCount: number;
	salesShare: number;
	totalSalesAmount: number;
	monthlySales: Array<{
		monthNumber: number;
		monthLabel: string;
		salesAmount: number;
		invoiceCount: number;
	}>;
}

export interface OwnerAnalyticsSalesCurrentMonthSnapshot {
	salesUserId: string;
	salesUserName: string;
	storeCount: number;
	monthNumber: number;
	monthLabel: string;
	year: number;
	actualAmount: number;
	targetAmount: number | null;
	achievementRate: number | null;
}

export interface OwnerAnalyticsCategoryContribution {
	categoryId: string | null;
	categoryName: string;
	salesAmount: number;
	salesShare: number;
}

export interface OwnerAnalyticsBrandPerformance {
	brandId: string | null;
	brandName: string;
	salesAmount: number;
	salesShare: number;
	growthRate: number;
}

export interface OwnerAnalyticsChannelMix {
	channelKey: string;
	channelLabel: string;
	salesAmount: number;
	salesShare: number;
}

export interface OwnerAnalyticsStorePaymentDiscipline {
	storeId: string;
	storeName: string;
	salesUserName: string;
	paidAmount: number;
	currentOutstandingAmount: number;
	outstandingAmount: number;
	overdueAmount: number;
	maxOverdueDays: number;
	collectionRate: number;
	disciplineLabel: "LANCAR" | "NUNGGAK";
	invoices: OwnerAnalyticsStorePaymentDisciplineInvoice[];
}

export interface OwnerAnalyticsStorePaymentDisciplineInvoice {
	invoiceId: string;
	invoiceNumber: string;
	invoiceDate: string;
	dueDate: string | null;
	totalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	status: string;
	overdueDays: number;
}

export interface OwnerAnalyticsSalesStoreLifecycleMonthlyPoint {
	salesUserId: string | null;
	salesUserName: string;
	monthNumber: number;
	monthLabel: string;
	newStoreCount: number;
	firstOrderStoreCount: number;
	legacyStoreCount: number;
	repeatOrderCount: number;
}

export interface OwnerAnalyticsSalesStoreLifecycleSummary {
	salesUserId: string | null;
	salesUserName: string;
	totalManagedStores: number;
	legacyStoreCount: number;
	repeatOrderCount: number;
}

export interface OwnerAnalyticsSalesStoreLifecycleStoreDetail {
	storeId: string;
	storeName: string;
	salesUserId: string | null;
	salesUserName: string;
	monthNumber: number;
	monthLabel: string;
	verificationMonthNumber: number;
	verificationMonthLabel: string;
	firstOrderMonthNumber: number | null;
	firstOrderMonthLabel: string | null;
	lastOrderMonthNumber: number | null;
	lastOrderMonthLabel: string | null;
	isNewStore: boolean;
	hasFirstOrder: boolean;
	isLegacyStore: boolean;
	hasRepeatOrder: boolean;
	missingFirstOrder: boolean;
	missingRepeatOrder: boolean;
}

export interface OwnerAnalyticsStockHealth {
	totalSkus: number;
	healthySkus: number;
	lowStockSkus: number;
	outOfStockSkus: number;
	threshold: number;
}

export interface OwnerAnalyticsStockFocusItem {
	productId: string;
	productName: string;
	quantity: number;
	stockStatus: "AMAN" | "MENIPIS" | "HABIS";
}

export interface OwnerAnalyticsSummary {
	currentYear: number;
	currentMonthNumber: number;
	currentMonthLabel: string;
	selectedYear: number;
	selectedMonth: number | null;
	selectedSalesUserId: string | null;
	availableYears: number[];
	executiveSummary: OwnerAnalyticsExecutiveSummary;
	monthlySalesTrend: OwnerAnalyticsMonthlyPoint[];
	dailySalesTrend: OwnerAnalyticsDailyPoint[];
	yearlySalesTrend: OwnerAnalyticsYearlyPoint[];
	storePortfolio: OwnerAnalyticsStorePortfolio;
	topStores: OwnerAnalyticsTopStore[];
	salesContribution: OwnerAnalyticsSalesContribution[];
	targetVsActual?: OwnerAnalyticsTargetActualPoint[];
	yearlyTargetVsActual?: OwnerAnalyticsTargetActualPoint[];
	salesRanking?: OwnerAnalyticsSalesRankingPoint[];
	salesMonthlyPerformance?: OwnerAnalyticsSalesMonthlyPerformancePoint[];
	salesCurrentMonthSnapshots?: OwnerAnalyticsSalesCurrentMonthSnapshot[];
	categoryContribution?: OwnerAnalyticsCategoryContribution[];
	brandPerformance?: OwnerAnalyticsBrandPerformance[];
	channelMix?: OwnerAnalyticsChannelMix[];
	storePaymentDiscipline?: OwnerAnalyticsStorePaymentDiscipline[];
	salesStoreLifecycleMonthly?: OwnerAnalyticsSalesStoreLifecycleMonthlyPoint[];
	salesStoreLifecycleSummary?: OwnerAnalyticsSalesStoreLifecycleSummary[];
	salesStoreLifecycleStoreDetails?: OwnerAnalyticsSalesStoreLifecycleStoreDetail[];
	receivableComposition: DashboardReceivableSummary["aging"];
	stockHealth: OwnerAnalyticsStockHealth;
	stockFocusItems?: OwnerAnalyticsStockFocusItem[];
}

export interface OwnerFocusSalesStoreSummary {
	currentYear: number;
	currentMonthNumber: number;
	currentMonthLabel: string;
	selectedYear: number;
	selectedMonth: number | null;
	availableYears: number[];
	executiveSummary: Pick<
		OwnerAnalyticsExecutiveSummary,
		"salesShareByTopStores" | "salesShareByTopSales"
	>;
	topStores: OwnerAnalyticsTopStore[];
	salesContribution: OwnerAnalyticsSalesContribution[];
}

export interface OwnerReceivablesSummary {
	receivableComposition: DashboardReceivableSummary["aging"];
	storePaymentDiscipline: OwnerAnalyticsStorePaymentDiscipline[];
}

export interface OwnerTrendSummary {
	currentYear: number;
	currentMonthNumber: number;
	currentMonthLabel: string;
	selectedYear: number;
	selectedMonth: number | null;
	selectedSalesUserId: null;
	availableYears: number[];
	executiveSummary: OwnerAnalyticsExecutiveSummary;
	monthlySalesTrend: OwnerAnalyticsMonthlyPoint[];
	dailySalesTrend: OwnerAnalyticsDailyPoint[];
	yearlySalesTrend: OwnerAnalyticsYearlyPoint[];
}

export interface OwnerSalesRankingSummary {
	currentYear: number;
	currentMonthNumber: number;
	currentMonthLabel: string;
	selectedYear: number;
	selectedMonth: null;
	selectedSalesUserId: null;
	availableYears: number[];
	executiveSummary: Pick<OwnerAnalyticsExecutiveSummary, "salesShareByTopSales">;
	salesContribution: OwnerAnalyticsSalesContribution[];
	salesMonthlyPerformance: OwnerAnalyticsSalesMonthlyPerformancePoint[];
}

export interface OwnerTargetActualSummary {
	currentYear: number;
	currentMonthNumber: number;
	currentMonthLabel: string;
	selectedYear: number;
	selectedMonth: null;
	selectedSalesUserId: string | null;
	availableYears: number[];
	salesContribution: OwnerAnalyticsSalesContribution[];
	salesMonthlyPerformance: OwnerAnalyticsSalesMonthlyPerformancePoint[];
	salesCurrentMonthSnapshots: OwnerAnalyticsSalesCurrentMonthSnapshot[];
	targetVsActual: OwnerAnalyticsTargetActualPoint[];
	yearlyTargetVsActual: OwnerAnalyticsTargetActualPoint[];
}

export type OwnerAnalyticsSection = "overview" | "details";

export const createEmptyOwnerAnalyticsSummary = (selectedYear: number): OwnerAnalyticsSummary => ({
	currentYear: selectedYear,
	currentMonthNumber: 1,
	currentMonthLabel: "Jan",
	selectedYear,
	selectedMonth: null,
	selectedSalesUserId: null,
	availableYears: [selectedYear],
	executiveSummary: {
		totalSalesAmount: 0,
		totalPaidAmount: 0,
		totalOutstandingAmount: 0,
		totalInvoices: 0,
		collectionRate: 0,
		outstandingRatio: 0,
		salesShareByTopStores: 0,
		salesShareByTopSales: 0,
		monthlyGrowthRate: 0,
		paymentGrowthRate: 0,
	},
	monthlySalesTrend: [],
	dailySalesTrend: [],
	yearlySalesTrend: [],
	storePortfolio: {
		totalStores: 0,
		activeStores: 0,
		inactiveStores: 0,
		verifiedStores: 0,
		pendingStores: 0,
		rejectedStores: 0,
		totalCreditLimit: 0,
	},
	topStores: [],
	salesContribution: [],
	targetVsActual: [],
	yearlyTargetVsActual: [],
	salesRanking: [],
	salesMonthlyPerformance: [],
	categoryContribution: [],
	brandPerformance: [],
	channelMix: [],
	storePaymentDiscipline: [],
	salesStoreLifecycleMonthly: [],
	salesStoreLifecycleSummary: [],
	salesStoreLifecycleStoreDetails: [],
	receivableComposition: {
		current: { count: 0, amount: 0 },
		days1To30: { count: 0, amount: 0 },
		days31To60: { count: 0, amount: 0 },
		days61To90: { count: 0, amount: 0 },
		daysOver90: { count: 0, amount: 0 },
	},
	stockHealth: {
		totalSkus: 0,
		healthySkus: 0,
		lowStockSkus: 0,
		outOfStockSkus: 0,
		threshold: 10,
	},
	stockFocusItems: [],
});

export interface AccountantAnalyticsMonthlyPoint {
	monthNumber: number;
	monthLabel: string;
	billedAmount: number;
	collectedAmount: number;
	invoiceCount: number;
	paymentCount: number;
	collectionRate: number;
}

export interface AccountantAnalyticsExecutiveSummary {
	totalBilledAmount: number;
	totalCollectedAmount: number;
	totalOutstandingAmount: number;
	overdueAmount: number;
	overdueCount: number;
	collectionRate: number;
	overdueRatio: number;
	averageDaysOverdue: number;
	paymentMethodShareByAmount: number;
	backlogSeverity: "LOW" | "MEDIUM" | "HIGH";
}

export interface AccountantAnalyticsTopRiskStore {
	storeId: string;
	storeName: string;
	outstandingAmount: number;
	overdueAmount: number;
	overdueCount: number;
	invoiceCount: number;
}

export interface AccountantAnalyticsOverdueInvoice {
	invoiceId: string;
	invoiceNumber: string;
	storeId: string;
	storeName: string;
	dueDate: string | null;
	remainingAmount: number;
	overdueDays: number;
	status: "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";
}

export interface AccountantAnalyticsPaymentMethodMix {
	method: "CASH" | "TRANSFER";
	amount: number;
	count: number;
}

export interface AccountantAnalyticsBacklog {
	draftInvoiceCount: number;
	pendingPaymentCount: number;
	pendingPaymentAmount: number;
	pendingReturnCount: number;
	pendingReturnAdjustmentAmount: number;
}

export interface AccountantAnalyticsCashInPoint {
	periodLabel: string;
	billedAmount: number;
	collectedAmount: number;
	paymentCount: number;
}

export interface AccountantAnalyticsTopCustomerDebtPoint {
	storeId: string;
	storeName: string;
	outstandingAmount: number;
	overdueAmount: number;
	invoiceCount: number;
	overdueCount: number;
}

export interface AccountantAnalyticsSummary {
	currentYear: number;
	selectedYear: number;
	availableYears: number[];
	selectedMonth: number | null;
	executiveSummary: AccountantAnalyticsExecutiveSummary;
	monthlyCollectionTrend: AccountantAnalyticsMonthlyPoint[];
	cashInTrend: AccountantAnalyticsCashInPoint[];
	topRiskStores: AccountantAnalyticsTopRiskStore[];
	topOverdueInvoices: AccountantAnalyticsOverdueInvoice[];
	paymentMethodMix: AccountantAnalyticsPaymentMethodMix[];
	backlog: AccountantAnalyticsBacklog;
	topCustomerDebt?: AccountantAnalyticsTopCustomerDebtPoint[];
}

export const dashboardService = {
	async getSummary(): Promise<OverallSummary> {
		const res = await apiClient.get<ApiResponse<OverallSummary>>("/dashboard/summary");
		return res.data.data;
	},

	async getStocks(threshold = 10): Promise<StockSummary> {
		const res = await apiClient.get<ApiResponse<StockSummary>>("/dashboard/stocks", {
			params: { threshold },
		});
		return res.data.data;
	},

	async getSales(params?: Record<string, unknown>): Promise<DashboardSalesSummary> {
		const res = await apiClient.get<ApiResponse<DashboardSalesSummary>>("/dashboard/sales", {
			params,
		});
		return res.data.data;
	},

	async getReceivables(params?: Record<string, unknown>): Promise<DashboardReceivableSummary> {
		const res = await apiClient.get<ApiResponse<DashboardReceivableSummary>>(
			"/dashboard/receivables",
			{ params },
		);
		return res.data.data;
	},

	async getOwnerAnalytics(params?: {
		year?: number;
		month?: number;
		salesUserId?: string;
		section?: OwnerAnalyticsSection;
	}): Promise<OwnerAnalyticsSummary> {
		try {
			const res = await apiClient.get<ApiResponse<OwnerAnalyticsSummary>>("/dashboard/owner-analytics", {
				params,
			});
			return res.data.data;
		} catch (error) {
			if (params?.year === undefined) {
				throw error;
			}

			const fallbackRes =
				await apiClient.get<ApiResponse<OwnerAnalyticsSummary>>("/dashboard/owner-analytics");
			return fallbackRes.data.data;
		}
	},

	async getOwnerFocusSalesStore(params?: {
		year?: number;
		month?: number;
	}): Promise<OwnerFocusSalesStoreSummary> {
		const res = await apiClient.get<ApiResponse<OwnerFocusSalesStoreSummary>>(
			"/dashboard/owner-analytics/focus-sales-store",
			{ params },
		);
		return res.data.data;
	},

	async getOwnerReceivables(): Promise<OwnerReceivablesSummary> {
		const res = await apiClient.get<ApiResponse<OwnerReceivablesSummary>>(
			"/dashboard/owner-analytics/receivables",
		);
		return res.data.data;
	},

	async getOwnerTrend(params?: {
		year?: number;
		month?: number;
	}): Promise<OwnerTrendSummary> {
		const res = await apiClient.get<ApiResponse<OwnerTrendSummary>>(
			"/dashboard/owner-analytics/trend",
			{ params },
		);
		return res.data.data;
	},

	async getOwnerSalesRanking(params?: {
		year?: number;
	}): Promise<OwnerSalesRankingSummary> {
		const res = await apiClient.get<ApiResponse<OwnerSalesRankingSummary>>(
			"/dashboard/owner-analytics/sales-ranking",
			{ params },
		);
		return res.data.data;
	},

	async getOwnerTargetActual(params?: {
		year?: number;
		salesUserId?: string;
	}): Promise<OwnerTargetActualSummary> {
		const res = await apiClient.get<ApiResponse<OwnerTargetActualSummary>>(
			"/dashboard/owner-analytics/target-actual",
			{ params },
		);
		return res.data.data;
	},

	async getAccountantAnalytics(params?: {
		year?: number;
		month?: number;
		dateFrom?: string;
		dateTo?: string;
	}): Promise<AccountantAnalyticsSummary> {
		try {
			const res = await apiClient.get<ApiResponse<AccountantAnalyticsSummary>>(
				"/dashboard/accountant-analytics",
				{ params },
			);
			return res.data.data;
		} catch (error) {
			if (params?.year === undefined) {
				throw error;
			}

			const fallbackRes = await apiClient.get<ApiResponse<AccountantAnalyticsSummary>>(
				"/dashboard/accountant-analytics",
			);
			return fallbackRes.data.data;
		}
	},
};
