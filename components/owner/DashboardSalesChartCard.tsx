"use client";

interface Props {
	series?: Array<{ x: string; y: number }>;
}

export default function DashboardSalesChartCard({ series }: Props) {
	// lightweight placeholder chart using SVG
	const data = series ?? Array.from({ length: 7 }).map((_, i) => ({ x: `D${i + 1}`, y: Math.floor(Math.random() * 1000) }));
	const max = Math.max(...data.map((d) => d.y), 1);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="flex items-center justify-between">
				<p className="text-sm font-semibold text-slate-800">Sales (recent)</p>
				<p className="text-xs text-slate-500">Last 7</p>
			</div>
			<div className="mt-4 h-28 w-full">
				<svg viewBox={`0 0 ${data.length * 20} 100`} className="h-full w-full">
					{data.map((d, idx) => {
						const height = (d.y / max) * 80;
						return (
							<rect
								key={idx}
								x={idx * 20 + 4}
								y={100 - height}
								width={12}
								height={height}
								fill="#4f46e5"
							/>
						);
					})}
				</svg>
			</div>
		</div>
	);
}
