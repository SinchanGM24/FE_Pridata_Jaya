"use client";

import { useEffect, useState } from "react";
import AdminRecentActivity from "@/components/admin/AdminRecentActivity";
import AdminOwnerAnalyticsView from "@/components/dashboard/AdminOwnerAnalyticsView";
import { DashboardCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { getApiErrorMessage } from "@/lib/api-errors";
import { auditService } from "@/services/audit";
import {
	createEmptyOwnerAnalyticsSummary,
	dashboardService,
	type OwnerAnalyticsSection,
	type OwnerAnalyticsSummary,
} from "@/services/dashboard";
import { userService } from "@/services/user";

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

export default function AdminDashboard() {
	const [analytics, setAnalytics] = useState<OwnerAnalyticsSummary | null>(null);
	const [userCount, setUserCount] = useState<number | null>(null);
	const [auditCount, setAuditCount] = useState<number | null>(null);
	const [error, setError] = useState("");
	const [overviewLoading, setOverviewLoading] = useState(true);
	const [detailsLoading, setDetailsLoading] = useState(true);
	const [operationalLoading, setOperationalLoading] = useState(true);
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
		let cancelled = false;

		dashboardService
			.getOwnerAnalytics({ year: analyticsYear, month: analyticsMonth ?? undefined, section: "overview" })
			.then((analyticsResult) => {
				if (cancelled) return;
				setAnalytics((current) =>
					mergeOwnerAnalyticsSection(current, analyticsResult, "overview", analyticsYear),
				);
			})
			.catch((loadError: unknown) => {
				if (cancelled) return;
				setError(getApiErrorMessage(loadError, "Gagal memuat dashboard admin."));
			})
			.finally(() => {
				if (!cancelled) {
					setOverviewLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [analyticsMonth, analyticsYear]);

	useEffect(() => {
		let cancelled = false;

		dashboardService
			.getOwnerAnalytics({
				year: analyticsYear,
				salesUserId: analyticsSalesUserId ?? undefined,
				section: "details",
			})
			.then((analyticsResult) => {
				if (cancelled) return;
				setAnalytics((current) =>
					mergeOwnerAnalyticsSection(current, analyticsResult, "details", analyticsYear),
				);
			})
			.catch((loadError: unknown) => {
				if (cancelled) return;
				setError((currentError) =>
					currentError || getApiErrorMessage(loadError, "Gagal memuat detail dashboard admin."),
				);
			})
			.finally(() => {
				if (!cancelled) {
					setDetailsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [analyticsSalesUserId, analyticsYear]);

	useEffect(() => {
		let cancelled = false;

		Promise.all([userService.getCount(), auditService.getCount()])
			.then(([totalUsers, totalAudits]) => {
				if (cancelled) return;
				setUserCount(totalUsers);
				setAuditCount(totalAudits);
			})
			.catch((loadError: unknown) => {
				if (cancelled) return;
				setError((currentError) =>
					currentError || getApiErrorMessage(loadError, "Gagal memuat ringkasan operasional admin."),
				);
			})
			.finally(() => {
				if (!cancelled) {
					setOperationalLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<AdminOwnerAnalyticsView
			title="Dasbor Admin"
			description="Pusat pemantauan operasional untuk membaca kualitas pertumbuhan penjualan, risiko piutang, dan kesehatan jaringan distribusi."
			actions={[
				{ label: "Master Data", href: "/admin/master-data" },
				{ label: "Kelola Pengguna", href: "/owner/kelola-user" },
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
			operationalDetail={
				<div className="flex h-full flex-col gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						{operationalLoading ? (
							<>
								<DashboardCardSkeleton chartHeight={0} lineCount={2} />
								<DashboardCardSkeleton chartHeight={0} lineCount={2} />
							</>
						) : (
							<>
								<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
									<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pengguna</p>
									<p className="mt-3 text-2xl font-semibold text-slate-900">{userCount ?? "-"}</p>
									<p className="mt-1 text-sm text-slate-500">Total akun yang aktif dipantau sistem.</p>
								</div>
								<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
									<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Log Audit</p>
									<p className="mt-3 text-2xl font-semibold text-indigo-600">{auditCount ?? "-"}</p>
									<p className="mt-1 text-sm text-slate-500">Catatan aktivitas yang tercatat untuk kontrol operasional.</p>
								</div>
							</>
						)}
					</div>
					<div className="flex-1">
						<AdminRecentActivity />
					</div>
				</div>
			}
			operationalDetailLoading={
				<div className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<DashboardCardSkeleton chartHeight={0} lineCount={2} />
						<DashboardCardSkeleton chartHeight={0} lineCount={2} />
					</div>
					{operationalLoading ? <DashboardCardSkeleton chartHeight={260} lineCount={2} /> : null}
				</div>
			}
		/>
	);
}
