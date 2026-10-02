import { describe, expect, it } from "vitest";
import { activeReadiness, mergeAttention } from "./catalog-attention";

const p = (productId: string) => ({ productId });

describe("mergeAttention", () => {
	it("keeps group priority and dedupes by productId", () => {
		expect(mergeAttention([[p("a"), p("b")], [p("b"), p("c")], [p("a"), p("d")]], 10).map((x) => x.productId)).toEqual(["a", "b", "c", "d"]);
	});
	it("caps at limit", () => {
		expect(mergeAttention([[p("a"), p("b")], [p("c")]], 2)).toHaveLength(2);
	});
	it("returns empty for empty groups", () => {
		expect(mergeAttention([[], []], 6)).toEqual([]);
	});
});

describe("activeReadiness", () => {
	it("derives configured/published/percent from stock-active counts", () => {
		const r = activeReadiness({ activeStockProducts: 10, activeNotCreated: 4, activeDraft: 2, activeWithoutImages: 1 });
		expect(r).toMatchObject({ configured: 6, published: 4, notCreated: 4, needAction: 6, allClear: false, readinessPercent: 60 });
	});
	it("is all clear only when nothing needs action or images", () => {
		expect(activeReadiness({ activeStockProducts: 3, activeNotCreated: 0, activeDraft: 0, activeWithoutImages: 0 }).allClear).toBe(true);
		expect(activeReadiness({ activeStockProducts: 3, activeNotCreated: 0, activeDraft: 0, activeWithoutImages: 2 }).allClear).toBe(false);
	});
	it("handles zero stock-active products", () => {
		expect(activeReadiness({ activeStockProducts: 0, activeNotCreated: 0, activeDraft: 0, activeWithoutImages: 0 }).readinessPercent).toBe(0);
	});
});
