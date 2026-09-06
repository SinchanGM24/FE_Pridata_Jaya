import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/ui-labels";
import Skeleton from "@/components/shared/Skeleton";

/**
 * Satu skala netral. Warna hanya dipakai kalau angkanya memang bermakna
 * (piutang lewat jatuh tempo = danger), bukan untuk membedakan kartu.
 */
const TONE_ACCENT: Record<StatusTone, string> = {
	neutral: "bg-slate-300",
	brand: "bg-brand-600",
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

/** Padanan teks untuk tone — batang warna saja tidak terbaca pembaca layar. */
const TONE_LABEL: Record<StatusTone, string> = {
	neutral: "",
	brand: "",
	success: "kondisi baik",
	warning: "perlu perhatian",
	danger: "perlu tindakan",
};

interface StatCardProps {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	tone?: StatusTone;
	loading?: boolean;
	/**
	 * Angka yang menentukan tindakan berikutnya di layar ini. Baris KPI dengan
	 * empat kartu berbobot sama berkata keempatnya sama penting, dan itu tidak
	 * pernah benar. Tandai tepat satu per layar.
	 */
	lead?: boolean;
}

export default function StatCard({
	label,
	value,
	hint,
	tone = "neutral",
	loading = false,
	lead = false,
}: StatCardProps) {
	const toneLabel = TONE_LABEL[tone];

	return (
		<div
			className={`relative overflow-hidden rounded-2xl border bg-white p-4 ${
				lead ? "border-slate-300 col-span-2 xl:col-span-1" : "border-slate-200"
			}`}
		>
			<span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${TONE_ACCENT[tone]}`} />
			<p className="type-label text-slate-500">{label}</p>
			{loading ? (
				<Skeleton className="mt-2 h-8 w-28" />
			) : (
				<p
					className={`type-display mt-1.5 ${lead ? "text-3xl sm:text-4xl" : ""} ${TONE_VALUE[tone]}`}
				>
					{value}
					{/* Tone disampaikan warna lewat batang kiri; ini padanan teksnya. */}
					{toneLabel ? <span className="sr-only">, {toneLabel}</span> : null}
				</p>
			)}
			{hint ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p> : null}
		</div>
	);
}

interface StatGridProps {
	children: ReactNode;
	/** Jumlah kolom di layar lebar. Di bawah sm selalu satu kolom penuh. */
	columns?: 2 | 3 | 4;
	className?: string;
}

/*
 * Dua kolom sejak lebar terkecil. Satu kolom penuh membuat empat KPI memakan
 * hampir seluruh layar HP sebelum daftar yang bisa ditindaklanjuti muncul —
 * dan nilai seperti "105" atau "Grade N" jauh lebih pendek dari kartunya.
 * Kartu `lead` tetap selebar dua kolom supaya ia yang memimpin.
 */
const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
	2: "grid-cols-2",
	3: "grid-cols-2 lg:grid-cols-3",
	4: "grid-cols-2 xl:grid-cols-4",
};

export function StatGrid({ children, columns = 4, className = "" }: StatGridProps) {
	return <section className={`grid gap-3 ${GRID_COLUMNS[columns]} ${className}`}>{children}</section>;
}
