export const APP_TIME_ZONE = "Asia/Singapore";

const pad = (value: number) => String(value).padStart(2, "0");

export const formatLocalDateTimeInput = (date = new Date()) =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const formatLocalDateInput = (date = new Date()) =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const toIsoFromLocalInput = (value?: string | null, fallback = new Date()) => {
	if (!value) {
		return fallback.toISOString();
	}

	const normalized = value.trim();
	const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
	const resolvedValue = dateOnlyMatch
		? `${normalized}T${pad(fallback.getHours())}:${pad(fallback.getMinutes())}`
		: normalized;
	const parsed = new Date(resolvedValue);

	return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
};

export const toIsoStartOfLocalDay = (value: string) => toIsoFromLocalInput(`${value}T00:00`);

export const toIsoEndOfLocalDay = (value: string) => toIsoFromLocalInput(`${value}T23:59:59.999`);

export const formatAppDate = (value?: string | Date | null) => {
	if (!value) {
		return "-";
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeZone: APP_TIME_ZONE,
	}).format(date);
};

export const formatAppDateTime = (value?: string | Date | null) => {
	if (!value) {
		return "-";
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: APP_TIME_ZONE,
	}).format(date);
};

/** Hari bisnis WITA (UTC+8, tanpa DST) untuk `YYYY-MM-DD` dari `<input type="date">`; BE menolak tanggal tanpa jam. */
export const witaDayStartIso = (day: string) => witaIso(day, "00:00:00.000");

export const witaDayEndIso = (day: string) => witaIso(day, "23:59:59.999");

/** `undefined` untuk input kosong/tak valid (mis. tahun 5 digit dari `<input type="date">`), bukan RangeError saat render. */
const witaIso = (day: string, time: string) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
	const parsed = new Date(`${day}T${time}+08:00`);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

/** `dateFrom`/`dateTo` WITA untuk satu tahun, atau satu bulan (1–12) di tahun itu. */
export const witaPeriodRange = (year: number, month?: number) => {
	const lastDay = new Date(Date.UTC(year, month ?? 12, 0)).getUTCDate();
	return {
		dateFrom: witaDayStartIso(`${year}-${pad(month ?? 1)}-01`),
		dateTo: witaDayEndIso(`${year}-${pad(month ?? 12)}-${pad(lastDay)}`),
	};
};
