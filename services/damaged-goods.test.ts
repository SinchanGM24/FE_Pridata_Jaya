import { describe, expect, it } from "vitest";
import {
	mapDamagedGoodsFromApprovedReturns,
	mapDamagedGoodsFromReceiptBatches,
	type DamagedGoodsItem,
} from "./damaged-goods";
import type { ReceiptBatch } from "./stock-adjustments";
import type { StoreReturnRequestItem } from "./store-returns";

const batch = (overrides: Partial<ReceiptBatch> = {}): ReceiptBatch => ({
	batchId: "rcv-1",
	referenceNumber: "PO-001",
	supplier: "PT Sumber",
	warehouseId: "w1",
	warehouseName: "Gudang A",
	receivedAt: "2026-09-01T08:00:00.000Z",
	note: "Dus penyok",
	items: [
		{ recordId: "r1", productId: "p1", productName: "Baut", condition: "GOOD", quantity: 8 },
		{ recordId: "r1", productId: "p1", productName: "Baut", condition: "DAMAGED", quantity: 2 },
		{ recordId: "r2", productId: "p2", productName: "Mur", condition: "DAMAGED", quantity: 3 },
	],
	totalItems: 2,
	totalDamaged: 5,
	...overrides,
});

describe("mapDamagedGoodsFromReceiptBatches", () => {
	it("maps only DAMAGED items, keeping the receipt fields", () => {
		const rows = mapDamagedGoodsFromReceiptBatches([batch()]);
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => [row.productName, row.quantity])).toEqual([["Baut", 2], ["Mur", 3]]);
		expect(rows[0]).toMatchObject({
			reportNumber: "BR-rcv-1",
			reportDate: "2026-09-01T08:00:00.000Z",
			source: "Penerimaan Barang",
			referenceNumber: "PO-001",
			relatedParty: "PT Sumber",
			damageType: "DAMAGED",
			warehouseName: "Gudang A",
			description: "Dus penyok",
		});
		expect(new Set(rows.map((row) => row.id)).size).toBe(2);
	});

	it("renders a fallback batch with null supplier/reference and empty note safely", () => {
		const [row] = mapDamagedGoodsFromReceiptBatches([
			batch({
				batchId: "rec:abc",
				referenceNumber: null,
				supplier: null,
				note: "",
				items: [{ recordId: "abc", productId: "p1", productName: "Baut", condition: "DAMAGED", quantity: 1 }],
			}),
		]);
		expect(row).toMatchObject({
			reportNumber: "BR-rec:abc",
			referenceNumber: "",
			relatedParty: "",
			description: "Barang rusak terdeteksi saat penerimaan supplier.",
		});
	});

	it("keeps ids unique when one record carries two DAMAGED items, newest batch first", () => {
		const rows = mapDamagedGoodsFromReceiptBatches([
			batch({ batchId: "old", receivedAt: "2026-01-01T00:00:00.000Z" }),
			batch({
				batchId: "new",
				receivedAt: "2026-09-02T00:00:00.000Z",
				items: [
					{ recordId: "r9", productId: "p1", productName: "Baut", condition: "DAMAGED", quantity: 1 },
					{ recordId: "r9", productId: "p1", productName: "Baut", condition: "DAMAGED", quantity: 4 },
				],
			}),
		]);
		expect(rows[0].reportNumber).toBe("BR-new");
		expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
	});
});

describe("mapDamagedGoodsFromApprovedReturns", () => {
	const request = {
		id: "ret1",
		requestNumber: "RET-1",
		status: "APPROVED_DAMAGED",
		submittedAt: "2026-09-01T00:00:00.000Z",
		reviewedAt: "2026-09-03T00:00:00.000Z",
		orderId: "o1",
		storeId: "s1",
		store: { name: "Toko A" },
		sourceWarehouseId: "w1",
		items: [{ id: "i1", productNameSnapshot: "Baut", quantity: 2, receivedQuantity: 2, approvedCondition: "DAMAGED" }],
	} as unknown as StoreReturnRequestItem;

	it("maps approved damaged lines and skips returns already listed", () => {
		expect(mapDamagedGoodsFromApprovedReturns([request])).toMatchObject([
			{ reportNumber: "BR-RET-1", source: "Retur Barang", relatedParty: "Toko A", quantity: 2 },
		]);
		const existing = [{ source: "Retur Barang", reportNumber: "BR-RET-1" } as DamagedGoodsItem];
		expect(mapDamagedGoodsFromApprovedReturns([request], existing)).toEqual([]);
	});
});
