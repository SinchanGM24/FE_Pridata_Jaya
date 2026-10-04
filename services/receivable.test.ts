import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get } }));

const { receivableService } = await import("./receivable");

const meta = (currentPage: number, totalPages: number) => ({
	currentPage,
	totalPages,
	totalItems: totalPages * 100,
	itemsPerPage: 100,
});

describe("receivableService", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("getAging sends the page filters to /receivables/aging", async () => {
		const aging = { totalReceivables: 3, overdueOver30Count: 1 };
		get.mockResolvedValue({ data: { data: aging } });
		const params = { search: "INV", status: "PARTIAL" as const, ageBucket: "daysOver90" as const };

		expect(await receivableService.getAging(params)).toBe(aging);
		expect(get).toHaveBeenCalledWith("/receivables/aging", { params });
	});

	it("listStoreGroups returns one page of /receivables/by-store", async () => {
		const row = { storeId: "s1", storeName: "Toko A", totalInvoiceCount: 2, totalOutstandingAmount: 500, overdueOver30Count: 1, maxDaysOverdue: 45 };
		get.mockResolvedValue({ data: { data: [row], meta: meta(2, 3) } });
		const params = { search: "toko", ageBucket: "days31To60" as const, page: 2, limit: 20 };

		expect(await receivableService.listStoreGroups(params)).toEqual({ items: [row], meta: meta(2, 3) });
		expect(get).toHaveBeenCalledWith("/receivables/by-store", { params });
	});

	it("listAllForStore pages through one store only, with the page filters", async () => {
		get.mockImplementation((_url: string, { params }: { params: { page: number } }) =>
			Promise.resolve({ data: { data: [{ id: `i${params.page}` }], meta: meta(params.page, 2) } }),
		);

		const rows = await receivableService.listAllForStore("s1", { status: "UNPAID", ageBucket: "current" });

		expect(rows.map((row) => row.id)).toEqual(["i1", "i2"]);
		expect(get).toHaveBeenCalledTimes(2);
		for (const page of [1, 2]) {
			expect(get).toHaveBeenCalledWith("/receivables", {
				params: { status: "UNPAID", ageBucket: "current", storeId: "s1", page, limit: 100, sortBy: "invoiceDate", sortOrder: "asc" },
			});
		}
	});
});
