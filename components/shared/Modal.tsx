import type { ReactNode } from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
			<div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
				<div className="mb-6 flex items-center justify-between">
					<h3 className="text-xl font-semibold text-slate-900">{title}</h3>
					<button
						onClick={onClose}
						className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100"
					>
						Tutup
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}
