"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandPerformanceHeatmapCard from "@/components/dashboard/BrandPerformanceHeatmapCard";
import CategoryTreemapCard from "@/components/dashboard/CategoryTreemapCard";
import {
	DashboardCardSkeleton,
	DashboardMetricStripSkeleton,
	DashboardSectionGridSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import ExecutiveTargetActualChartCard from "@/components/dashboard/ExecutiveTargetActualChartCard";
import ExecutiveMetricsStrip from "@/components/dashboard/ExecutiveMetricsStrip";
import type { ExecutiveMetricItem } from "@/components/dashboard/ExecutiveMetricsStrip";
import MultiMetricCompetitionCard, {
	type CompetitionItem,
	type CompetitionMetric,
} from "@/components/dashboard/MultiMetricCompetitionCard";
import PortfolioStackCard from "@/components/dashboard/PortfolioStackCard";
import SalesRankingChartCard from "@/components/dashboard/SalesRankingChartCard";
import SalesStoreLifecycleYearlyChartCard, {
	type LifecycleVerticalMode,
} from "@/components/dashboard/SalesStoreLifecycleYearlyChartCard";
import ReceivableMonitoringSection from "@/components/dashboard/ReceivableMonitoringSection";
import SalesTrendCard from "@/components/dashboard/SalesTrendCard";
import { formatCompactRupiah, formatPercent, formatRupiah } from "@/components/dashboard/chart-utils";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	dashboardService,
	type OwnerAnalyticsSummary,
	type OwnerFocusSalesStoreSummary,
	type OwnerReceivablesSummary,
	type OwnerSalesRankingSummary,
	type OwnerTargetActualSummary,
	type OwnerTrendSummary,
} from "@/services/dashboard";

const verificationLabel: Record<string, string> = {
	VERIFIED: "Terverifikasi",
	PENDING: "Menunggu",
	REJECTED: "Ditolak",
};

const competitionMetrics: CompetitionMetric[] = [
	{ key: "salesAmount", label: "Omzet", color: "bg-slate-900", axis: "currency" },
	{ key: "outstandingAmount", label: "Piutang", color: "bg-amber-500", axis: "currency" },
	{ key: "paidAmount", label: "Sudah Dibayar", color: "bg-sky-500", axis: "currency" },
];

const monthOptions = [
	{ value: 1, label: "Jan" },
	{ value: 2, label: "Feb" },
	{ value: 3, label: "Mar" },
	{ value: 4, label: "Apr" },
	{ value: 5, label: "Mei" },
	{ value: 6, label: "Jun" },
	{ value: 7, label: "Jul" },
	{ value: 8, label: "Ags" },
	{ value: 9, label: "Sep" },
	{ value: 10, label: "Okt" },
	{ value: 11, label: "Nov" },
	{ value: 12, label: "Des" },
];

const sortLifecycleItemsByAttention = <
	T extends {
		storeName: string;
		missingFirstOrder?: boolean;
		missingRepeatOrder?: boolean;
	}
>(
	items: T[],
	priority: "missingFirstOrder" | "missingRepeatOrder" | null,
) =>
	[...items].sort((left, right) => {
		const leftPriority = priority ? Number(Boolean(left[priority])) : 0;
		const rightPriority = priority ? Number(Boolean(right[priority])) : 0;
		return rightPriority - leftPriority || left.storeName.localeCompare(right.storeName);
	});

const buildLifecycleSubset = (source: OwnerAnalyticsSummary): OwnerAnalyticsSummary => ({
	...source,
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
	stockFocusItems: [],
});

type LifecycleDetailFocus = {
	salesUserId: string;
	salesLabel: string;
	monthNumber: number;
};

export default function AdminOwnerAnalyticsView({
	title,
	description,
	actions,
	analytics,
	loadingOverview,
	loadingDetails,
	error,
	selectedYear,
	selectedMonth,
	selectedSalesUserId,
	dashboardVariant = "admin",
	operationalDetail,
	operationalDetailLoading,
}: {
	title: string;
	description: string;
	actions: Array<{ label: string; href: string }>;
	analytics: OwnerAnalyticsSummary | null;
	loadingOverview: boolean;
	loadingDetails: boolean;
	error: string;
	selectedYear: number;
	onSelectedYearChange: (year: number) => void;
	selectedMonth: number | null;
	onSelectedMonthChange: (month: number | null) => void;
	selectedSalesUserId: string | null;
	onSelectedSalesUserIdChange: (salesUserId: string | null) => void;
	dashboardVariant?: "owner" | "admin" | "accountant";
	operationalDetail: ReactNode;
	operationalDetailLoading?: ReactNode;
}) {
	const router = useRouter();
	const isOwnerVariant = dashboardVariant === "owner";
	const isAccountantVariant = dashboardVariant === "accountant";
	const showOverviewSkeleton = loadingOverview && !analytics;
	const [topStoreSalesUserId, setTopStoreSalesUserId] = useState<string>("all");
	const [trendSelectedYear, setTrendSelectedYear] = useState<number>(analytics?.selectedYear ?? selectedYear);
	const [trendSelectedMonth, setTrendSelectedMonth] = useState<number | null>(selectedMonth);
	const [trendAnalytics, setTrendAnalytics] = useState<OwnerTrendSummary | null>(null);
	const [trendLoading, setTrendLoading] = useState(false);
	const [targetSelectedYear, setTargetSelectedYear] = useState<number>(analytics?.selectedYear ?? selectedYear);
	const [targetSelectedSalesUserId, setTargetSelectedSalesUserId] = useState<string | null>(selectedSalesUserId);
	const [targetAnalytics, setTargetAnalytics] = useState<OwnerTargetActualSummary | null>(null);
	const [rankingSelectedYear, setRankingSelectedYear] = useState<number>(analytics?.selectedYear ?? selectedYear);
	const [rankingAnalytics, setRankingAnalytics] = useState<OwnerSalesRankingSummary | null>(null);
	const [focusPeriodMode, setFocusPeriodMode] = useState<"month" | "year">("month");
	const [focusSelectedYear, setFocusSelectedYear] = useState<number>(selectedYear);
	const [focusSelectedMonth, setFocusSelectedMonth] = useState<number>(new Date().getMonth() + 1);
	const [focusAnalytics, setFocusAnalytics] = useState<OwnerFocusSalesStoreSummary | null>(null);
	const [focusLoading, setFocusLoading] = useState(true);
	const [receivableAnalytics, setReceivableAnalytics] = useState<OwnerReceivablesSummary | null>(null);
	const [receivableLoading, setReceivableLoading] = useState(true);
	const [selectedStockStatus, setSelectedStockStatus] = useState<"AMAN" | "MENIPIS" | "HABIS" | null>(null);
	const [stockSearchTerm, setStockSearchTerm] = useState("");
	const [stockPage, setStockPage] = useState(1);
	const [selectedLifecycleFocus, setSelectedLifecycleFocus] = useState<LifecycleDetailFocus | null>(null);
	const [selectedLifecycleAnnualSalesId, setSelectedLifecycleAnnualSalesId] = useState<string | null>(null);
	const [selectedLifecycleAnnualCompareSalesId, setSelectedLifecycleAnnualCompareSalesId] = useState<string | null>(null);
	const [selectedLifecycleVerticalMode, setSelectedLifecycleVerticalMode] =
		useState<LifecycleVerticalMode>("compare_two_sales");
	const [selectedLifecycleVerticalMonth, setSelectedLifecycleVerticalMonth] = useState<number>(new Date().getMonth() + 1);
	const [selectedLifecycleYear, setSelectedLifecycleYear] = useState<number>(analytics?.selectedYear ?? selectedYear);
	const [lifecycleAnalytics, setLifecycleAnalytics] = useState<OwnerAnalyticsSummary | null>(null);
	const trendBaseAnalytics = trendAnalytics ?? analytics;
	const targetBaseAnalytics = targetAnalytics ?? analytics;
	const rankingBaseAnalytics = rankingAnalytics ?? analytics;
	const focusBaseAnalytics = focusAnalytics;
	const receivableBaseAnalytics = receivableAnalytics ?? analytics;
	const lifecycleBaseAnalytics =
		selectedLifecycleYear === (analytics?.selectedYear ?? selectedYear)
			? analytics
			: lifecycleAnalytics;
	const handleTrendYearChange = (year: number) => {
		setTrendLoading(true);
		setTrendAnalytics(null);
		setTrendSelectedYear(year);
	};
	const handleTrendMonthChange = (month: number | null) => {
		setTrendLoading(true);
		setTrendAnalytics(null);
		setTrendSelectedMonth(month);
	};
	const handleTargetYearChange = (year: number) => {
		setTargetAnalytics(null);
		setTargetSelectedYear(year);
	};
	const handleTargetSalesChange = (salesUserId: string | null) => {
		setTargetAnalytics(null);
		setTargetSelectedSalesUserId(salesUserId);
	};
	const handleRankingYearChange = (year: number) => {
		setRankingAnalytics(null);
		setRankingSelectedYear(year);
	};
	const handleStockStatusSelection = (label: string) => {
		const nextStatus = label === "Aman" ? "AMAN" : label === "Menipis" ? "MENIPIS" : label === "Habis" ? "HABIS" : null;
		if (!nextStatus) return;
		setSelectedStockStatus(nextStatus);
		setStockSearchTerm("");
		setStockPage(1);
	};

	useEffect(() => {
		let cancelled = false;
		dashboardService
			.getOwnerTrend({ year: trendSelectedYear, month: trendSelectedMonth ?? undefined })
			.then((result) => {
				if (cancelled) return;
				setTrendAnalytics(result);
			})
			.catch(() => {
				if (cancelled) return;
			})
			.finally(() => {
				if (!cancelled) setTrendLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [trendSelectedMonth, trendSelectedYear]);

	useEffect(() => {
		let cancelled = false;
		dashboardService
			.getOwnerTargetActual({
				year: targetSelectedYear,
				salesUserId: targetSelectedSalesUserId ?? undefined,
			})
			.then((result) => {
				if (cancelled) return;
				setTargetAnalytics(result);
			})
			.catch(() => {
				if (cancelled) return;
			})

		return () => {
			cancelled = true;
		};
	}, [targetSelectedSalesUserId, targetSelectedYear]);

	useEffect(() => {
		let cancelled = false;
		dashboardService
			.getOwnerSalesRanking({ year: rankingSelectedYear })
			.then((result) => {
				if (cancelled) return;
				setRankingAnalytics(result);
			})
			.catch(() => {
				if (cancelled) return;
			});

		return () => {
			cancelled = true;
		};
	}, [rankingSelectedYear]);

	useEffect(() => {
		let cancelled = false;

		dashboardService
			.getOwnerFocusSalesStore({
				year: focusSelectedYear,
				month: focusPeriodMode === "month" ? focusSelectedMonth : undefined,
			})
			.then((result) => {
				if (cancelled) return;
				setFocusAnalytics(result);
			})
			.catch(() => {
				if (cancelled) return;
			})
			.finally(() => {
				if (!cancelled) setFocusLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [focusPeriodMode, focusSelectedMonth, focusSelectedYear]);

	useEffect(() => {
		let cancelled = false;

		dashboardService
			.getOwnerReceivables()
			.then((result) => {
				if (cancelled) return;
				setReceivableAnalytics(result);
			})
			.catch(() => {
				if (cancelled) return;
			})
			.finally(() => {
				if (!cancelled) setReceivableLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!analytics) return;
		if (selectedLifecycleYear === (analytics.selectedYear ?? selectedYear)) {
			return;
		}

		let cancelled = false;
		dashboardService
			.getOwnerAnalytics({ year: selectedLifecycleYear, section: "details" })
			.then((result) => {
				if (cancelled) return;
				setLifecycleAnalytics(buildLifecycleSubset(result));
			})
			.catch(() => {
				if (cancelled) return;
			});

		return () => {
			cancelled = true;
		};
	}, [analytics, selectedLifecycleYear, selectedYear]);

	const topStoreItems = useMemo<CompetitionItem[]>(
		() =>
			(focusBaseAnalytics?.topStores ?? [])
				.filter((store) => topStoreSalesUserId === "all" || store.salesUserId === topStoreSalesUserId)
				.map((store) => ({
				id: store.storeId,
				label: store.storeName,
				subtitle:
					store.isActive === false
						? `Toko nonaktif • ${store.salesUserName}`
						: `Toko aktif • ${store.salesUserName}`,
				badge: verificationLabel[store.verificationStatus] ?? store.verificationStatus,
				values: {
					salesAmount: store.salesAmount,
					paidAmount: store.paidAmount,
					outstandingAmount: store.outstandingAmount,
				},
			})),
		[topStoreSalesUserId, focusBaseAnalytics],
	);

	const salesContributionItems = useMemo<CompetitionItem[]>(
		() =>
			(focusBaseAnalytics?.salesContribution ?? []).map((sales) => ({
				id: sales.salesUserId ?? sales.salesUserName,
				label: sales.salesUserName,
				subtitle: `${sales.storeCount.toLocaleString()} toko dikelola`,
				badge: `${formatPercent(sales.salesShare ?? 0)} kontribusi`,
				values: {
					salesAmount: sales.salesAmount,
					paidAmount: sales.paidAmount,
					outstandingAmount: sales.outstandingAmount,
				},
			})),
		[focusBaseAnalytics],
	);
	const selectedSalesContributionItem = useMemo(
		() => salesContributionItems.find((item) => item.id === topStoreSalesUserId) ?? null,
		[salesContributionItems, topStoreSalesUserId],
	);
	const handleSalesContributionSelection = (item: CompetitionItem) => {
		setTopStoreSalesUserId((current) => (current === item.id ? "all" : item.id));
	};
	const handleFocusPeriodModeChange = (mode: "month" | "year") => {
		if (mode === focusPeriodMode) return;
		setFocusLoading(true);
		setFocusAnalytics(null);
		setTopStoreSalesUserId("all");
		setFocusPeriodMode(mode);
	};
	const handleFocusYearChange = (year: number) => {
		if (year === focusSelectedYear) return;
		setFocusLoading(true);
		setFocusAnalytics(null);
		setTopStoreSalesUserId("all");
		setFocusSelectedYear(year);
	};
	const handleFocusMonthChange = (month: number) => {
		if (month === focusSelectedMonth) return;
		setFocusLoading(true);
		setFocusAnalytics(null);
		setTopStoreSalesUserId("all");
		setFocusSelectedMonth(month);
	};
	const focusMonthLabel = monthOptions.find((option) => option.value === focusSelectedMonth)?.label ?? `Bulan ${focusSelectedMonth}`;
	const focusPeriodLabel =
		focusPeriodMode === "month" ? `${focusMonthLabel} ${focusSelectedYear}` : `Tahun ${focusSelectedYear}`;
	const salesAndStoreFocusTitle = isAccountantVariant
		? "Pemantauan Omzet, Piutang, dan Pembayaran"
		: "Fokus Sales dan Toko Prioritas";
	const salesAndStoreFocusHelper = isAccountantVariant
		? "Pantau kontribusi omzet, piutang berjalan, dan pembayaran tercatat per sales lalu fokuskan toko yang perlu ditindaklanjuti."
		: "Periode awal memakai bulan berjalan. Gunakan mode tahunan saat ingin membaca konsentrasi dalam rentang lebih panjang.";
	const salesContributionTitle = "Konsentrasi Penjualan per Sales";
	const salesContributionHelper = isAccountantVariant
		? "Bandingkan omzet, pembayaran tercatat, dan piutang berjalan per sales untuk menentukan area koleksi yang paling perlu dipantau."
		: "Ukur apakah omzet, pembayaran invoice yang sudah dibayar toko lalu dicatat akuntan, dan tekanan piutang masih terlalu terkonsentrasi pada sedikit sales kunci.";
	const topStoreFocusTitle = "Toko Prioritas Pemantauan";
	const topStoreFocusHelper = isAccountantVariant
		? "Daftar toko otomatis mengikuti sales yang dipilih, sehingga akuntan bisa melihat toko dengan omzet, pembayaran, dan piutang terbesar dalam satu alur."
		: "Daftar toko otomatis mengikuti sales yang dipilih dari chart konsentrasi, sehingga prioritas omzet, pembayaran, dan piutang bisa dibaca sebagai satu alur.";

	const targetActualPoints = useMemo(
		() =>
			(targetBaseAnalytics?.targetVsActual ?? []).map((item) => ({
				label: item.periodLabel,
				actualAmount: item.actualAmount,
				targetAmount: item.targetAmount,
				achievementRate: item.achievementRate,
			})),
		[targetBaseAnalytics],
	);

	const salesRankingItems = useMemo(() => {
		if ((rankingBaseAnalytics?.salesMonthlyPerformance?.length ?? 0) > 0) {
			return (rankingBaseAnalytics?.salesMonthlyPerformance ?? []).map((item) => ({
				id: item.salesUserId,
				label: item.salesUserName,
				subtitle: `${item.storeCount.toLocaleString()} toko dikelola`,
				totalSalesAmount: item.totalSalesAmount,
				storeCount: item.storeCount,
				salesShare: item.salesShare,
				monthlySales: item.monthlySales,
			}));
		}

		return (rankingBaseAnalytics?.salesContribution ?? [])
			.filter((sales) => sales.salesUserId)
			.map((sales) => ({
			id: sales.salesUserId ?? sales.salesUserName,
			label: sales.salesUserName,
			subtitle: `${sales.storeCount.toLocaleString()} toko dikelola`,
			totalSalesAmount: sales.salesAmount,
			storeCount: sales.storeCount,
			salesShare: sales.salesShare,
			monthlySales: [],
		}));
	}, [rankingBaseAnalytics]);

	const salesFilterOptions = useMemo(
		() => {
			if ((targetBaseAnalytics?.salesCurrentMonthSnapshots?.length ?? 0) > 0) {
				return (targetBaseAnalytics?.salesCurrentMonthSnapshots ?? []).map((item) => ({
					id: item.salesUserId,
					label: item.salesUserName,
					helper: `${item.storeCount.toLocaleString()} toko dikelola`,
					targetAmount: item.targetAmount,
					actualAmount: item.actualAmount,
					achievementRate: item.achievementRate,
					monthLabel: `${item.monthLabel} ${item.year}`,
				}));
			}
			if ((targetBaseAnalytics?.salesMonthlyPerformance?.length ?? 0) > 0) {
				return (targetBaseAnalytics?.salesMonthlyPerformance ?? []).map((item) => ({
					id: item.salesUserId,
					label: item.salesUserName,
					helper: `${item.storeCount.toLocaleString()} toko dikelola`,
					targetAmount: null,
					actualAmount:
						item.monthlySales.find(
							(month) => month.monthNumber === (targetBaseAnalytics?.currentMonthNumber ?? new Date().getMonth() + 1)
						)?.salesAmount ?? 0,
					achievementRate: null,
					monthLabel: `${targetBaseAnalytics?.currentMonthLabel ?? "Bulan Ini"} ${targetBaseAnalytics?.currentYear ?? ""}`.trim(),
				}));
			}

			return (targetBaseAnalytics?.salesContribution ?? [])
				.filter((item) => item.salesUserId)
				.map((item) => ({
					id: item.salesUserId ?? item.salesUserName,
					label: item.salesUserName,
					helper: `${item.storeCount.toLocaleString()} toko dikelola`,
					targetAmount: null,
					actualAmount: 0,
					achievementRate: null,
					monthLabel: `${targetBaseAnalytics?.currentMonthLabel ?? "Bulan Ini"} ${targetBaseAnalytics?.currentYear ?? ""}`.trim(),
				}));
		},
		[targetBaseAnalytics],
	);

	const agingItems = useMemo(() => {
		const aging = receivableBaseAnalytics?.receivableComposition;
		return [
			{ label: "Lancar", amount: aging?.current.amount ?? 0, count: aging?.current.count ?? 0, color: "bg-emerald-500" },
			{ label: "1-30", amount: aging?.days1To30.amount ?? 0, count: aging?.days1To30.count ?? 0, color: "bg-amber-400" },
			{ label: "31-60", amount: aging?.days31To60.amount ?? 0, count: aging?.days31To60.count ?? 0, color: "bg-orange-500" },
			{ label: "61-90", amount: aging?.days61To90.amount ?? 0, count: aging?.days61To90.count ?? 0, color: "bg-rose-400" },
			{ label: ">90", amount: aging?.daysOver90.amount ?? 0, count: aging?.daysOver90.count ?? 0, color: "bg-slate-900" },
		];
	}, [receivableBaseAnalytics]);

	const categoryItems = useMemo(
		() =>
			(analytics?.categoryContribution ?? []).map((item) => ({
				id: item.categoryId ?? item.categoryName,
				label: item.categoryName,
				salesAmount: item.salesAmount,
				salesShare: item.salesShare,
			})),
		[analytics],
	);

	const brandItems = useMemo(
		() =>
			(analytics?.brandPerformance ?? []).map((item) => ({
				id: item.brandId ?? item.brandName,
				label: item.brandName,
				salesAmount: item.salesAmount,
				salesShare: item.salesShare,
				growthRate: item.growthRate,
			})),
		[analytics],
	);

	const channelMixItems = useMemo(
		() =>
			(analytics?.channelMix ?? []).map((item) => ({
				label: item.channelLabel,
				value: item.salesAmount,
				helper: `${formatPercent(item.salesShare)} dari omzet`,
				color:
					item.channelKey === "RETAILER"
						? "bg-sky-500"
						: item.channelKey === "WHOLESALER"
							? "bg-amber-500"
							: item.channelKey === "DISTRIBUTOR"
								? "bg-emerald-500"
								: "bg-slate-900",
			})),
		[analytics],
	);

	const salesStoreLifecycleItems = useMemo(
		() =>
			(lifecycleBaseAnalytics?.salesStoreLifecycleMonthly ?? []).map((item) => ({
				id: item.salesUserId ?? item.salesUserName,
				label: item.salesUserName,
				monthNumber: item.monthNumber,
				monthLabel: item.monthLabel,
				newStoreCount: item.newStoreCount,
				firstOrderStoreCount: item.firstOrderStoreCount,
				legacyStoreCount: item.legacyStoreCount,
				repeatOrderCount: item.repeatOrderCount,
			})),
		[lifecycleBaseAnalytics],
	);

	const lifecycleMonthOptions = useMemo(
		() =>
			Array.from(
				new Map(
					(lifecycleBaseAnalytics?.salesStoreLifecycleMonthly ?? []).map((item) => [
						item.monthNumber,
						{
							monthNumber: item.monthNumber,
							monthLabel: item.monthLabel,
						},
					]),
				).values(),
			).sort((left, right) => left.monthNumber - right.monthNumber),
		[lifecycleBaseAnalytics],
	);
	const lifecycleSalesOptions = useMemo(
		() =>
			Array.from(
				new Map(
					salesStoreLifecycleItems.map((item) => [
						item.id,
						{
							id: item.id,
							label: item.label,
						},
					]),
				).values(),
			).sort((left, right) => left.label.localeCompare(right.label)),
		[salesStoreLifecycleItems],
	);
	const resolvedLifecycleAnnualSalesId = selectedLifecycleAnnualSalesId ?? lifecycleSalesOptions[0]?.id ?? "";
	const resolvedLifecycleAnnualCompareSalesId =
		selectedLifecycleAnnualCompareSalesId ??
		lifecycleSalesOptions.find((option) => option.id !== resolvedLifecycleAnnualSalesId)?.id ??
		lifecycleSalesOptions[0]?.id ??
		"";

	const lifecycleStoreDetails = useMemo(
		() => lifecycleBaseAnalytics?.salesStoreLifecycleStoreDetails ?? [],
		[lifecycleBaseAnalytics?.salesStoreLifecycleStoreDetails],
	);

	const activeLifecycleDetail = useMemo(() => {
		if (!selectedLifecycleFocus) return null;

		const baseItems = lifecycleStoreDetails.filter((detail) => {
			if (detail.monthNumber !== selectedLifecycleFocus.monthNumber) return false;
			const matchesSales =
				selectedLifecycleFocus.salesUserId
					? detail.salesUserId === selectedLifecycleFocus.salesUserId
					: selectedLifecycleFocus.salesLabel === detail.salesUserName;
			if (!matchesSales) return false;
			return detail.isNewStore || detail.hasFirstOrder || detail.isLegacyStore || detail.hasRepeatOrder;
		});

		const monthLabel =
			lifecycleMonthOptions.find((option) => option.monthNumber === selectedLifecycleFocus.monthNumber)?.monthLabel ??
			`Bulan ${selectedLifecycleFocus.monthNumber}`;
		const summary = {
			tokoBaru: baseItems.filter((detail) => detail.isNewStore).length,
			transaksiPertama: baseItems.filter((detail) => detail.hasFirstOrder).length,
			belumTransaksiPertama: baseItems.filter((detail) => detail.missingFirstOrder).length,
			tokoLama: baseItems.filter((detail) => detail.isLegacyStore).length,
			repeatOrder: baseItems.filter((detail) => detail.hasRepeatOrder).length,
			belumRepeatOrder: baseItems.filter((detail) => detail.missingRepeatOrder).length,
		};

		const groupedItems = {
			tokoBaru: sortLifecycleItemsByAttention(
				baseItems.filter((detail) => detail.isNewStore),
				"missingFirstOrder",
			),
			transaksiPertama: sortLifecycleItemsByAttention(
				baseItems.filter((detail) => detail.hasFirstOrder),
				null,
			),
			tokoLama: sortLifecycleItemsByAttention(
				baseItems.filter((detail) => detail.isLegacyStore),
				"missingRepeatOrder",
			),
			repeatOrder: sortLifecycleItemsByAttention(
				baseItems.filter((detail) => detail.hasRepeatOrder),
				null,
			),
		};
		const sortedItems = [...baseItems].sort((left, right) => {
			const leftAttention = Number(Boolean(left.missingFirstOrder)) + Number(Boolean(left.missingRepeatOrder));
			const rightAttention = Number(Boolean(right.missingFirstOrder)) + Number(Boolean(right.missingRepeatOrder));
			return rightAttention - leftAttention || left.storeName.localeCompare(right.storeName);
		});

		return {
			title: `Detail Lifecycle - ${selectedLifecycleFocus.salesLabel}`,
			helper: `Semua kelompok lifecycle untuk ${selectedLifecycleFocus.salesLabel} pada ${monthLabel} dibuka sekaligus agar evaluasi lebih cepat.`,
			groups: groupedItems,
			items: sortedItems,
			summary,
			monthLabel,
			salesLabel: selectedLifecycleFocus.salesLabel,
		};
	}, [lifecycleMonthOptions, lifecycleStoreDetails, selectedLifecycleFocus]);

	const stockItems = useMemo(() => {
		const stock = analytics?.stockHealth;
		return [
			{ label: "Aman", value: stock?.healthySkus ?? 0, helper: "Stok masih nyaman", color: "bg-emerald-500" },
			{ label: "Menipis", value: stock?.lowStockSkus ?? 0, helper: `Ambang <= ${stock?.threshold ?? 10}`, color: "bg-amber-500" },
			{ label: "Habis", value: stock?.outOfStockSkus ?? 0, helper: "Perlu pengisian ulang", color: "bg-rose-500" },
		];
	}, [analytics]);

	const stockFocusItems = useMemo(
		() =>
			(analytics?.stockFocusItems ?? []).map((item) => ({
				id: item.productId,
				label: item.productName,
				value: item.quantity,
				stockStatus: item.stockStatus,
				helper:
					item.stockStatus === "HABIS"
						? "Stok habis, perlu pengadaan cepat"
						: item.stockStatus === "MENIPIS"
							? `Stok menipis, awasi ambang ${analytics?.stockHealth.threshold ?? 10} unit`
							: "Stok aman untuk menopang penjualan",
				color:
					item.stockStatus === "HABIS"
						? "bg-rose-500"
						: item.stockStatus === "MENIPIS"
							? "bg-amber-500"
							: "bg-emerald-500",
			})),
		[analytics],
	);
	const stockDetailItems = useMemo(
		() =>
			stockFocusItems
				.filter((item) => !selectedStockStatus || item.stockStatus === selectedStockStatus)
				.filter((item) => item.label.toLowerCase().includes(stockSearchTerm.trim().toLowerCase()))
				.sort((left, right) => left.value - right.value || left.label.localeCompare(right.label)),
		[selectedStockStatus, stockFocusItems, stockSearchTerm],
	);
	const stockPageSize = 10;
	const stockTotalPages = Math.max(1, Math.ceil(stockDetailItems.length / stockPageSize));
	const paginatedStockDetailItems = useMemo(
		() => stockDetailItems.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize),
		[stockDetailItems, stockPage],
	);
	const stockDetailPanel = selectedStockStatus ? (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h3 className="text-sm font-semibold text-slate-900">
						Detail Barang {selectedStockStatus === "AMAN" ? "Aman" : selectedStockStatus === "MENIPIS" ? "Menipis" : "Habis"}
					</h3>
					<p className="mt-1 text-xs text-slate-500">
						Daftar barang yang termasuk kelompok stok {selectedStockStatus === "AMAN" ? "aman" : selectedStockStatus === "MENIPIS" ? "menipis" : "habis"}.
					</p>
				</div>
				<button
					type="button"
					onClick={() => {
						setSelectedStockStatus(null);
						setStockSearchTerm("");
						setStockPage(1);
					}}
					className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
				>
					Tutup Detail
				</button>
			</div>
			<div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<input
					type="search"
					value={stockSearchTerm}
					onChange={(event) => {
						setStockSearchTerm(event.target.value);
						setStockPage(1);
					}}
					placeholder="Cari nama barang"
					className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 lg:max-w-sm"
				/>
				<div className="flex items-center gap-2 text-sm text-slate-600">
					<button
						type="button"
						onClick={() => setStockPage((current) => Math.max(1, current - 1))}
						disabled={stockPage <= 1}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Prev
					</button>
					<span>
						Halaman {stockPage} / {stockTotalPages}
					</span>
					<button
						type="button"
						onClick={() => setStockPage((current) => Math.min(stockTotalPages, current + 1))}
						disabled={stockPage >= stockTotalPages}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Next
					</button>
				</div>
			</div>
			<div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
				<div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid">
					<span>Produk</span>
					<span>Status</span>
					<span>Stok</span>
				</div>
				{paginatedStockDetailItems.length > 0 ? (
					<div className="divide-y divide-slate-100">
						{paginatedStockDetailItems.map((item) => {
							const statusLabel =
								item.stockStatus === "AMAN" ? "Aman" : item.stockStatus === "MENIPIS" ? "Menipis" : "Habis";
							const statusTone =
								item.stockStatus === "AMAN"
									? "bg-emerald-50 text-emerald-700"
									: item.stockStatus === "MENIPIS"
										? "bg-amber-50 text-amber-700"
										: "bg-rose-50 text-rose-700";
							return (
								<div key={item.id}>
									<div className="space-y-3 px-4 py-3 md:hidden">
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="font-medium text-slate-900">{item.label}</p>
												<p className="mt-1 text-xs text-slate-500">{statusLabel}</p>
											</div>
											<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>
												{item.value.toLocaleString("id-ID")} unit
											</span>
										</div>
									</div>
									<div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 px-4 py-3 text-sm text-slate-700 md:grid">
										<span className="font-medium text-slate-900">{item.label}</span>
										<span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>
											{statusLabel}
										</span>
										<span>{item.value.toLocaleString("id-ID")} unit</span>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="px-4 py-10 text-center text-sm text-slate-500">
						Tidak ada barang pada kelompok stok ini.
					</div>
				)}
			</div>
		</div>
	) : null;

	const executiveItems = useMemo<ExecutiveMetricItem[]>(() => {
		const summary = analytics?.executiveSummary;
		const portfolio = analytics?.storePortfolio;
		return [
			{
				label: "Omzet Tahun Berjalan",
				value: formatRupiah(summary?.totalSalesAmount ?? 0),
				helper: `${summary?.totalInvoices.toLocaleString() ?? "0"} invoice tercatat`,
				delta: summary?.monthlyGrowthRate,
			},
			{
				label: "Rasio Tertagih",
				value: formatPercent(summary?.collectionRate ?? 0),
				helper: `${formatRupiah(summary?.totalPaidAmount ?? 0)} sudah tertagih`,
				delta: summary?.paymentGrowthRate,
				tone: (summary?.collectionRate ?? 0) >= 0.8 ? "positive" : "warning",
			},
			{
				label: "Rasio Piutang",
				value: formatPercent(summary?.outstandingRatio ?? 0),
				helper: `${formatRupiah(summary?.totalOutstandingAmount ?? 0)} masih berjalan`,
				tone: (summary?.outstandingRatio ?? 0) >= 0.35 ? "danger" : "warning",
			},
			{
				label: "Kredit Jaringan",
				value: formatCompactRupiah(portfolio?.totalCreditLimit ?? 0),
				helper: `${portfolio?.verifiedStores ?? 0} toko terverifikasi aktif`,
			},
		];
	}, [analytics]);

	const hasDetails =
		topStoreItems.length > 0 ||
		salesRankingItems.length > 0 ||
		salesContributionItems.length > 0 ||
		categoryItems.length > 0 ||
		brandItems.length > 0 ||
		channelMixItems.length > 0 ||
		(receivableBaseAnalytics?.storePaymentDiscipline?.length ?? 0) > 0 ||
		salesStoreLifecycleItems.length > 0 ||
		stockFocusItems.length > 0;
	const showDetailsSkeleton = (loadingDetails || receivableLoading) && !hasDetails;
	const lifecycleDetailPanel = activeLifecycleDetail ? (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h3 className="text-sm font-semibold text-slate-900">{activeLifecycleDetail.title}</h3>
					<p className="mt-1 text-xs text-slate-500">{activeLifecycleDetail.helper}</p>
				</div>
				<button
					type="button"
					onClick={() => setSelectedLifecycleFocus(null)}
					className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
				>
					Tutup Detail
				</button>
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				<span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
					{activeLifecycleDetail.salesLabel}
				</span>
				<span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
					{activeLifecycleDetail.monthLabel}
				</span>
				<span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
					Fokus: Semua kelompok lifecycle
				</span>
			</div>
			<div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
				<div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
					<span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
						Toko Baru {activeLifecycleDetail.summary.tokoBaru}
					</span>
					<span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
						Transaksi Pertama {activeLifecycleDetail.summary.transaksiPertama}
					</span>
					<span className="inline-flex rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-medium text-fuchsia-700">
						Toko Lama {activeLifecycleDetail.summary.tokoLama}
					</span>
					<span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
						Repeat Order {activeLifecycleDetail.summary.repeatOrder}
					</span>
				</div>
				<div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] gap-3 border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid">
					<span>Toko</span>
					<span>Kelompok</span>
					<span>Bulan Daftar</span>
					<span>Transaksi Pertama</span>
					<span>Transaksi Terakhir</span>
					<span>Status</span>
				</div>
						{activeLifecycleDetail.items.length > 0 ? (
					<div className="divide-y divide-slate-100">
						{activeLifecycleDetail.items.map((detail) => {
							const primaryLifecycleGroup = detail.isNewStore
								? { label: "Toko Baru", tone: "bg-sky-50 text-sky-700 ring-sky-200" }
								: detail.isLegacyStore
									? { label: "Toko Lama", tone: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" }
									: null;
							const activeGroups = [primaryLifecycleGroup].filter(Boolean) as Array<{
								label: string;
								tone: string;
							}>;
							const statusLabel = detail.missingFirstOrder
								? "Belum Transaksi Pertama"
								: detail.missingRepeatOrder
									? "Belum Repeat Order"
									: detail.hasRepeatOrder
										? "Repeat Order Aktif"
										: detail.hasFirstOrder
											? "Transaksi Pertama Selesai"
											: "Perlu Dipantau";
							const statusTone = statusLabel.includes("Belum")
								? "bg-amber-50 text-amber-700"
								: statusLabel.includes("Repeat")
									? "bg-emerald-50 text-emerald-700"
									: "bg-sky-50 text-sky-700";
							return (
								<div key={`${detail.storeId}-${detail.monthNumber}`}>
									<div className="space-y-3 px-4 py-3 md:hidden">
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="font-medium text-slate-900">{detail.storeName}</p>
												<p className="mt-1 text-xs text-slate-500">{detail.salesUserName}</p>
											</div>
											<span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>
												{statusLabel}
											</span>
										</div>
										<div className="flex flex-wrap gap-2">
											{activeGroups.map((group) => (
												<span
													key={`${detail.storeId}-${group.label}`}
													className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${group.tone}`}
												>
													{group.label}
												</span>
											))}
										</div>
										<div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
											<div>
												<p className="uppercase tracking-[0.14em] text-slate-400">Bulan Daftar</p>
												<p className="mt-1 text-sm text-slate-700">{detail.verificationMonthLabel}</p>
											</div>
											<div>
												<p className="uppercase tracking-[0.14em] text-slate-400">Transaksi Pertama</p>
												<p className="mt-1 text-sm text-slate-700">{detail.firstOrderMonthLabel ?? "-"}</p>
											</div>
											<div>
												<p className="uppercase tracking-[0.14em] text-slate-400">Transaksi Terakhir</p>
												<p className="mt-1 text-sm text-slate-700">{detail.lastOrderMonthLabel ?? "-"}</p>
											</div>
											<div>
												<p className="uppercase tracking-[0.14em] text-slate-400">Aksi</p>
												<p className="mt-1 text-sm text-slate-700">
													{statusLabel.includes("Belum") ? "Perlu tindak lanjut" : "Sudah aman"}
												</p>
											</div>
										</div>
									</div>
										<div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] gap-3 px-4 py-3 text-sm text-slate-700 md:grid">
											<div>
												<p className="font-medium text-slate-900">{detail.storeName}</p>
												<p className="mt-1 text-xs text-slate-500">{detail.salesUserName}</p>
											</div>
											<div className="flex flex-wrap gap-2">
												{activeGroups.map((group) => (
													<span
														key={`${detail.storeId}-${group.label}-desktop`}
														className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${group.tone}`}
													>
														{group.label}
													</span>
												))}
											</div>
										<span>{detail.verificationMonthLabel}</span>
										<span>{detail.firstOrderMonthLabel ?? "-"}</span>
										<span>{detail.lastOrderMonthLabel ?? "-"}</span>
										<span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>
											{statusLabel}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="px-4 py-10 text-center text-sm text-slate-500">
						Tidak ada toko yang cocok untuk detail ini pada {activeLifecycleDetail.monthLabel}.
					</div>
				)}
			</div>
		</div>
	) : null;
	const salesAndStoreFocusSection = (
		<section>
			<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
					<div className="min-w-0">
						<h2 className="text-base font-semibold text-slate-900">{salesAndStoreFocusTitle}</h2>
						<p className="mt-1 text-sm text-slate-500">
							{salesAndStoreFocusHelper}
						</p>
					</div>
					<div className="grid grid-cols-[auto_auto_auto] items-center gap-2 max-sm:grid-cols-1">
						<select
							value={focusSelectedYear}
							onChange={(event) => handleFocusYearChange(Number(event.target.value))}
							className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
						>
							{(analytics?.availableYears ?? [selectedYear]).map((year) => (
								<option key={year} value={year}>
									{year}
								</option>
							))}
						</select>
						{focusPeriodMode === "month" ? (
							<select
								value={focusSelectedMonth}
								onChange={(event) => handleFocusMonthChange(Number(event.target.value))}
								className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								{monthOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						) : null}
						<div className="inline-flex whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 p-1">
							<button
								type="button"
								onClick={() => handleFocusPeriodModeChange("month")}
								className={`rounded-md px-3 py-1.5 text-sm ${
									focusPeriodMode === "month" ? "bg-slate-900 text-white" : "text-slate-600"
								}`}
							>
								Bulanan
							</button>
							<button
								type="button"
								onClick={() => handleFocusPeriodModeChange("year")}
								className={`rounded-md px-3 py-1.5 text-sm ${
									focusPeriodMode === "year" ? "bg-slate-900 text-white" : "text-slate-600"
								}`}
							>
								Tahunan
							</button>
						</div>
						{selectedSalesContributionItem ? (
							<button
								type="button"
								onClick={() => setTopStoreSalesUserId("all")}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
							>
								Reset Fokus
							</button>
						) : null}
					</div>
				</div>
				{focusLoading && !focusBaseAnalytics ? (
					<div className="mt-5 grid gap-4">
						<div className="h-[360px] rounded-xl border border-dashed border-slate-200 bg-slate-50" />
						<div className="h-[420px] rounded-xl border border-dashed border-slate-200 bg-slate-50" />
					</div>
				) : (
				<div className="mt-5 space-y-6">
					<MultiMetricCompetitionCard
						embedded
						className="h-full"
						title={salesContributionTitle}
						helper={salesContributionHelper}
						items={salesContributionItems}
						metrics={competitionMetrics}
						defaultSortKey="salesAmount"
						maxItems={10}
						paginationPageSize={10}
						paginationItemLabel="sales"
						footer={`Tiga sales teratas membawa ${formatPercent(focusBaseAnalytics?.executiveSummary?.salesShareByTopSales ?? 0)} dari omzet periode ${focusPeriodLabel}.`}
						valueFormatter={(value) => formatRupiah(value)}
						onItemClick={handleSalesContributionSelection}
						selectedItemId={selectedSalesContributionItem?.id}
						chartHeight={360}
						orientation="vertical"
						barGap="6%"
						barCategoryGap="8%"
					/>
					<MultiMetricCompetitionCard
						key={`top-stores-${topStoreSalesUserId}`}
						embedded
						className="h-full border-t border-slate-200 pt-5"
						title={topStoreFocusTitle}
						helper={topStoreFocusHelper}
						items={topStoreItems}
						metrics={competitionMetrics}
						defaultSortKey="salesAmount"
						maxItems={10}
						paginationPageSize={10}
						paginationItemLabel="toko"
						chartHeight={420}
						orientation="vertical"
						wrapCategoryLabels
						footer={`Toko teratas menyumbang ${formatPercent(focusBaseAnalytics?.executiveSummary?.salesShareByTopStores ?? 0)} dari omzet periode ${focusPeriodLabel}.`}
						valueFormatter={(value) => formatRupiah(value)}
					/>
				</div>
				)}
			</div>
		</section>
	);

	return (
		<FeaturePage title={title} description={description} actions={actions}>
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{showOverviewSkeleton ? <DashboardMetricStripSkeleton /> : <ExecutiveMetricsStrip items={executiveItems} />}

			{showOverviewSkeleton ? (
				<DashboardCardSkeleton chartHeight={340} lineCount={2} footerWidth="w-72" />
			) : (
					<section>
						<SalesTrendCard
							analytics={trendBaseAnalytics}
							loading={loadingOverview || trendLoading}
							selectedYear={trendSelectedYear}
							onSelectedYearChange={handleTrendYearChange}
							selectedMonth={trendSelectedMonth}
							onSelectedMonthChange={handleTrendMonthChange}
						/>
					</section>
			)}

			{showDetailsSkeleton ? (
				<>
					<DashboardSectionGridSkeleton columnsClassName="xl:grid-cols-2">
						<DashboardCardSkeleton chartHeight={320} lineCount={2} />
						<DashboardCardSkeleton chartHeight={320} lineCount={2} />
					</DashboardSectionGridSkeleton>
					<DashboardSectionGridSkeleton columnsClassName="xl:grid-cols-[1.08fr_0.92fr]">
						<DashboardCardSkeleton chartHeight={360} lineCount={2} />
						<div className="space-y-4">
							<DashboardCardSkeleton chartHeight={150} lineCount={2} />
							<DashboardCardSkeleton chartHeight={180} lineCount={2} />
						</div>
					</DashboardSectionGridSkeleton>
					<DashboardSectionGridSkeleton columnsClassName="xl:grid-cols-2">
						<DashboardCardSkeleton chartHeight={320} lineCount={2} />
						<DashboardCardSkeleton chartHeight={320} lineCount={2} />
					</DashboardSectionGridSkeleton>
					<DashboardSectionGridSkeleton columnsClassName="xl:grid-cols-[0.96fr_1.04fr]">
						<DashboardCardSkeleton chartHeight={300} lineCount={2} />
						<DashboardCardSkeleton chartHeight={340} lineCount={2} />
					</DashboardSectionGridSkeleton>
				</>
			) : (
				<>
					{!isAccountantVariant ? (
						<>
							<section>
								<SalesRankingChartCard
									className="h-full"
									title="Performa Sales Tahunan"
									helper="Baca perubahan peringkat sales sepanjang bulan-bulan dalam tahun aktif, lalu arahkan kursor ke titik mana pun untuk melihat detail performanya."
									items={salesRankingItems}
									selectedYear={rankingSelectedYear}
									availableYears={rankingBaseAnalytics?.availableYears ?? [rankingSelectedYear]}
									onSelectedYearChange={handleRankingYearChange}
									footer={`Kontribusi tiga sales teratas saat ini ${formatPercent(rankingBaseAnalytics?.executiveSummary?.salesShareByTopSales ?? 0)} dari omzet tahun berjalan.`}
									onPointClick={undefined}
								/>
							</section>

							<section>
								<ExecutiveTargetActualChartCard
									className="h-full"
									title="Target vs Realisasi Sales"
									helper="Pilih sales terlebih dahulu untuk melihat apakah omzet bulanannya memenuhi target sepanjang tahun aktif."
									monthlyPoints={targetActualPoints}
									selectedYear={targetSelectedYear}
									availableYears={targetBaseAnalytics?.availableYears ?? [targetSelectedYear]}
									onSelectedYearChange={handleTargetYearChange}
									salesOptions={salesFilterOptions}
									selectedSalesUserId={targetSelectedSalesUserId}
									onSelectedSalesUserIdChange={handleTargetSalesChange}
									footer={`Periode aktif mengikuti tahun ${targetSelectedYear}.`}
									onPointClick={(item) => {
										const params = new URLSearchParams({
											year: String(targetSelectedYear),
											period: item.label,
										});
										if (targetSelectedSalesUserId) {
											params.set("salesUserId", targetSelectedSalesUserId);
										}
										router.push(`/akuntan/dashboard-penjualan?${params.toString()}`);
									}}
								/>
							</section>

							<section>
								<SalesStoreLifecycleYearlyChartCard
									title="Lifecycle Toko per Sales"
									helper="Bandingkan dua sales dalam siklus 1 tahun penuh, atau lihat semua sales pada satu bulan tertentu tanpa memengaruhi card dashboard lain."
									items={salesStoreLifecycleItems}
									salesOptions={lifecycleSalesOptions}
									mode={selectedLifecycleVerticalMode}
									selectedYear={selectedLifecycleYear}
									availableYears={lifecycleBaseAnalytics?.availableYears ?? [selectedLifecycleYear]}
									selectedPrimarySalesUserId={resolvedLifecycleAnnualSalesId}
									selectedSecondarySalesUserId={resolvedLifecycleAnnualCompareSalesId}
									selectedMonth={selectedLifecycleVerticalMonth}
									onSelectedYearChange={(year) => {
										setSelectedLifecycleYear(year);
										setSelectedLifecycleFocus(null);
									}}
									onModeChange={(mode) => {
										setSelectedLifecycleVerticalMode(mode);
										setSelectedLifecycleFocus(null);
									}}
									onSelectedPrimarySalesUserIdChange={(salesUserId) => {
										setSelectedLifecycleAnnualSalesId(salesUserId);
										setSelectedLifecycleFocus(null);
									}}
									onSelectedSecondarySalesUserIdChange={(salesUserId) => {
										setSelectedLifecycleAnnualCompareSalesId(salesUserId);
										setSelectedLifecycleFocus(null);
									}}
									onSelectedMonthChange={(month) => {
										setSelectedLifecycleVerticalMonth(month);
										setSelectedLifecycleFocus(null);
									}}
									detailPanel={lifecycleDetailPanel}
									onChartPointClick={(payload) =>
										setSelectedLifecycleFocus({
											salesUserId: payload.salesUserId,
											salesLabel: payload.salesLabel,
											monthNumber: payload.monthNumber,
										})
									}
								/>
							</section>
						</>
					) : null}

					{isAccountantVariant ? (
						<>
							{salesAndStoreFocusSection}

							<ReceivableMonitoringSection
								agingItems={agingItems}
								storePaymentDiscipline={receivableBaseAnalytics?.storePaymentDiscipline ?? []}
							/>
						</>
					) : isOwnerVariant ? (
						<>
							{salesAndStoreFocusSection}

							<section className="grid items-start gap-4 xl:grid-cols-[0.96fr_1.04fr]">
								<CategoryTreemapCard
									className="h-full"
									title="Kontribusi Kategori Produk"
									helper="Treemap dipakai agar owner/admin cepat melihat kategori mana yang benar-benar mendominasi omzet, bukan sekadar melihat daftar nama produk."
									items={categoryItems}
									footer="Kontribusi kategori dihitung dari item invoice aktif pada tahun analytics yang sedang dibaca."
									onPointClick={(item) => {
										const params = new URLSearchParams({ search: item.label });
										router.push(`/owner/master-data/categories?${params.toString()}`);
									}}
								/>
								<BrandPerformanceHeatmapCard
									className="h-full"
									title="Performa Brand"
									helper="Bandingkan kontribusi omzet brand sambil tetap membaca arah pertumbuhannya agar dominasi lama dan momentum baru sama-sama terlihat."
									items={brandItems}
									footer="Pertumbuhan brand dibandingkan terhadap periode tahunan sebelumnya untuk brand yang sama."
									onPointClick={(item) => {
										const params = new URLSearchParams({ search: item.label });
										router.push(`/owner/master-data/brands?${params.toString()}`);
									}}
								/>
							</section>

							<ReceivableMonitoringSection
								agingItems={agingItems}
								storePaymentDiscipline={receivableBaseAnalytics?.storePaymentDiscipline ?? []}
							/>

							<section>
								<PortfolioStackCard
									title="Tekanan Inventaris"
									helper="Baca komposisi aman, menipis, dan habis dalam bentuk persentase, lalu klik status tertentu untuk melihat daftar barangnya."
									items={stockItems}
									variant="band"
									valueFormatter={(value) => `${value.toLocaleString("id-ID")} SKU`}
									footer={`Ambang stok menipis saat ini ${analytics?.stockHealth.threshold ?? 10} unit.`}
									onPointClick={handleStockStatusSelection}
									detailPanel={stockDetailPanel}
								/>
							</section>
						</>
					) : (
						<>
							<section className="grid items-start gap-4 xl:grid-cols-[1.06fr_0.94fr]">
								<div className="flex h-full flex-col gap-4">
									<PortfolioStackCard
										title="Komposisi Kanal"
										helper="Lihat distribusi omzet menurut tipe toko agar owner/admin tahu apakah pertumbuhan datang dari retail, grosir, atau distributor."
										items={channelMixItems}
										variant="donut"
										valueFormatter={formatRupiah}
										className="flex-1"
									/>
									<div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
										<h2 className="text-base font-semibold text-slate-900">Catatan Eksekutif</h2>
										<p className="mt-1 text-sm text-slate-500">
											Bacaan singkat untuk membaca dominasi omzet, konsentrasi sales, dan tekanan kas tanpa membuka laporan tambahan.
										</p>
										<div className="mt-5 grid flex-1 gap-3">
											<div className="rounded-xl border border-slate-200 p-4">
												<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Dominasi Toko</p>
												<p className="mt-2 text-2xl font-semibold text-slate-900">
													{formatPercent(analytics?.executiveSummary?.salesShareByTopStores ?? 0)}
												</p>
												<p className="mt-1 text-sm text-slate-500">Kontribusi top 8 toko terhadap omzet.</p>
											</div>
											<div className="rounded-xl border border-slate-200 p-4">
												<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Dominasi Sales</p>
												<p className="mt-2 text-2xl font-semibold text-slate-900">
													{formatPercent(analytics?.executiveSummary?.salesShareByTopSales ?? 0)}
												</p>
												<p className="mt-1 text-sm text-slate-500">Kontribusi tiga sales teratas terhadap omzet.</p>
											</div>
											<div className="rounded-xl border border-slate-200 p-4">
												<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Piutang Berjalan</p>
												<p className="mt-2 text-2xl font-semibold text-amber-600">
													{formatRupiah(analytics?.executiveSummary?.totalOutstandingAmount ?? 0)}
												</p>
												<p className="mt-1 text-sm text-slate-500">Nominal yang masih harus dikonversi menjadi kas.</p>
											</div>
										</div>
									</div>
								</div>
							</section>

							{salesAndStoreFocusSection}

							<section className="grid items-start gap-4 xl:grid-cols-[0.96fr_1.04fr]">
								<CategoryTreemapCard
									className="h-full"
									title="Kontribusi Kategori Produk"
									helper="Treemap dipakai agar owner/admin cepat melihat kategori mana yang benar-benar mendominasi omzet, bukan sekadar melihat daftar nama produk."
									items={categoryItems}
									footer="Kontribusi kategori dihitung dari item invoice aktif pada tahun analytics yang sedang dibaca."
									onPointClick={(item) => {
										const params = new URLSearchParams({ search: item.label });
										router.push(`/owner/master-data/categories?${params.toString()}`);
									}}
								/>
								<BrandPerformanceHeatmapCard
									className="h-full"
									title="Performa Brand"
									helper="Bandingkan kontribusi omzet brand sambil tetap membaca arah pertumbuhannya agar dominasi lama dan momentum baru sama-sama terlihat."
									items={brandItems}
									footer="Pertumbuhan brand dibandingkan terhadap periode tahunan sebelumnya untuk brand yang sama."
									onPointClick={(item) => {
										const params = new URLSearchParams({ search: item.label });
										router.push(`/owner/master-data/brands?${params.toString()}`);
									}}
								/>
							</section>

							<ReceivableMonitoringSection
								agingItems={agingItems}
								storePaymentDiscipline={receivableBaseAnalytics?.storePaymentDiscipline ?? []}
							/>

							<section className="grid items-start gap-4 xl:grid-cols-[1.12fr_0.88fr]">
								<div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
									<h2 className="text-base font-semibold text-slate-900">Daftar Pantauan Strategis</h2>
									<p className="mt-1 text-sm text-slate-500">
										Jadikan area ini sebagai pengingat apakah fokus berikutnya sebaiknya pindah ke koleksi, distribusi sales, atau kesiapan stok.
									</p>
									<div className="mt-5 grid flex-1 gap-3">
										<div className="rounded-xl border border-slate-200 p-4">
											<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Prioritas Kas</p>
											<p className="mt-2 text-sm text-slate-700">
												Jika rasio piutang dan umur piutang sama-sama naik, fokus tindak lanjut harus bergeser ke penagihan aktif dan kontrol limit kredit.
											</p>
										</div>
										<div className="rounded-xl border border-slate-200 p-4">
											<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Prioritas Pasokan</p>
											<p className="mt-2 text-sm text-slate-700">
												Jika omzet masih tumbuh tetapi SKU menipis ikut naik, tekanan berikutnya ada di pengisian ulang dan disiplin stok gudang.
											</p>
										</div>
										<div className="rounded-xl border border-slate-200 p-4">
											<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Prioritas Jaringan</p>
											<p className="mt-2 text-sm text-slate-700">
												Jika kontribusi terlalu terkonsentrasi pada sedikit toko atau sales, pertumbuhan masih rapuh dan perlu distribusi portofolio yang lebih sehat.
											</p>
										</div>
									</div>
								</div>

								{operationalDetailLoading ?? operationalDetail ?? <DashboardCardSkeleton chartHeight={220} lineCount={2} />}
							</section>
						</>
					)}
				</>
			)}
		</FeaturePage>
	);
}
