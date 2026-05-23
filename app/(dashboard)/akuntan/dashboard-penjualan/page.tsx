"use client";

import { useEffect, useState } from "react";
import AdminOwnerAnalyticsView from "@/components/dashboard/AdminOwnerAnalyticsView";
import {
	createEmptyOwnerAnalyticsSummary,
	dashboardService,
	type OwnerAnalyticsSummary,
} from "@/services/dashboard";

const mergeOwnerAnalyticsOverview = (
	current: OwnerAnalyticsSummary | null,
	incoming: OwnerAnalyticsSummary,
	selectedYear: number,
): OwnerAnalyticsSummary => {
	const base = current ?? createEmptyOwnerAnalyticsSummary(selectedYear);

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
};

export default function DashboardPenjualanPage() {
	const [analytics, setAnalytics] = useState<OwnerAnalyticsSummary | null>(null);
	const [overviewLoading, setOverviewLoading] = useState(true);
	const [error, setError] = useState("");
	const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
	const [analyticsMonth, setAnalyticsMonth] = useState<number | null>(null);
	const [analyticsSalesUserId, setAnalyticsSalesUserId] = useState<string | null>(null);

	const handleAnalyticsYearChange = (year: number) => {
		setOverviewLoading(true);
		setError("");
		setAnalytics(null);
		setAnalyticsYear(year);
	};

	const handleAnalyticsMonthChange = (month: number | null) => {
		setOverviewLoading(true);
		setError("");
		setAnalytics((current) =>
			current ? { ...current, selectedMonth: month, dailySalesTrend: [] } : current,
		);
		setAnalyticsMonth(month);
	};

	const handleAnalyticsSalesUserChange = (salesUserId: string | null) => {
		setError("");
		setAnalytics((current) =>
			current ? { ...current, selectedSalesUserId: salesUserId, targetVsActual: [], yearlyTargetVsActual: [] } : current,
		);
		setAnalyticsSalesUserId(salesUserId);
	};

	useEffect(() => {
		let cancelled = false;

		dashboardService
			.getOwnerAnalytics({ year: analyticsYear, month: analyticsMonth ?? undefined, section: "overview" })
			.then((result) => {
				if (cancelled) return;
				setAnalytics((current) => mergeOwnerAnalyticsOverview(current, result, analyticsYear));
			})
			.catch(() => {
				if (cancelled) return;
				setError("Gagal memuat dashboard penjualan akuntan.");
			})
			.finally(() => {
				if (!cancelled) setOverviewLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [analyticsMonth, analyticsYear]);

	return (
		<AdminOwnerAnalyticsView
			title="Dashboard Akuntan"
			description="Dashboard akuntan untuk memantau tren penjualan, prioritas sales-toko, kesehatan piutang jaringan, dan disiplin pembayaran toko."
			actions={[
				{ label: "Invoice Pembayaran", href: "/akuntan/invoice-pembayaran" },
				{ label: "Aging Piutang", href: "/akuntan/aging-piutang" },
			]}
			analytics={analytics}
			loadingOverview={overviewLoading}
			loadingDetails={false}
			error={error}
			selectedYear={analyticsYear}
			onSelectedYearChange={handleAnalyticsYearChange}
			selectedMonth={analyticsMonth}
			onSelectedMonthChange={handleAnalyticsMonthChange}
			selectedSalesUserId={analyticsSalesUserId}
			onSelectedSalesUserIdChange={handleAnalyticsSalesUserChange}
			dashboardVariant="accountant"
			operationalDetail={null}
		/>
	);
}
