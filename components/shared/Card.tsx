import type { ReactNode } from "react";

interface CardProps {
	children: ReactNode;
	className?: string;
	/** Hilangkan padding bawaan kalau isinya tabel atau daftar penuh-lebar. */
	flush?: boolean;
}

export default function Card({ children, className = "", flush = false }: CardProps) {
	return (
		<section
			className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${flush ? "" : "p-4 sm:p-5"} ${className}`}
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
				<h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
				{description ? (
					<p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{description}</p>
				) : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	);
}
