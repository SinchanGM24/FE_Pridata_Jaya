"use client";

import { useCallback, useEffect, useState } from "react";
import AdminOwnerAnalyticsView from "@/components/dashboard/AdminOwnerAnalyticsView";
import {
	createEmptyOwnerAnalyticsSummary,
	dashboardService,
	type OwnerAnalyticsSummary,
} from "@/services/dashboard";
import { getRealtimeClient, isDashboardRealtimeEvent } from "@/services/realtime";

const mergeOwnerAnalyticsOverview = (
	current: OwnerAnalyticsSummary | null,
	incoming: OwnerAnalyticsSummary,
	selectedYear: number,
): OwnerAnalyticsSummary => {
	const base = current ?? createEmptyOwnerAnalyticsSummary(selectedYear);

	return {
		...base,
		...incoming,
	};
};

export default function DashboardPenjualanPage() {
	const [analytics, setAnalytics] = useState<OwnerAnalyticsSummary | null>(null);
	const [overviewLoading, setOverviewLoading] = useState(true);
	const [error, setError] = useState("");
	const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
	const [analyticsMonth, setAnalyticsMonth] = useState<number | null>(null);
	const [analyticsSalesUserId, setAnalyticsSalesUserId] = useState<string | null>(null);

	const loadAnalytics = useCallback(
		async (isActive: () => boolean) => {
			try {
				const result = await dashboardService.getAccountantAnalytics({
					year: analyticsYear,
					month: analyticsMonth ?? undefined,
				});
				if (!isActive()) return;
				setAnalytics((current) => mergeOwnerAnalyticsOverview(current, result, analyticsYear));
			} catch {
				if (!isActive()) return;
				setError("Gagal memuat dashboard penjualan akuntan.");
			} finally {
				if (isActive()) setOverviewLoading(false);
			}
		},
		[analyticsMonth, analyticsYear],
	);

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

		void Promise.resolve().then(() => loadAnalytics(() => !cancelled));

		return () => {
			cancelled = true;
		};
	}, [loadAnalytics]);

	useEffect(() => {
		let mounted = true;

		const client = getRealtimeClient();
		client.connect();

		const unsubscribe = client.subscribe((eventName, payload) => {
			if (!isDashboardRealtimeEvent(eventName, payload)) return;

			void loadAnalytics(() => mounted);
		});

		return () => {
			mounted = false;
			unsubscribe();
		};
	}, [loadAnalytics]);

	return (
		<AdminOwnerAnalyticsView
			title="Dashboard Akuntan"
			description="Dashboard akuntan untuk memantau tren penjualan, prioritas sales-toko, kesehatan piutang jaringan, dan disiplin pembayaran toko."
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
