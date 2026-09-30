// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Modal from "../Modal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout: offsetParent is always null, which would hide every focusable from the trap.
Object.defineProperty(HTMLElement.prototype, "offsetParent", {
	configurable: true,
	get() {
		return this.parentNode;
	},
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	vi.useFakeTimers();
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.useRealTimers();
});

// Mirrors the real call sites: an inline onClose and a form field whose state lives in the page.
function Page() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	return (
		<>
			<button type="button" id="trigger" onClick={() => setOpen(true)}>
				Buka
			</button>
			<Modal isOpen={open} onClose={() => setOpen(false)} title="Edit">
				<input id="name" value={name} onChange={(event) => setName(event.target.value)} />
				<button type="button" id="save">
					Simpan
				</button>
			</Modal>
		</>
	);
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;

function typeInto(input: HTMLInputElement, text: string) {
	const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
	for (const char of text) {
		act(() => {
			setValue.call(input, input.value + char);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		act(() => vi.runAllTimers());
	}
}

function openModal() {
	act(() => root.render(<Page />));
	$("trigger").focus();
	act(() => $("trigger").click());
	act(() => vi.runAllTimers());
}

const press = (key: string, shiftKey = false) =>
	act(() => {
		document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));
	});

test("typing in a field keeps focus on that field", () => {
	openModal();
	const input = $("name") as HTMLInputElement;
	input.focus();

	typeInto(input, "abc");

	expect(document.activeElement).toBe(input);
	expect(input.value).toBe("abc");
});

test("Tab wraps inside the dialog and Escape returns focus to the trigger", () => {
	openModal();
	const input = $("name") as HTMLInputElement;
	input.focus();
	typeInto(input, "x");

	$("save").focus();
	press("Tab");
	expect(document.activeElement).toBe(document.querySelector('[aria-label="Tutup"]'));

	press("Escape");
	expect(document.querySelector('[role="dialog"]')).toBeNull();
	expect(document.activeElement).toBe($("trigger"));
});
