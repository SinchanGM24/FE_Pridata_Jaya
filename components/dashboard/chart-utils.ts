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

export const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export const formatCompactRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 1,
		notation: "compact",
	}).format(value);

export const formatPercent = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "percent",
		maximumFractionDigits: 1,
		signDisplay: "exceptZero",
	}).format(value);

export const formatSignedPercent = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "percent",
		maximumFractionDigits: 1,
		signDisplay: "always",
	}).format(value);
