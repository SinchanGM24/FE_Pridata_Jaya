"use client";

export function resolveChartColor(color: string) {
	const palette: Record<string, string> = {
		"bg-slate-900": "#0f172a",
		"bg-slate-800": "#1e293b",
		"bg-slate-700": "#334155",
		"bg-emerald-500": "#10b981",
		"bg-emerald-400": "#34d399",
		"bg-amber-500": "#f59e0b",
		"bg-amber-400": "#fbbf24",
		"bg-orange-500": "#f97316",
		"bg-rose-500": "#f43f5e",
		"bg-rose-400": "#fb7185",
		"bg-sky-500": "#0ea5e9",
		"bg-sky-400": "#38bdf8",
		"bg-indigo-600": "#4f46e5",
		"bg-indigo-500": "#6366f1",
	};

	return palette[color] ?? color;
}

export function withAlpha(color: string, alpha: number) {
	const hex = resolveChartColor(color).replace("#", "");
	if (hex.length !== 6) return resolveChartColor(color);

	const value = Math.max(0, Math.min(255, Math.round(alpha * 255)))
		.toString(16)
		.padStart(2, "0");

	return `#${hex}${value}`;
}

// Formatter kanonik pindah ke lib/format.ts; di-re-export agar pemakai lama tetap jalan.
export {
	formatRupiah,
	formatCompactRupiah,
	formatPercent,
	formatPercentage,
	formatSignedPercent,
	formatSignedPercentage,
} from "@/lib/format";
