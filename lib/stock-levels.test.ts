import { describe, expect, it } from "vitest";
import { stockStatusLabel, stockStatusParam, toStockRowView } from "./stock-levels";

describe("stock-levels", () => {
	it("maps UI status filter to API value", () => {
		expect(stockStatusParam("ALL")).toBeUndefined();
		expect(stockStatusParam("Kosong")).toBe("EMPTY");
		expect(stockStatusParam("Menipis")).toBe("LOW");
		expect(stockStatusParam("Aman")).toBe("OK");
		expect(stockStatusLabel("LOW")).toBe("Menipis");
	});

	it("maps a row, defaulting null category, brand and code", () => {
		const view = toStockRowView({
			productId: "p1", productName: "Baut", productCode: null, categoryName: null, brandName: "X",
			totalWarehouses: 1, sellableQuantity: 10, lastUpdatedAt: "2026-01-01T00:00:00Z", status: "LOW",
			warehouseBreakdown: [{ warehouseId: "w1", warehouseName: "A", sellableQuantity: 10, lastUpdatedAt: "2026-01-01T00:00:00Z", status: "EMPTY" }],
		});
		expect(view).toMatchObject({ id: "p1", productSku: "", categoryName: "-", brandName: "X", status: "Menipis" });
		expect(view.warehouseBreakdown[0].status).toBe("Kosong");
	});
});
