import { describe, expect, it } from "vitest";
import { witaDayEndIso, witaDayStartIso, witaPeriodRange } from "@/lib/datetime";

describe("WITA business-day bounds", () => {
	it("maps a picked date to 00:00 and 23:59:59.999 WITA", () => {
		expect(witaDayStartIso("2026-09-01")).toBe("2026-08-31T16:00:00.000Z");
		expect(witaDayEndIso("2026-09-30")).toBe("2026-09-30T15:59:59.999Z");
	});

	it("covers a whole month, including February in a leap year", () => {
		expect(witaPeriodRange(2026, 9)).toEqual({
			dateFrom: "2026-08-31T16:00:00.000Z",
			dateTo: "2026-09-30T15:59:59.999Z",
		});
		expect(witaPeriodRange(2028, 2).dateTo).toBe("2028-02-29T15:59:59.999Z");
	});

	it("covers a whole year when no month is given", () => {
		expect(witaPeriodRange(2026)).toEqual({
			dateFrom: "2025-12-31T16:00:00.000Z",
			dateTo: "2026-12-31T15:59:59.999Z",
		});
	});
});
