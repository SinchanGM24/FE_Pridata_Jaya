import Modal from "@/components/shared/Modal";

interface FinalizeInvoiceConfirmModalProps {
	isOpen: boolean;
	step: 1 | 2;
	draftNumber?: string | null;
	storeName: string;
	itemCount: number;
	totalAmount: number;
	onClose: () => void;
	onNext: () => void;
	onConfirm: () => void;
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function FinalizeInvoiceConfirmModal({
	isOpen,
	step,
	draftNumber,
	storeName,
	itemCount,
	totalAmount,
	onClose,
	onNext,
	onConfirm,
}: FinalizeInvoiceConfirmModalProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Verifikasi Finalisasi Invoice">
			<div className="space-y-4 text-sm text-slate-700">
				<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Langkah {step} dari 2</p>
					<p className="mt-2 font-semibold text-slate-900">{draftNumber || "Draft Invoice"}</p>
					<p className="mt-1 text-slate-600">{storeName}</p>
					<p className="mt-3 text-slate-700">
						{itemCount} item siap difinalisasi dengan nilai {formatRupiah(totalAmount)}.
					</p>
				</div>

				{step === 1 ? (
					<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
						Pastikan qty, harga, diskon, pajak, dan jatuh tempo sudah benar sebelum invoice dikunci.
					</div>
				) : (
					<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
						Konfirmasi terakhir: invoice akan difinalisasi dan siap diteruskan ke alur gudang.
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
							className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
						>
							Lanjut Verifikasi
						</button>
					) : (
						<button
							type="button"
							onClick={onConfirm}
							className="rounded-lg bg-slate-950 px-4 py-2 font-medium text-white hover:bg-slate-800"
						>
							Ya, Finalisasi Invoice
						</button>
					)}
				</div>
			</div>
		</Modal>
	);
}
