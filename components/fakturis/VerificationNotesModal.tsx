import Modal from "@/components/shared/Modal";
import type { VerificationStatus } from "@/services/stores";

interface VerificationNotesModalProps {
	isOpen: boolean;
	storeName: string;
	status: VerificationStatus;
	notes: string;
	submitting?: boolean;
	onNotesChange: (value: string) => void;
	onClose: () => void;
	onConfirm: () => void;
}

export default function VerificationNotesModal({
	isOpen,
	storeName,
	status,
	notes,
	submitting = false,
	onNotesChange,
	onClose,
	onConfirm,
}: VerificationNotesModalProps) {
	const isRejected = status === "REJECTED";

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isRejected ? "Tolak Pelanggan" : "Verifikasi Pelanggan"}
		>
			<div className="space-y-4">
				<p className="text-sm leading-6 text-slate-600">
					{storeName ? `${storeName} akan diubah menjadi ${status}.` : ""}
				</p>
				<label className="block space-y-2 text-sm text-slate-700">
					<span className="font-medium">Catatan verifikasi</span>
					<textarea
						className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
						value={notes}
						onChange={(event) => onNotesChange(event.target.value)}
						placeholder={
							isRejected
								? "Alasan penolakan atau tindak lanjut"
								: "Catatan opsional untuk hasil verifikasi"
						}
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
						disabled={submitting}
						className={
							isRejected
								? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
								: "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
						}
					>
						{submitting ? "Memproses..." : isRejected ? "Tolak" : "Verifikasi"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
