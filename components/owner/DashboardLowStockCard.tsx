"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import { dashboardService, type StockSummary } from "@/services/dashboard";

export default function DashboardLowStockCard({ threshold = 10 }: { threshold?: number }) {
	const [data, setData] = useState<StockSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const result = await dashboardService.getStocks(threshold);
					if (cancelled) return;
					setData(result);
				} catch (loadError: unknown) {
					if (cancelled) return;
					setError(getApiErrorMessage(loadError, "Gagal memuat stok minimum."));
				} finally {
					if (!cancelled) {
						setLoading(false);
					}
				}
			})();
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [threshold]);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-sm font-semibold text-slate-800">Low stock</p>
			<div className="mt-3 flex items-center justify-between">
				<div>
					<p className="text-2xl font-bold text-rose-600">
						{loading ? "-" : data ? data.lowStockCount : "-"}
					</p>
					<p className="text-xs text-slate-500">Items under threshold ({threshold})</p>
					{error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
				</div>
				<button className="rounded-md bg-indigo-600 px-3 py-1 text-xs text-white">View stock</button>
			</div>
		</div>
	);
}
