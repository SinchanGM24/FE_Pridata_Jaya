"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	maxWidthClassName?: string;
	/** Baris aksi yang menempel di bawah area gulir — CTA tidak boleh ikut tergulir hilang. */
	footer?: ReactNode;
}

const FOCUSABLE =
	'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * < sm : bottom sheet — menempel ke bawah, 85dvh, gagang seret.
 * >= sm: dialog terpusat.
 * Keduanya: Esc, klik backdrop, focus trap, kunci gulir body, fokus kembali ke pemicu.
 */
export default function Modal({
	isOpen,
	onClose,
	title,
	children,
	maxWidthClassName = "max-w-2xl",
	footer,
}: ModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);
	const titleId = useId();

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
				return;
			}
			if (event.key !== "Tab" || !panelRef.current) return;

			const focusable = Array.from(
				panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
			).filter((node) => node.offsetParent !== null);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		},
		[onClose],
	);

	useEffect(() => {
		if (!isOpen) return;

		previouslyFocused.current = document.activeElement as HTMLElement | null;
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", handleKeyDown);

		const focusTimer = window.setTimeout(() => {
			const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
			(target ?? panelRef.current)?.focus();
		}, 0);

		return () => {
			window.clearTimeout(focusTimer);
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = overflow;
			previouslyFocused.current?.focus?.();
		};
	}, [isOpen, handleKeyDown]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-[1px] sm:items-center sm:p-4"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				className={`flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200 outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl ${maxWidthClassName}`}
			>
				<div className="shrink-0 border-b border-slate-200">
					<div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
					<div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-4">
						<h3 id={titleId} className="min-w-0 truncate text-lg font-semibold text-slate-900">
							{title}
						</h3>
						<button
							type="button"
							onClick={onClose}
							aria-label="Tutup"
							className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
						>
							<X className="h-5 w-5" />
						</button>
					</div>
				</div>

				<div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>

				{footer ? (
					<div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
						{footer}
					</div>
				) : null}
			</div>
		</div>
	);
}
