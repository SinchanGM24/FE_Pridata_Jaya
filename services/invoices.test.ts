import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get } }));

const { invoicesService } = await import("./invoices");

describe("invoicesService DO queue", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("lists non-cancelled invoices without a DO, newest first, with server filters", async () => {
		const meta = { currentPage: 2, totalPages: 2, totalItems: 21, itemsPerPage: 20 };
		get.mockResolvedValue({ data: { data: [{ id: "inv1" }], meta } });

		const result = await invoicesService.listDeliveryQueue({ page: 2, limit: 20, search: "INV", sourceWarehouseId: "w1" });

		expect(get).toHaveBeenCalledWith("/invoices", {
			params: {
				page: 2,
				limit: 20,
				search: "INV",
				sourceWarehouseId: "w1",
				sortBy: "invoiceDate",
				sortOrder: "desc",
				status: "UNPAID,PARTIAL,PAID",
				hasDeliveryOrder: false,
			},
		});
		expect(result).toEqual({ items: [{ id: "inv1" }], meta });
	});

	it("reads one invoice by id", async () => {
		get.mockResolvedValue({ data: { data: { id: "inv1" } } });
		await expect(invoicesService.getById("inv1")).resolves.toEqual({ id: "inv1" });
		expect(get).toHaveBeenCalledWith("/invoices/inv1");
	});
});
