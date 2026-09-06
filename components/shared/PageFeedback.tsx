"use client";

import { buttonClasses } from "@/components/shared/Button";

type PageFeedbackProps = {
	error?: string | null;
	success?: string | null;
	onDismissError?: () => void;
	onDismissSuccess?: () => void;
	/**
	 * Kalau diisi, galat menawarkan jalan keluar alih-alih jalan buntu.
	 * Sebelumnya seluruh portal toko & sales hanya punya satu tombol coba-lagi.
	 */
	onRetry?: () => void;
	retryLabel?: string;
};

export default function PageFeedback({
	error,
	success,
	onDismissError,
	onDismissSuccess,
	onRetry,
	retryLabel = "Coba lagi",
}: PageFeedbackProps) {
	const message = error || success;
	if (!message) return null;

	const isError = Boolean(error);
	const tone = isError
		? "border-rose-200 bg-rose-50 text-rose-800"
		: "border-emerald-200 bg-emerald-50 text-emerald-800";
	const dotTone = isError ? "bg-rose-500" : "bg-emerald-500";
	const label = isError ? "Perlu diperiksa" : "Berhasil";
	const onDismiss = isError ? onDismissError : onDismissSuccess;

	return (
		// Di bawah md toast harus duduk di atas bottom tab bar, bukan di atasnya —
		// bottom-4 mendarat tepat di zona jempol, menutupi tab "Keranjang".
		// Halaman tanpa tab bar (gudang/akuntan/fakturis) ikut kena offset ini;
		// itu hanya ruang kosong ekstra, tidak pernah menutupi apa pun.
		<div className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--spacing-tabbar-gap)+0.5rem)] z-[80] flex justify-center md:bottom-4 sm:justify-end">
			<div
				role={isError ? "alert" : "status"}
				aria-live={isError ? "assertive" : "polite"}
				className={`pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${tone}`}
			>
				<div className="flex items-start gap-3">
					<span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotTone}`} />
					<div className="min-w-0 flex-1">
						<p className="type-label opacity-70">{label}</p>
						<p className="mt-1 text-sm font-medium">{message}</p>
						{isError && onRetry ? (
							<button
								type="button"
								onClick={onRetry}
								className={buttonClasses("secondary", "sm", "mt-3")}
							>
								{retryLabel}
							</button>
						) : null}
					</div>
					{onDismiss ? (
						<button
							type="button"
							onClick={onDismiss}
							className="-my-1 inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold opacity-70 transition hover:bg-white/70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current md:min-h-9"
							aria-label="Tutup pesan"
						>
							Tutup
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}
