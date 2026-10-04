import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get }, withIdempotencyKey: vi.fn() }));

const { ordersService } = await import("./orders");

describe("ordersService.list", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("passes the invoice filter and sort to the server and returns one page", async () => {
		const meta = { currentPage: 1, totalPages: 3, totalItems: 41, itemsPerPage: 20 };
		const order = { id: "o1", invoiceDrafts: [{ id: "d1", draftNumber: "DRF-1", status: "DRAFT" }] };
		get.mockResolvedValue({ data: { data: [order], meta } });

		const result = await ordersService.list({
			page: 1,
			limit: 20,
			status: "PROCESSED",
			hasInvoice: false,
			search: "DRF-1",
			sortBy: "documentDate",
			sortOrder: "desc",
		});

		expect(get).toHaveBeenCalledWith("/orders", {
			params: {
				page: 1,
				limit: 20,
				status: "PROCESSED",
				hasInvoice: false,
				search: "DRF-1",
				sortBy: "documentDate",
				sortOrder: "desc",
			},
		});
		expect(result).toEqual({ items: [order], meta });
	});
});
