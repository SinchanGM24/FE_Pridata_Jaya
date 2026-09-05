/**
 * Formatter tunggal untuk seluruh aplikasi.
 * Sebelumnya `Intl.NumberFormat("id-ID", …)` yang sama ditulis ulang di 11 berkas.
 */

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

export const formatPercentage = (value: number) => formatPercent(value / 100);

export const formatSignedPercent = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "percent",
		maximumFractionDigits: 1,
		signDisplay: "always",
	}).format(value);

export const formatSignedPercentage = (value: number) => formatSignedPercent(value / 100);

/** Angka polos dengan pemisah ribuan Indonesia. */
export const formatNumber = (value: number) =>
	new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
