import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get } }));

const { damagedGoodsPeriodRange, damagedGoodsService } = await import("./damaged-goods");

const meta = { currentPage: 2, totalPages: 3, totalItems: 41, itemsPerPage: 20 };

describe("damagedGoodsService", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("lists one row per product with the filters and paging sent to the server", async () => {
		get.mockResolvedValue({ data: { data: [{ productId: "p1" }], meta } });
		const params = { source: "receipt" as const, party: "PT Uji", search: "baut", page: 2, limit: 20 };

		await expect(damagedGoodsService.list(params)).resolves.toEqual({ items: [{ productId: "p1" }], meta });
		expect(get).toHaveBeenCalledWith("/damaged-goods", { params });
	});

	it("lists a product's entries from the entries endpoint", async () => {
		get.mockResolvedValue({ data: { data: [{ id: "return:r1:i1" }], meta } });
		const params = { productId: "p1", source: "return" as const, page: 1, limit: 20 };

		await expect(damagedGoodsService.entries(params)).resolves.toEqual({ items: [{ id: "return:r1:i1" }], meta });
		expect(get).toHaveBeenCalledWith("/damaged-goods/entries", { params });
	});

	it("reads the headline numbers from the summary endpoint", async () => {
		const summary = { totalEntries: 4, totalUnits: 23, receiptEntries: 2, returnEntries: 2, parties: ["PT Uji"] };
		get.mockResolvedValue({ data: { data: summary } });

		await expect(damagedGoodsService.summary({ source: "receipt" })).resolves.toEqual(summary);
		expect(get).toHaveBeenCalledWith("/damaged-goods/summary", { params: { source: "receipt" } });
	});
});

describe("damagedGoodsPeriodRange", () => {
	it("sends no bounds for all periods", () => {
		expect(damagedGoodsPeriodRange("Semua Periode", "2026-10-04")).toEqual({});
	});

	it("bounds each period by WITA days ending today", () => {
		const dateTo = "2026-10-04T15:59:59.999Z";
		expect(damagedGoodsPeriodRange("Hari Ini", "2026-10-04")).toEqual({ dateFrom: "2026-10-03T16:00:00.000Z", dateTo });
		// 7 hari ke belakang, melewati batas bulan.
		expect(damagedGoodsPeriodRange("Minggu Ini", "2026-10-04")).toEqual({ dateFrom: "2026-09-26T16:00:00.000Z", dateTo });
		expect(damagedGoodsPeriodRange("Bulan Ini", "2026-10-04")).toEqual({ dateFrom: "2026-09-30T16:00:00.000Z", dateTo });
	});
});
