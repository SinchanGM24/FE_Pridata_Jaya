// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { usePagedList, type PagedResult } from "../usePagedList";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Hook = ReturnType<typeof usePagedList<number>>;
let root: Root; let latest: Hook;
const meta = (totalPages: number, totalItems = totalPages) => ({ currentPage: 1, totalPages, totalItems, itemsPerPage: 20 });

function Harness(props: { fetchPage: (p: number, l: number) => Promise<PagedResult<number>>; filterKey: string }) {
	const hook = usePagedList(props.fetchPage, { filterKey: props.filterKey, errorMessage: "gagal" });
	useEffect(() => { latest = hook; });
	return null;
}
// Effects flush when act exits, so timers they schedule need a second act.
// A few rounds cover chains (timer -> setState -> effect -> timer).
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await vi.runAllTimersAsync(); }); };
const render = async (props: Parameters<typeof Harness>[0]) => { await act(async () => { root.render(<Harness {...props} />); }); await settle(); };

beforeEach(() => { vi.useFakeTimers(); root = createRoot(document.createElement("div")); });
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });

test("halaman 1 dimuat dan items serta totalItems terisi dari meta", async () => {
	const fetchPage = vi.fn().mockResolvedValue({ items: [1, 2, 3], meta: meta(4, 70) });
	await render({ fetchPage, filterKey: "" });
	expect(fetchPage).toHaveBeenCalledWith(1, 20);
	expect(latest.items).toEqual([1, 2, 3]);
	expect(latest.totalItems).toBe(70);
	expect(latest.totalPages).toBe(4);
	expect(latest.loading).toBe(false);
});

test("reload yang gagal mempertahankan baris lama", async () => {
	const fetchPage = vi.fn().mockResolvedValueOnce({ items: [1, 2], meta: meta(1, 2) }).mockRejectedValueOnce(new Error("boom"));
	await render({ fetchPage, filterKey: "" });
	await act(async () => { latest.reload(); });
	await settle();
	expect(latest.items).toEqual([1, 2]);
	expect(latest.error).toBe("boom");
	expect(latest.loading).toBe(false);
});

test("respons basi diabaikan", async () => {
	let resolveFirst!: (v: PagedResult<number>) => void;
	const fetchPage = vi.fn()
		.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
		.mockResolvedValueOnce({ items: [9], meta: meta(1, 1) });
	await render({ fetchPage, filterKey: "a" });
	await render({ fetchPage, filterKey: "ab" });
	await act(async () => { resolveFirst({ items: [1], meta: meta(1, 1) }); await vi.runAllTimersAsync(); });
	expect(latest.items).toEqual([9]);
});

test("filterKey berubah saat page 3 kembali ke page 1", async () => {
	const fetchPage = vi.fn().mockResolvedValue({ items: [1], meta: meta(5, 100) });
	await render({ fetchPage, filterKey: "a" });
	await act(async () => { latest.setPage(3); });
	await settle();
	expect(latest.page).toBe(3);
	await render({ fetchPage, filterKey: "b" });
	expect(latest.page).toBe(1);
	expect(fetchPage).toHaveBeenLastCalledWith(1, 20);
	// a(1), a(3), b(1): no premature fetch of page 3 with the new filter.
	expect(fetchPage).toHaveBeenCalledTimes(3);
});

test("totalPages lebih kecil dari page mundur ke halaman terakhir dan fetch ulang", async () => {
	const fetchPage = vi.fn().mockResolvedValue({ items: [1], meta: meta(2, 30) });
	await render({ fetchPage, filterKey: "" });
	await act(async () => { latest.setPage(5); });
	await settle();
	expect(latest.page).toBe(2);
	expect(fetchPage).toHaveBeenLastCalledWith(2, 20);
});

test("respons halaman lama tidak menimpa reset page saat filterKey berubah", async () => {
	let resolveOld!: (v: PagedResult<number>) => void;
	const fetchPage = vi.fn()
		.mockResolvedValueOnce({ items: [1], meta: meta(5, 100) })
		.mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }))
		.mockResolvedValue({ items: [7], meta: meta(5, 100) });
	await render({ fetchPage, filterKey: "a" });
	await act(async () => { latest.setPage(3); });
	await settle(); // page 3 request is now in flight
	await act(async () => { root.render(<Harness fetchPage={fetchPage} filterKey="b" />); });
	await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // timer resets page to 1, new fetch not yet started
	await act(async () => { resolveOld({ items: [1], meta: meta(2, 30) }); });
	expect(latest.page).toBe(1);
	await settle();
	expect(latest.page).toBe(1);
	expect(latest.items).toEqual([7]);
});
