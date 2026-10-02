import { describe, expect, it } from "vitest";
import { aggregateReceiptItems } from "./warehouse-receipts";

describe("aggregateReceiptItems", () => {
	it("sums received, good and damaged per product, sorted by name", () => {
		expect(
			aggregateReceiptItems([
				{ productName: "Mur", condition: "GOOD", quantity: 5 },
				{ productName: "Baut", condition: "GOOD", quantity: 8 },
				{ productName: "Baut", condition: "DAMAGED", quantity: 2 },
			]),
		).toEqual([
			{ productName: "Baut", receivedQuantity: 10, goodQuantity: 8, damagedQuantity: 2 },
			{ productName: "Mur", receivedQuantity: 5, goodQuantity: 5, damagedQuantity: 0 },
		]);
	});
});
