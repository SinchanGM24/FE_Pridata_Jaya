import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/ui-labels";

const TONE_CLASSES: Record<StatusTone, string> = {
	neutral: "border-slate-200 bg-slate-50 text-slate-700",
	brand: "border-brand-200 bg-brand-50 text-brand-700",
	success: "border-emerald-200 bg-emerald-50 text-emerald-700",
	warning: "border-amber-200 bg-amber-50 text-amber-800",
	danger: "border-rose-200 bg-rose-50 text-rose-700",
};

interface BadgeProps {
	children: ReactNode;
	tone?: StatusTone;
	className?: string;
}

/** Status selalu membawa teks — warna tidak pernah jadi satu-satunya penanda. */
export default function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
		>
			{children}
		</span>
	);
}
