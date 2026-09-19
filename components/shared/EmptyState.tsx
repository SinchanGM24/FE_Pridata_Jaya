import type { ReactNode } from "react";

interface EmptyStateProps {
	title: string;
	description?: string;
	action?: ReactNode;
	icon?: ReactNode;
	className?: string;
}

/** Keadaan kosong selalu menawarkan langkah berikutnya, bukan sekadar "Tidak ada data". */
export default function EmptyState({
	title,
	description,
	action,
	icon,
	className = "",
}: EmptyStateProps) {
	return (
		<div className={`px-4 py-10 text-center ${className}`}>
			{icon ? (
				<div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
					{icon}
				</div>
			) : null}
			<p className="text-sm font-semibold text-slate-900">{title}</p>
			{description ? (
				<p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
			) : null}
			{action ? <div className="mt-4 flex justify-center">{action}</div> : null}
		</div>
	);
}
