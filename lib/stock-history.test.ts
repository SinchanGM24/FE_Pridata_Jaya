import { describe, expect, it } from "vitest";
import type { StockAdjustmentRecord } from "@/services/stock-adjustments";
import { touchesSellableStock, withRunningBalance } from "./stock-history";

const rec = (id: string, items: StockAdjustmentRecord["items"]) => ({ id, items }) as StockAdjustmentRecord;

describe("stock-history", () => {
	it("menghitung saldo berjalan dari stok terkini, terbaru di atas", () => {
		const out = withRunningBalance(
			[
				rec("a", [{ id: "1", quantity: 3, fromCondition: "GOOD" }]),
				rec("b", [{ id: "2", quantity: 10, condition: "GOOD" }]),
			],
			20,
		);
		expect(out.map((r) => [r.quantity, r.stockQuantityAfter])).toEqual([[-3, 20], [10, 23]]);
	});

	it("menyaring riwayat yang tidak menyentuh stok GOOD", () => {
		expect(touchesSellableStock(rec("x", [{ id: "1", quantity: 1, condition: "DAMAGED" }]))).toBe(false);
		expect(touchesSellableStock(rec("y", [{ id: "1", quantity: 1, toCondition: "GOOD" }]))).toBe(true);
	});
});
