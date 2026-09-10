import type { ReactNode } from "react";

interface CardProps {
	children: ReactNode;
	className?: string;
	/** Hilangkan padding bawaan kalau isinya tabel atau daftar penuh-lebar. */
	flush?: boolean;
}

/*
 * Kartu dibedakan oleh garis dan permukaan, bukan bayangan.
 *
 * Sebelumnya ruang + garis + shadow-sm dipakai ketiganya sekaligus di setiap
 * kartu, jadi tidak ada yang membedakan apa pun: kalau semua mengambang 1px,
 * tidak ada yang mengambang. Bayangan sekarang disimpan untuk yang benar-benar
 * di atas halaman — modal, bar lengket, toast.
 */
export default function Card({ children, className = "", flush = false }: CardProps) {
	return (
		<section
			className={`rounded-2xl border border-slate-200 bg-white ${flush ? "" : "p-4 sm:p-5"} ${className}`}
		>
			{children}
		</section>
	);
}

interface CardHeaderProps {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
}

export function CardHeader({ title, description, action, className = "" }: CardHeaderProps) {
	return (
		<div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
			<div className="min-w-0">
				<h2 className="type-title text-slate-900">{title}</h2>
				{description ? <p className="type-body mt-1 text-slate-500">{description}</p> : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	);
}
