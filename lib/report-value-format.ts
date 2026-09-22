export type ReportValueDisplay = "text" | "date" | "quantity" | "currency" | "percent";

const inferDisplay = (key: string): ReportValueDisplay => {
	if (/(?:date|at)$/i.test(key)) return "date";
	if (/percent/i.test(key)) return "percent";
	if (/(?:amount|price|subtotal|total|paid|remaining|discount)/i.test(key)) return "currency";
	if (/(?:quantity|qty|count|daysOverdue)/i.test(key)) return "quantity";
	return "text";
};

export const formatReportValue = (value: unknown, key: string, display?: ReportValueDisplay): string => {
	if (value === null || value === undefined || value === "") return "-";
	const kind = display ?? inferDisplay(key);
	if (kind === "date") {
		const date = value instanceof Date ? value : new Date(String(value));
		if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Makassar" }).format(date);
	}
	const number = typeof value === "number" ? value : Number(value);
	if (Number.isFinite(number) && kind !== "text") {
		if (kind === "currency") return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number);
		if (kind === "percent") return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(number)}%`;
		return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(number);
	}
	return String(value);
};

export const reportValueAlignment = (key: string, display?: ReportValueDisplay) => {
	const kind = display ?? inferDisplay(key);
	return kind === "date" ? "text-center" : kind === "currency" || kind === "quantity" || kind === "percent" ? "text-right tabular-nums" : "text-left";
};
