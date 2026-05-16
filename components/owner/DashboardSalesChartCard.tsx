"use client";

interface Props {
	series?: Array<{ x: string; y: number }>;
}

const fallbackSeries = [
	{ x: "D1", y: 180 },
	{ x: "D2", y: 260 },
	{ x: "D3", y: 220 },
	{ x: "D4", y: 310 },
	{ x: "D5", y: 280 },
	{ x: "D6", y: 360 },
	{ x: "D7", y: 240 },
];

export default function DashboardSalesChartCard({ series }: Props) {
	const data = series ?? fallbackSeries;
	const max = Math.max(...data.map((point) => point.y), 1);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="flex items-center justify-between">
				<p className="text-sm font-semibold text-slate-800">Sales (recent)</p>
				<p className="text-xs text-slate-500">Last 7</p>
			</div>
			<div className="mt-4 h-28 w-full">
				<svg viewBox={`0 0 ${data.length * 20} 100`} className="h-full w-full">
					{data.map((point, index) => {
						const height = (point.y / max) * 80;
						return (
							<rect
								key={point.x}
								x={index * 20 + 4}
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
