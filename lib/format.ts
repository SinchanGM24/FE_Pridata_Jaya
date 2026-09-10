/**
 * Formatter tunggal untuk seluruh aplikasi.
 * Sebelumnya `Intl.NumberFormat("id-ID", …)` yang sama ditulis ulang di 11 berkas.
 *
 * Instance di-hoist ke module scope: konstruksi `Intl.NumberFormat` tidak murah,
 * dan formatter ini dipanggil per sel, per baris, per render — lalu dikali dua
 * karena ResponsiveTable merender cabang kartu dan cabang tabel sekaligus.
 */

const rupiah = new Intl.NumberFormat("id-ID", {
	style: "currency",
	currency: "IDR",
	maximumFractionDigits: 0,
});

const compactRupiah = new Intl.NumberFormat("id-ID", {
	style: "currency",
	currency: "IDR",
	maximumFractionDigits: 1,
	notation: "compact",
});

const percentExceptZero = new Intl.NumberFormat("id-ID", {
	style: "percent",
	maximumFractionDigits: 1,
	signDisplay: "exceptZero",
});

const percentAlways = new Intl.NumberFormat("id-ID", {
	style: "percent",
	maximumFractionDigits: 1,
	signDisplay: "always",
});

const plainNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/**
 * Menerima null/undefined/NaN karena empat halaman menulis salinan lokalnya
 * sendiri hanya untuk menambahkan `|| 0`. Satu penjaga di sini menggantikan
 * empat penjaga di pemanggil.
 */
export const formatRupiah = (value: number | null | undefined) =>
	rupiah.format(Number.isFinite(Number(value)) ? Number(value) : 0);

export const formatCompactRupiah = (value: number) => compactRupiah.format(value);

export const formatPercent = (value: number) => percentExceptZero.format(value);

export const formatPercentage = (value: number) => formatPercent(value / 100);

export const formatSignedPercent = (value: number) => percentAlways.format(value);

export const formatSignedPercentage = (value: number) => formatSignedPercent(value / 100);

/** Angka polos dengan pemisah ribuan Indonesia. */
export const formatNumber = (value: number) => plainNumber.format(value);
