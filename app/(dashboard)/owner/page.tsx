"use client";

import { useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboard";
import DashboardMetricsCards from "@/components/owner/DashboardMetricsCards";
import DashboardSalesChartCard from "@/components/owner/DashboardSalesChartCard";
import DashboardTopProductsCard from "@/components/owner/DashboardTopProductsCard";
import DashboardLowStockCard from "@/components/owner/DashboardLowStockCard";
import DashboardQuickActions from "@/components/owner/DashboardQuickActions";
import type { OverallSummary } from "@/services/dashboard";

export default function OwnerDashboard() {
	const [summary, setSummary] = useState<OverallSummary | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;
		dashboardService
			.getSummary()
			.then((res) => {
				if (!mounted) return;
				setSummary(res);
			})
			.finally(() => mounted && setLoading(false));
		return () => {
			mounted = false;
		};
	}, []);

	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900 mb-6">Owner Dashboard</h1>

			<DashboardMetricsCards summary={summary} />

			<div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2 space-y-4">
					<DashboardSalesChartCard />
					<DashboardTopProductsCard />
				</div>
				<div className="space-y-4">
					<DashboardLowStockCard threshold={10} />
					<DashboardQuickActions />
				</div>
			</div>
		</div>
	);
}
