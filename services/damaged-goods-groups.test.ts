import { beforeEach, describe, expect, it, vi } from "vitest";

const receiptBatches = vi.fn();
const returnsList = vi.fn();

vi.mock("@/services/stock-adjustments", () => ({ stockAdjustmentsService: { receiptBatches } }));
vi.mock("@/services/store-returns", () => ({ storeReturnsService: { list: returnsList } }));

const { loadDamagedGoodsRows } = await import("./damaged-goods-groups");

const damagedBatch = (batchId: string, receivedAt: string) => ({
	batchId,
	referenceNumber: `PO-${batchId}`,
	supplier: "PT Sumber",
	warehouseId: "w1",
	warehouseName: "Gudang A",
	receivedAt,
	note: "",
	items: [{ recordId: `r-${batchId}`, productId: "p1", productName: "Baut", condition: "DAMAGED", quantity: 1 }],
	totalItems: 1,
	totalDamaged: 1,
});

describe("loadDamagedGoodsRows", () => {
	beforeEach(() => {
		receiptBatches.mockReset();
		returnsList.mockReset();
	});

	it("collects every receipt-batch page and approved-damaged returns, newest first", async () => {
		receiptBatches.mockImplementation(async ({ page }: { page: number }) => ({
			items: [damagedBatch(`b${page}`, `2026-09-0${page}T00:00:00.000Z`)],
			meta: { currentPage: page, totalPages: 2, totalItems: 2, itemsPerPage: 100 },
		}));
		returnsList.mockResolvedValue({
			items: [{
				id: "ret1", requestNumber: "RET-1", status: "APPROVED_DAMAGED",
				submittedAt: "2026-09-05T00:00:00.000Z", orderId: "o1", storeId: "s1", sourceWarehouseId: "w1",
				items: [{ id: "i1", productNameSnapshot: "Baut", quantity: 1, approvedCondition: "DAMAGED" }],
			}],
			meta: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 100 },
		});

		const rows = await loadDamagedGoodsRows();

		expect(receiptBatches).toHaveBeenCalledWith({ page: 1, limit: 100 });
		expect(receiptBatches).toHaveBeenCalledWith({ page: 2, limit: 100 });
		expect(returnsList).toHaveBeenCalledWith(
			expect.objectContaining({ status: "APPROVED_DAMAGED", page: 1, limit: 100 }),
		);
		expect(rows.map((row) => row.reportNumber)).toEqual(["BR-RET-1", "BR-b2", "BR-b1"]);
	});
});
