import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/ui-labels";

const TONE_CLASSES: Record<StatusTone, string> = {
	neutral: "border-slate-200 bg-slate-50 text-slate-700",
	brand: "border-brand-200 bg-brand-50 text-brand-800",
	success: "border-emerald-200 bg-emerald-50 text-emerald-800",
	warning: "border-amber-200 bg-amber-50 text-amber-800",
	danger: "border-rose-200 bg-rose-50 text-rose-800",
};

interface InlineAlertProps {
	children: ReactNode;
	tone?: StatusTone;
	className?: string;
}

/**
 * Pesan yang harus tinggal di tempatnya: galat di dalam modal, catatan aturan
 * di atas form. PageFeedback melayang di sudut layar — di belakang modal ia
 * tidak terlihat, jadi jangan dipakai untuk galat submit.
 *
 * Ada karena string class yang sama disalin ke delapan berkas dan pelan-pelan
 * bercabang jadi dua keluarga merah (red-* dan rose-*) yang berarti sama.
 */
export default function InlineAlert({ children, tone = "danger", className = "" }: InlineAlertProps) {
	return (
		<div
			role={tone === "danger" ? "alert" : undefined}
			className={`rounded-xl border px-4 py-3 text-sm ${TONE_CLASSES[tone]} ${className}`}
		>
			{children}
		</div>
	);
}
