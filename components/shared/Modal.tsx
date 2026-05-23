import type { ReactNode } from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	maxWidthClassName?: string;
}

export default function Modal({
	isOpen,
	onClose,
	title,
	children,
	maxWidthClassName = "max-w-2xl",
}: ModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
			<div
				className={`flex max-h-[calc(100vh-2rem)] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200`}
			>
				<div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
					<h3 className="text-xl font-semibold text-slate-900">{title}</h3>
					<button
						onClick={onClose}
						className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100"
					>
						Tutup
					</button>
				</div>
				<div className="overflow-y-auto px-6 py-5">{children}</div>
			</div>
		</div>
	);
}
