import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/ui-labels";
import Skeleton from "@/components/shared/Skeleton";

/**
 * Satu skala netral. Warna hanya dipakai kalau angkanya memang bermakna
 * (piutang lewat jatuh tempo = danger), bukan untuk membedakan kartu.
 */
const TONE_ACCENT: Record<StatusTone, string> = {
	neutral: "bg-slate-300",
	brand: "bg-brand-500",
	success: "bg-emerald-500",
	warning: "bg-amber-500",
	danger: "bg-rose-500",
};

const TONE_VALUE: Record<StatusTone, string> = {
	neutral: "text-slate-900",
	brand: "text-slate-900",
	success: "text-emerald-700",
	warning: "text-amber-700",
	danger: "text-rose-700",
};

interface StatCardProps {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	tone?: StatusTone;
	loading?: boolean;
}

export default function StatCard({
	label,
	value,
	hint,
	tone = "neutral",
	loading = false,
}: StatCardProps) {
	return (
		<div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${TONE_ACCENT[tone]}`} />
			<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
				{label}
			</p>
			{loading ? (
				<Skeleton className="mt-2 h-7 w-24" />
			) : (
				<p
					className={`mt-1.5 text-xl font-bold leading-tight tracking-tight sm:text-2xl ${TONE_VALUE[tone]}`}
				>
					{value}
				</p>
			)}
			{hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
		</div>
	);
}

interface StatGridProps {
	children: ReactNode;
	/** Jumlah kolom di layar lebar. Di bawah sm selalu satu kolom penuh. */
	columns?: 2 | 3 | 4;
	className?: string;
}

const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
	2: "grid-cols-1 sm:grid-cols-2",
	3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
	4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
};

export function StatGrid({ children, columns = 4, className = "" }: StatGridProps) {
	return <section className={`grid gap-3 ${GRID_COLUMNS[columns]} ${className}`}>{children}</section>;
}
