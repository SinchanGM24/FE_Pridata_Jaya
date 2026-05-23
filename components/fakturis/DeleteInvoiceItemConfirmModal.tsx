import Modal from "@/components/shared/Modal";

interface DeleteInvoiceItemConfirmModalProps {
	isOpen: boolean;
	step: 1 | 2;
	productName?: string;
	onClose: () => void;
	onNext: () => void;
	onConfirm: () => void;
}

export default function DeleteInvoiceItemConfirmModal({
	isOpen,
	step,
	productName,
	onClose,
	onNext,
	onConfirm,
}: DeleteInvoiceItemConfirmModalProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Verifikasi Hapus Item">
			<div className="space-y-4 text-sm text-slate-700">
				<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Langkah {step} dari 2</p>
					<p className="mt-2 font-semibold text-slate-900">{productName || "Item Invoice"}</p>
				</div>

				{step === 1 ? (
					<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
						Pastikan item yang akan dihapus memang tidak perlu lagi di invoice.
					</div>
				) : (
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
						Konfirmasi terakhir: item akan dihapus dari draft invoice aktif.
					</div>
				)}

				<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
					>
						Batal
					</button>
					{step === 1 ? (
						<button
							type="button"
							onClick={onNext}
							className="rounded-lg border border-amber-300 px-4 py-2 font-medium text-amber-800 hover:bg-amber-50"
						>
							Lanjut Verifikasi
						</button>
					) : (
						<button
							type="button"
							onClick={onConfirm}
							className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700"
						>
							Ya, Hapus Item
						</button>
					)}
				</div>
			</div>
		</Modal>
	);
}
