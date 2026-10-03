// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useServerValue } from "../useServerValue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
type Hook = ReturnType<typeof useServerValue<number>>;
let root: Root; let latest: Hook;

function Harness(props: { fetchValue: () => Promise<number>; filterKey: string }) {
	const hook = useServerValue(props.fetchValue, { key: props.filterKey, errorMessage: "gagal" });
	useEffect(() => { latest = hook; });
	return null;
}
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await vi.runAllTimersAsync(); }); };
const render = async (props: Parameters<typeof Harness>[0]) => { await act(async () => { root.render(<Harness {...props} />); }); await settle(); };

beforeEach(() => { vi.useFakeTimers(); root = createRoot(document.createElement("div")); });
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });

test("memuat nilai, lalu gagal mengosongkannya alih-alih menampilkan angka lama", async () => {
	const fetchValue = vi.fn().mockResolvedValueOnce(7).mockRejectedValueOnce(new Error("boom"));
	await render({ fetchValue, filterKey: "a" });
	expect(latest.data).toBe(7);
	await render({ fetchValue, filterKey: "b" });
	expect(latest.data).toBeNull();
	expect(latest.error).toBe("boom");
	expect(latest.loading).toBe(false);
});

test("respons basi diabaikan dan reload memuat ulang", async () => {
	let resolveFirst!: (value: number) => void;
	const fetchValue = vi.fn()
		.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
		.mockResolvedValueOnce(2)
		.mockResolvedValueOnce(3);
	await render({ fetchValue, filterKey: "a" });
	await render({ fetchValue, filterKey: "ab" });
	await act(async () => { resolveFirst(1); await vi.runAllTimersAsync(); });
	expect(latest.data).toBe(2);
	await act(async () => { latest.reload(); });
	await settle();
	expect(latest.data).toBe(3);
});
