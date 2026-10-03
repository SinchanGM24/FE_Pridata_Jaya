import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get } }));

const { catalogProductsService } = await import("./catalog-products");

describe("catalogProductsService.searchPublished", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("searches one small page of the published catalog on the server", async () => {
		get.mockResolvedValue({
			data: {
				data: [{ id: "c1", productId: "p1", marketingName: "Lampu", sellingPrice: 5000, product: { id: "p1", name: "LED 12W" } }],
			},
		});

		const result = await catalogProductsService.searchPublished("lam");

		expect(get).toHaveBeenCalledWith("/catalog-products/published", {
			params: { page: 1, limit: 20, search: "lam", sortBy: "marketingName", sortOrder: "asc" },
		});
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ productId: "p1", marketingName: "Lampu", sellingPrice: 5000 });
	});
});
