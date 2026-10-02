import type { StockAdjustmentRecord } from "@/services/stock-adjustments";

/** Item yang hanya keluar dari sebuah kondisi (kirim, transfer keluar, koreksi turun) mengurangi stok gudang. */
export const signedInventoryQuantity = (record: StockAdjustmentRecord) =>
	record.items.reduce(
		(sum, item) => sum + (item.fromCondition && !item.toCondition ? -item.quantity : item.quantity),
		0,
	);

/** Hanya riwayat yang menyentuh stok jual (GOOD) yang ditampilkan. */
export const touchesSellableStock = (record: StockAdjustmentRecord) =>
	record.items.some(
		(item) => item.condition === "GOOD" || item.fromCondition === "GOOD" || item.toCondition === "GOOD",
	);

/**
 * Saldo berjalan untuk halaman yang sedang tampil (terbaru di atas): baris pertama memakai `startStock`,
 * tiap baris berikutnya mengurangi qty baris sebelumnya.
 */
export function withRunningBalance(rows: StockAdjustmentRecord[], startStock: number) {
	let next = startStock;
	return rows.map((row) => {
		const quantity = signedInventoryQuantity(row);
		const stockQuantityAfter = next;
		next -= quantity;
		return { row, quantity, stockQuantityAfter };
	});
}
