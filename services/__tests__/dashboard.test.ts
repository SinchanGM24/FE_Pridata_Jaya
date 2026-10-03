import { expect, test } from "vitest";
import { countOpenShipments } from "../dashboard";

test("DO belum selesai = semua status selain SHIPPED, RECEIVED, CANCELLED", () => {
	expect(
		countOpenShipments({ DRAFT: 2, PROCESSING: 3, SHIPPED: 10, RECEIVED: 4, CANCELLED: 5 }),
	).toBe(5);
	expect(countOpenShipments({})).toBe(0);
});
