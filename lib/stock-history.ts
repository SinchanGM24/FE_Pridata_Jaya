import type { StockAdjustmentRecord } from "@/services/stock-adjustments";

/** Item yang hanya keluar dari sebuah kondisi (kirim, transfer keluar, koreksi turun) mengurangi stok gudang. */
export const signedInventoryQuantity = (record: StockAdjustmentRecord) =>
	record.items.reduce(
		(sum, item) => sum + (item.fromCondition && !item.toCondition ? -item.quantity : item.quantity),
		0,
	);

/**
 * Saldo berjalan (terbaru di atas): baris pertama memakai `startStock`, tiap baris berikutnya mengurangi
 * qty baris sebelumnya. Hanya benar di halaman 1; halaman >1 tidak tahu mutasi halaman sebelumnya,
 * jadi saldo `null` (UI menampilkan "—").
 */
export function withRunningBalance(rows: StockAdjustmentRecord[], startStock: number, page = 1) {
	let next = startStock;
	return rows.map((row) => {
		const quantity = signedInventoryQuantity(row);
		const stockQuantityAfter = page === 1 ? next : null;
		next -= quantity;
		return { row, quantity, stockQuantityAfter };
	});
}
