"use client";

import { useEffect, useState } from "react";
import AdminOwnerAnalyticsView from "@/components/dashboard/AdminOwnerAnalyticsView";
import {
	createEmptyOwnerAnalyticsSummary,
	dashboardService,
	type OwnerAnalyticsSection,
	type OwnerAnalyticsSummary,
} from "@/services/dashboard";

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
			current ? { ...current, selectedSalesUserId: salesUserId, targetVsActual: [], yearlyTargetVsActual: [] } : current,
		);
		setAnalyticsSalesUserId(salesUserId);
	};

	const handleAnalyticsMonthChange = (month: number | null) => {
		setOverviewLoading(true);
		setError("");
		setAnalytics((current) =>
			current ? { ...current, selectedMonth: month, dailySalesTrend: [] } : current,
		);
		setAnalyticsMonth(month);
	};

	useEffect(() => {
		let mounted = true;

		dashboardService
			.getOwnerAnalytics({ year: analyticsYear, month: analyticsMonth ?? undefined, section: "overview" })
			.then((result) => {
				if (!mounted) return;
				setAnalytics((current) => mergeOwnerAnalyticsSection(current, result, "overview", analyticsYear));
			})
			.catch(() => {
				if (!mounted) return;
				setError("Gagal memuat dashboard owner.");
			})
			.finally(() => {
				if (mounted) setOverviewLoading(false);
			});

		return () => {
			mounted = false;
		};
	}, [analyticsMonth, analyticsYear]);

	useEffect(() => {
		let mounted = true;

		dashboardService
			.getOwnerAnalytics({
				year: analyticsYear,
				salesUserId: analyticsSalesUserId ?? undefined,
				section: "details",
			})
			.then((result) => {
				if (!mounted) return;
				setAnalytics((current) => mergeOwnerAnalyticsSection(current, result, "details", analyticsYear));
			})
			.catch(() => {
				if (!mounted) return;
				setError((currentError) => currentError || "Gagal memuat detail dashboard owner.");
			})
			.finally(() => {
				if (mounted) setDetailsLoading(false);
			});

		return () => {
			mounted = false;
		};
	}, [analyticsSalesUserId, analyticsYear]);

	return (
		<AdminOwnerAnalyticsView
			title="Dashboard Owner"
			description="Pusat evaluasi usaha untuk membaca kualitas pertumbuhan omzet, kesehatan kas masuk, kekuatan jaringan toko, dan kesiapan inventaris."
			actions={[
				{ label: "Kelola Toko", href: "/owner/kelola-toko" },
				{ label: "Kelola Katalog", href: "/owner/kelola-katalog" },
				{ label: "Aging Piutang", href: "/akuntan/aging-piutang" },
			]}
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
