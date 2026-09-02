"use client";

import { useCallback, useEffect, useState } from "react";
import AdminOwnerAnalyticsView from "@/components/dashboard/AdminOwnerAnalyticsView";
import {
	createEmptyOwnerAnalyticsSummary,
	dashboardService,
	type OwnerAnalyticsSection,
	type OwnerAnalyticsSummary,
} from "@/services/dashboard";
import { getRealtimeClient } from "@/services/realtime";

// Topics whose data feeds this dashboard's analytics. Any event on these
// means the numbers on screen are stale.
const DASHBOARD_REFRESH_TOPICS = new Set([
	"payments",
	"receivables",
	"stocks",
	"stores",
	"suppliers",
	"returns",
	"store_credits",
	"payment_requests",
	"sales_store_assignments",
	"shipments",
]);
const REFRESH_DEBOUNCE_MS = 1500;

const mergeOwnerAnalyticsSection = (
	current: OwnerAnalyticsSummary | null,
	incoming: OwnerAnalyticsSummary,
	section: OwnerAnalyticsSection,
	selectedYear: number,
): OwnerAnalyticsSummary => {
	const base = current ?? createEmptyOwnerAnalyticsSummary(selectedYear);

	if (section === "overview") {
		return {
			...base,
			currentYear: incoming.currentYear,
			selectedYear: incoming.selectedYear,
			selectedMonth: incoming.selectedMonth,
			selectedSalesUserId: incoming.selectedSalesUserId,
			availableYears: incoming.availableYears,
			executiveSummary: incoming.executiveSummary,
			monthlySalesTrend: incoming.monthlySalesTrend,
			dailySalesTrend: incoming.dailySalesTrend,
			yearlySalesTrend: incoming.yearlySalesTrend,
			storePortfolio: incoming.storePortfolio,
			receivableComposition: incoming.receivableComposition,
			stockHealth: incoming.stockHealth,
		};
	}

	return {
		...base,
		currentYear: incoming.currentYear,
		selectedYear: incoming.selectedYear,
		selectedSalesUserId: incoming.selectedSalesUserId,
		availableYears: incoming.availableYears,
		executiveSummary: {
			...base.executiveSummary,
			salesShareByTopStores: incoming.executiveSummary.salesShareByTopStores,
			salesShareByTopSales: incoming.executiveSummary.salesShareByTopSales,
		},
		topStores: incoming.topStores,
		salesContribution: incoming.salesContribution,
		targetVsActual: incoming.targetVsActual ?? [],
		yearlyTargetVsActual: incoming.yearlyTargetVsActual ?? [],
		salesRanking: incoming.salesRanking ?? [],
		salesMonthlyPerformance: incoming.salesMonthlyPerformance ?? [],
		categoryContribution: incoming.categoryContribution ?? [],
		brandPerformance: incoming.brandPerformance ?? [],
		channelMix: incoming.channelMix ?? [],
		storePaymentDiscipline: incoming.storePaymentDiscipline ?? [],
		salesStoreLifecycleMonthly: incoming.salesStoreLifecycleMonthly ?? [],
		salesStoreLifecycleSummary: incoming.salesStoreLifecycleSummary ?? [],
		salesStoreLifecycleStoreDetails: incoming.salesStoreLifecycleStoreDetails ?? [],
		stockFocusItems: incoming.stockFocusItems ?? [],
	};
};

export default function OwnerDashboard() {
	const [overviewLoading, setOverviewLoading] = useState(true);
	const [detailsLoading, setDetailsLoading] = useState(true);
	const [error, setError] = useState("");
	const [analytics, setAnalytics] = useState<OwnerAnalyticsSummary | null>(null);
	const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
	const [analyticsMonth, setAnalyticsMonth] = useState<number | null>(null);
	const [analyticsSalesUserId, setAnalyticsSalesUserId] = useState<string | null>(null);
	const [refreshTick, setRefreshTick] = useState(0);

	const loadOverview = useCallback(
		async (isActive: () => boolean) => {
			try {
				const result = await dashboardService.getOwnerAnalytics({
					year: analyticsYear,
					month: analyticsMonth ?? undefined,
					section: "overview",
				});
				if (!isActive()) return;
				setAnalytics((current) =>
					mergeOwnerAnalyticsSection(current, result, "overview", analyticsYear),
				);
			} catch {
				if (!isActive()) return;
				setError("Gagal memuat dashboard owner.");
			} finally {
				if (isActive()) setOverviewLoading(false);
			}
		},
		[analyticsMonth, analyticsYear],
	);

	const loadDetails = useCallback(
		async (isActive: () => boolean) => {
			try {
				const result = await dashboardService.getOwnerAnalytics({
					year: analyticsYear,
					month: analyticsMonth ?? undefined,
					salesUserId: analyticsSalesUserId ?? undefined,
					section: "details",
				});
				if (!isActive()) return;
				setAnalytics((current) =>
					mergeOwnerAnalyticsSection(current, result, "details", analyticsYear),
				);
			} catch {
				if (!isActive()) return;
				setError((currentError) => currentError || "Gagal memuat detail dashboard owner.");
			} finally {
				if (isActive()) setDetailsLoading(false);
			}
		},
		[analyticsMonth, analyticsSalesUserId, analyticsYear],
	);

	const handleAnalyticsYearChange = (year: number) => {
		setOverviewLoading(true);
		setDetailsLoading(true);
		setError("");
		setAnalytics(null);
		setAnalyticsYear(year);
	};

	const handleAnalyticsSalesUserChange = (salesUserId: string | null) => {
		setDetailsLoading(true);
		setError("");
		setAnalytics((current) =>
			current
				? { ...current, selectedSalesUserId: salesUserId, targetVsActual: [], yearlyTargetVsActual: [], categoryContribution: [], brandPerformance: [] }
				: current,
		);
		setAnalyticsSalesUserId(salesUserId);
	};

	const handleAnalyticsMonthChange = (month: number | null) => {
		setOverviewLoading(true);
		setDetailsLoading(true);
		setError("");
		setAnalytics((current) =>
			current ? { ...current, selectedMonth: month, dailySalesTrend: [], categoryContribution: [], brandPerformance: [] } : current,
		);
		setAnalyticsMonth(month);
	};

	useEffect(() => {
		const client = getRealtimeClient();
		client.connect();

		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		const unsubscribe = client.subscribe((eventName) => {
			if (!DASHBOARD_REFRESH_TOPICS.has(eventName)) return;
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => setRefreshTick((tick) => tick + 1), REFRESH_DEBOUNCE_MS);
		});

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			unsubscribe();
		};
	}, []);

	useEffect(() => {
		let mounted = true;

		void Promise.resolve().then(() => loadOverview(() => mounted));

		return () => {
			mounted = false;
		};
	}, [loadOverview, refreshTick]);

	useEffect(() => {
		let mounted = true;

		void Promise.resolve().then(() => loadDetails(() => mounted));

		return () => {
			mounted = false;
		};
	}, [loadDetails, refreshTick]);

	return (
		<AdminOwnerAnalyticsView
			title="Dashboard Owner"
			description="Pusat evaluasi usaha untuk membaca kualitas pertumbuhan omzet, kesehatan kas masuk, kekuatan jaringan toko, dan kesiapan inventaris."
			analytics={analytics}
			loadingOverview={overviewLoading}
			loadingDetails={detailsLoading}
			error={error}
			selectedYear={analyticsYear}
			onSelectedYearChange={handleAnalyticsYearChange}
			selectedMonth={analyticsMonth}
			onSelectedMonthChange={handleAnalyticsMonthChange}
			selectedSalesUserId={analyticsSalesUserId}
			onSelectedSalesUserIdChange={handleAnalyticsSalesUserChange}
			dashboardVariant="owner"
			operationalDetail={null}
		/>
	);
}
