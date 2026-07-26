"use client";

import { useCallback, useEffect, useState } from "react";
import AdminOwnerAnalyticsView from "@/components/dashboard/AdminOwnerAnalyticsView";
import {
	createEmptyOwnerAnalyticsSummary,
	dashboardService,
	type OwnerAnalyticsSection,
	type OwnerAnalyticsSummary,
} from "@/services/dashboard";
import { getRealtimeClient, isDashboardRealtimeEvent } from "@/services/realtime";

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
		let mounted = true;

		void Promise.resolve().then(() => loadOverview(() => mounted));

		return () => {
			mounted = false;
		};
	}, [loadOverview]);

	useEffect(() => {
		let mounted = true;

		void Promise.resolve().then(() => loadDetails(() => mounted));

		return () => {
			mounted = false;
		};
	}, [loadDetails]);

	useEffect(() => {
		let mounted = true;

		const client = getRealtimeClient();
		client.connect();

		const unsubscribe = client.subscribe((eventName, payload) => {
			if (!isDashboardRealtimeEvent(eventName, payload)) return;

			void loadOverview(() => mounted);
			void loadDetails(() => mounted);
		});

		return () => {
			mounted = false;
			unsubscribe();
		};
	}, [loadDetails, loadOverview]);

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
