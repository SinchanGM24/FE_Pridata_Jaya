import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get } }));

const { stockAdjustmentsService } = await import("./stock-adjustments");

describe("stockAdjustmentsService receipt batches", () => {
	beforeEach(() => get.mockReset());

	it("lists receipt batches with server-side search and paging", async () => {
		const meta = { currentPage: 2, totalPages: 3, totalItems: 41, itemsPerPage: 20 };
		get.mockResolvedValue({ data: { data: [{ batchId: "b1" }], meta } });

		const result = await stockAdjustmentsService.receiptBatches({ search: "baut", page: 2, limit: 20 });

		expect(get).toHaveBeenCalledWith("/stock-adjustments/receipt-batches", {
			params: { search: "baut", page: 2, limit: 20 },
		});
		expect(result).toEqual({ items: [{ batchId: "b1" }], meta });
	});

	it("reads the summary from its own endpoint", async () => {
		const summary = { totalDocs: 6, totalItems: 7, totalDamaged: 7, totalUnits: 20 };
		get.mockResolvedValue({ data: { data: summary } });

		await expect(stockAdjustmentsService.receiptBatchesSummary()).resolves.toEqual(summary);
		expect(get).toHaveBeenCalledWith("/stock-adjustments/receipt-batches/summary", { params: undefined });
	});
});
