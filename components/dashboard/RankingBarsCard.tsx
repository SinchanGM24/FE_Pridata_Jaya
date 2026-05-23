"use client";

import { useMemo, useState } from "react";

export interface RankingMetricOption {
	key: string;
	label: string;
}

export interface RankingBarsItem {
	id: string;
	label: string;
	subtitle?: string;
	badge?: string;
	values: Record<string, number>;
}

export default function RankingBarsCard({
	title,
	helper,
	items,
	metricOptions,
	defaultMetricKey,
	valueFormatter,
}: {
	title: string;
	helper: string;
	items: RankingBarsItem[];
	metricOptions: RankingMetricOption[];
	defaultMetricKey: string;
	valueFormatter: (value: number, metricKey: string) => string;
}) {
	const [metricKey, setMetricKey] = useState(defaultMetricKey);

	const sortedItems = useMemo(() => {
		return [...items].sort((left, right) => (right.values[metricKey] ?? 0) - (left.values[metricKey] ?? 0));
	}, [items, metricKey]);

	const maxValue = Math.max(1, ...sortedItems.map((item) => item.values[metricKey] ?? 0));

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="mt-1 text-sm text-slate-500">{helper}</p>
				</div>

				<div className="inline-flex rounded-xl bg-slate-100 p-1">
					{metricOptions.map((option) => (
						<button
							key={option.key}
							type="button"
							onClick={() => setMetricKey(option.key)}
							className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
								metricKey === option.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			<div className="mt-5 space-y-4">
				{sortedItems.length === 0 ? (
					<div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
						Belum ada data untuk ditampilkan.
					</div>
				) : (
					sortedItems.map((item) => {
						const value = item.values[metricKey] ?? 0;
						const width = (value / maxValue) * 100;

						return (
							<div key={item.id}>
								<div className="mb-2 flex items-start justify-between gap-4">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<p className="truncate text-sm font-medium text-slate-900">{item.label}</p>
											{item.badge ? (
												<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
													{item.badge}
												</span>
											) : null}
										</div>
										{item.subtitle ? <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p> : null}
									</div>
									<p className="text-sm font-semibold text-slate-900">{valueFormatter(value, metricKey)}</p>
								</div>
								<div className="h-3 rounded-full bg-slate-100">
									<div
										className="h-3 rounded-full bg-slate-900"
										style={{ width: `${Math.max(width, value > 0 ? 8 : 0)}%` }}
									/>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
