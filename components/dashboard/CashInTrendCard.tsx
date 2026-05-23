"use client";

import { useMemo } from "react";
import TrendComparisonCard from "@/components/dashboard/TrendComparisonCard";

export interface CashInTrendPoint {
	periodLabel: string;
	billedAmount: number;
	collectedAmount: number;
	paymentCount: number;
}

export default function CashInTrendCard({
	title,
	helper,
	data,
	embedded = false,
}: {
	title: string;
	helper: string;
	data: CashInTrendPoint[];
	embedded?: boolean;
}) {
	const chartData = useMemo(
		() =>
			data.map((item) => ({
				label: item.periodLabel,
				billedAmount: item.billedAmount,
				collectedAmount: item.collectedAmount,
				paymentCount: item.paymentCount,
			})),
		[data],
	);

	return (
		<TrendComparisonCard
			title={title}
			helper={helper}
			data={chartData}
			primaryLabel="Tagihan Harian"
			secondaryLabel="Kas Masuk"
			primaryKey="billedAmount"
			secondaryKey="collectedAmount"
			embedded={embedded}
		/>
	);
}
