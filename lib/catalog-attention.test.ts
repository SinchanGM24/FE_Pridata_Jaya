import { describe, expect, it } from "vitest";
import { mergeAttention } from "./catalog-attention";

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
