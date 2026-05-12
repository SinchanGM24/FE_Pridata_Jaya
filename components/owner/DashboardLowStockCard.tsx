"use client";

import { useEffect, useState } from 'react';
import { dashboardService } from '@/services/dashboard';

export default function DashboardLowStockCard({ threshold = 10 }: { threshold?: number }) {
	const [data, setData] = useState<any | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		dashboardService
			.getStocks(threshold)
			.then((res) => {
				if (!mounted) return;
				setData(res);
			})
			.finally(() => mounted && setLoading(false));
		return () => {
			mounted = false;
		};
	}, [threshold]);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-sm font-semibold text-slate-800">Low stock</p>
			<div className="mt-3 flex items-center justify-between">
				<div>
					<p className="text-2xl font-bold text-rose-600">{loading ? '—' : data ? data.lowStockCount : '—'}</p>
					<p className="text-xs text-slate-500">Items under threshold ({threshold})</p>
				</div>
				<button className="rounded-md bg-indigo-600 px-3 py-1 text-xs text-white">View stock</button>
			</div>
		</div>
	);
}
