import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/ui-labels";

const TONE_CLASSES: Record<StatusTone, string> = {
	neutral: "border-slate-200 bg-slate-50 text-slate-700",
	brand: "border-brand-200 bg-brand-50 text-brand-800",
	success: "border-emerald-200 bg-emerald-50 text-emerald-800",
	warning: "border-amber-200 bg-amber-50 text-amber-800",
	danger: "border-rose-200 bg-rose-50 text-rose-700",
};

interface BadgeProps {
	children: ReactNode;
	tone?: StatusTone;
	className?: string;
}

/**
 * Status selalu membawa teks — warna tidak pernah jadi satu-satunya penanda.
 *
 * Persegi membulat, bukan pil. Pil adalah bentuk badge paling generik yang ada,
 * dan di sini ia juga menabrak jenjang radius: kontainer 2xl > elemen xl >
 * kontrol lg. Badge adalah penanda sebaris, jadi ia yang paling rapat.
 */
export default function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
		>
			{children}
		</span>
	);
}
