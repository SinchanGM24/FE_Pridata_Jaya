"use client";

type PageFeedbackProps = {
	error?: string | null;
	success?: string | null;
	onDismissError?: () => void;
	onDismissSuccess?: () => void;
};

export default function PageFeedback({
	error,
	success,
	onDismissError,
	onDismissSuccess,
}: PageFeedbackProps) {
	const message = error || success;
	if (!message) return null;

	const isError = Boolean(error);
	const tone = isError
		? "border-rose-200 bg-rose-50 text-rose-700"
		: "border-emerald-200 bg-emerald-50 text-emerald-700";
	const dotTone = isError ? "bg-rose-500" : "bg-emerald-500";
	const label = isError ? "Perlu diperiksa" : "Berhasil";
	const onDismiss = isError ? onDismissError : onDismissSuccess;

	return (
		<div className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex justify-center sm:justify-end">
			<div
				role={isError ? "alert" : "status"}
				aria-live={isError ? "assertive" : "polite"}
				className={`pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${tone}`}
			>
				<div className="flex items-start gap-3">
					<span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotTone}`} />
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{label}</p>
						<p className="mt-1 font-medium">{message}</p>
					</div>
					{onDismiss ? (
						<button
							type="button"
							onClick={onDismiss}
							className="rounded-full px-2 py-1 text-xs font-semibold opacity-70 hover:bg-white/70 hover:opacity-100"
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
