"use client";

import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";

interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: "danger" | "primary";
	onConfirm: () => void;
	onClose: () => void;
}

/** Pagar untuk aksi yang tidak bisa dibatalkan (mis. mengosongkan keranjang). */
export default function ConfirmDialog({
	isOpen,
	title,
	description,
	confirmLabel = "Lanjutkan",
	cancelLabel = "Batal",
	tone = "danger",
	onConfirm,
	onClose,
}: ConfirmDialogProps) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={title}
			maxWidthClassName="max-w-md"
			footer={
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button variant="secondary" onClick={onClose} className="sm:w-auto" block>
						{cancelLabel}
					</Button>
					<Button
						variant={tone === "danger" ? "commerce" : "primary"}
						onClick={() => {
							onConfirm();
							onClose();
						}}
						className="sm:w-auto"
						block
					>
						{confirmLabel}
					</Button>
				</div>
			}
		>
			<p className="text-sm leading-6 text-slate-600">{description}</p>
		</Modal>
	);
}
