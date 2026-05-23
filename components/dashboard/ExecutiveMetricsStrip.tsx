"use client";

import { formatSignedPercent } from "@/components/dashboard/chart-utils";

export type ExecutiveMetricTone = "default" | "positive" | "warning" | "danger";

export interface ExecutiveMetricItem {
	label: string;
	value: string;
	helper: string;
	delta?: number;
	tone?: ExecutiveMetricTone;
}

const toneStyles: Record<ExecutiveMetricTone, string> = {
	default: "text-slate-900",
	positive: "text-emerald-600",
	warning: "text-amber-600",
	danger: "text-rose-600",
};

export default function ExecutiveMetricsStrip({
	items,
}: {
	items: ExecutiveMetricItem[];
}) {
	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{items.map((item) => (
				<div
					key={item.label}
					className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
				>
					<div className="flex items-start justify-between gap-3">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						{typeof item.delta === "number" ? (
							<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
								{formatSignedPercent(item.delta)}
							</span>
						) : null}
					</div>
					<p className={`mt-3 text-2xl font-semibold ${toneStyles[item.tone ?? "default"]}`}>
						{item.value}
					</p>
					<p className="mt-2 text-sm text-slate-500">{item.helper}</p>
				</div>
			))}
		</section>
	);
}
