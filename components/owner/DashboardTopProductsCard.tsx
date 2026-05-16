"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import { productService, type Product } from "@/services/product";

export default function DashboardTopProductsCard() {
	const [items, setItems] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const result = await productService.getAll(1, 5);
					if (cancelled) return;
					setItems(result.data ?? []);
				} catch (loadError: unknown) {
					if (cancelled) return;
					setError(getApiErrorMessage(loadError, "Gagal memuat produk teratas."));
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
	}, []);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-sm font-semibold text-slate-800">Top products</p>
			<div className="mt-3">
				{loading ? (
					<p className="text-xs text-slate-500">Loading...</p>
				) : (
					<ul className="space-y-2">
						{error ? <li className="text-xs text-rose-600">{error}</li> : null}
						{items.length === 0 ? (
							<li className="text-xs text-slate-500">No product data</li>
						) : null}
						{items.map((product) => (
							<li key={product.id} className="flex items-center justify-between">
								<span className="text-sm text-slate-700">{product.name}</span>
								<span className="text-xs text-slate-500">{product.sku ?? ""}</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
