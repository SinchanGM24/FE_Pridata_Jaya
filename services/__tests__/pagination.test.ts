import { expect, test } from "vitest";
import { collectPaginatedItems, countOf } from "../pagination";

test("tidak pernah mengambil lebih dari 3 halaman sekaligus dan urutannya terjaga", async () => {
	let inFlight = 0;
	let peak = 0;
	const fetchPage = async (page: number) => {
		inFlight++; peak = Math.max(peak, inFlight);
		await Promise.resolve(); await Promise.resolve();
		inFlight--;
		return { items: [page], meta: { currentPage: page, totalPages: 7, totalItems: 7, itemsPerPage: 1 } };
	};
	expect(await collectPaginatedItems(fetchPage, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	expect(peak).toBeLessThanOrEqual(3);
});

test("countOf membaca meta.totalItems dan jatuh ke 0 bila meta kosong", async () => {
	const meta = { currentPage: 1, totalPages: 9, totalItems: 9, itemsPerPage: 1 };
	expect(await countOf(Promise.resolve({ meta }))).toBe(9);
	expect(await countOf(Promise.resolve({}))).toBe(0);
});
