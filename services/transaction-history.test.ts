import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get } }));

const { transactionHistoryService } = await import("./transaction-history");

describe("transactionHistoryService.list", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("sends the filters to /transaction-history and returns one page", async () => {
		const meta = { currentPage: 2, totalPages: 3, totalItems: 41, itemsPerPage: 20 };
		get.mockResolvedValue({ data: { data: [{ id: "i1", kind: "invoice" }], meta } });
		const params = {
			view: "rejected" as const,
			search: "INV",
			dateFrom: "2026-08-31T16:00:00.000Z",
			dateTo: "2026-09-30T15:59:59.999Z",
			page: 2,
			limit: 20,
		};

		const result = await transactionHistoryService.list(params);

		expect(get).toHaveBeenCalledWith("/transaction-history", { params });
		expect(result).toEqual({ items: [{ id: "i1", kind: "invoice" }], meta });
	});
});
