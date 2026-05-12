import Modal from "@/components/shared/Modal";

interface CancelReasonModalProps {
	isOpen: boolean;
	title: string;
	description: string;
	reason: string;
	submitting?: boolean;
	onReasonChange: (value: string) => void;
	onClose: () => void;
	onConfirm: () => void;
}

export default function CancelReasonModal({
	isOpen,
	title,
	description,
	reason,
	submitting = false,
	onReasonChange,
	onClose,
	onConfirm,
}: CancelReasonModalProps) {
	const isInvalid = reason.trim().length === 0;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title={title}>
			<div className="space-y-4">
				<p className="text-sm leading-6 text-slate-600">{description}</p>
				<label className="block space-y-2 text-sm text-slate-700">
					<span className="font-medium">Alasan</span>
					<textarea
						className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
						value={reason}
						onChange={(event) => onReasonChange(event.target.value)}
						placeholder="Tulis alasan pembatalan"
						disabled={submitting}
					/>
				</label>
				<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
					<button
						type="button"
						onClick={onClose}
						disabled={submitting}
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Tutup
					</button>
					<button
						type="button"
						onClick={onConfirm}
						disabled={submitting || isInvalid}
						className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
					>
						{submitting ? "Memproses..." : "Konfirmasi Batal"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
