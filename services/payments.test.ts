import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get }, withIdempotencyKey: vi.fn() }));

const { paymentsService } = await import("./payments");

describe("paymentsService", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("lists the accountant queue with the server-side target filter", async () => {
		const meta = { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 20 };
		get.mockResolvedValue({ data: { data: [{ id: "p1" }], meta } });
		const params = {
			page: 1,
			limit: 20,
			status: "PENDING" as const,
			verificationTarget: "ACCOUNTANT" as const,
			search: "budi",
		};

		await expect(paymentsService.list(params)).resolves.toEqual({ items: [{ id: "p1" }], meta });
		expect(get).toHaveBeenCalledWith("/payments", { params });
	});

	it("reads the summary with the same filters as the list", async () => {
		const summary = { count: 2, totalAmount: 150000, distinctStores: 1 };
		get.mockResolvedValue({ data: { data: summary } });
		const params = { status: "PENDING" as const, verificationTarget: "ACCOUNTANT" as const };

		await expect(paymentsService.summary(params)).resolves.toEqual(summary);
		expect(get).toHaveBeenCalledWith("/payments/summary", { params });
	});
});
