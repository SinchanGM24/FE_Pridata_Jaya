"use client";

import { FeaturePage } from "@/components/shared/FeaturePage";
import { MonthlyReportsPanel } from "@/components/reports/MonthlyReportsPanel";

export default function MonthlyReportsPage() {
	return (
		<FeaturePage title="Laporan Bulanan" description="Kelola jadwal laporan bulanan dan delivery logs.">
			<MonthlyReportsPanel />
		</FeaturePage>
	);
}
