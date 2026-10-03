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

describe("catalogProductsService.listPublished", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("sends search, categoryLabel and hasStock to the server with the page", async () => {
		get.mockResolvedValue({
			data: { data: [], meta: { currentPage: 2, totalPages: 3, totalItems: 45, itemsPerPage: 20 } },
		});

		const result = await catalogProductsService.listPublished({
			page: 2,
			limit: 20,
			search: "philips",
			categoryLabel: "Lampu",
			hasStock: true,
		});

		expect(get).toHaveBeenCalledWith("/catalog-products/published", {
			params: { page: 2, limit: 20, search: "philips", categoryLabel: "Lampu", hasStock: true },
		});
		expect(result.meta?.totalItems).toBe(45);
	});
});

describe("catalogProductsService.publishedFacets", () => {
	beforeEach(() => {
		get.mockReset();
	});

	it("reads category chips and the total from the facets endpoint", async () => {
		const facets = { total: 60, categories: [{ label: "Lampu", count: 42 }, { label: "Kabel", count: 18 }] };
		get.mockResolvedValue({ data: { data: facets } });

		const result = await catalogProductsService.publishedFacets({ search: "led", hasStock: true });

		expect(get).toHaveBeenCalledWith("/catalog-products/published/facets", {
			params: { search: "led", hasStock: true },
		});
		expect(result).toEqual(facets);
	});
});
