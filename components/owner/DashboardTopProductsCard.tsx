"use client";

import { useEffect, useState } from 'react';
import { productService } from '@/services/product';

export default function DashboardTopProductsCard() {
	const [items, setItems] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		productService
			.getAll(1, 5)
			.then((res) => {
				if (!mounted) return;
				setItems(res.data ?? []);
			})
			.finally(() => mounted && setLoading(false));
		return () => {
			mounted = false;
		};
	}, []);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-sm font-semibold text-slate-800">Top products</p>
			<div className="mt-3">
				{loading ? (
					<p className="text-xs text-slate-500">Loading...</p>
				) : (
					<ul className="space-y-2">
						{items.length === 0 && <li className="text-xs text-slate-500">No product data</li>}
						{items.map((p) => (
							<li key={p.id} className="flex items-center justify-between">
								<span className="text-sm text-slate-700">{p.name}</span>
								<span className="text-xs text-slate-500">{p.sku ?? ''}</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
