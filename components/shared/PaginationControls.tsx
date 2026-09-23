"use client";

interface PaginationControlsProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	totalItems?: number;
	currentItemCount?: number;
	pageSize?: number;
	itemLabel?: string;
	loading?: boolean;
	embedded?: boolean;
	className?: string;
}

export default function PaginationControls({
	currentPage,
	totalPages,
	onPageChange,
	totalItems,
	currentItemCount,
	pageSize = 10,
	itemLabel = "data",
	loading = false,
	embedded = true,
	className = "",
}: PaginationControlsProps) {
	const safeTotalPages = Math.max(1, totalPages);
	const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
	const visiblePages = Array.from({ length: Math.min(5, safeTotalPages) }, (_, index) => {
		const start = Math.min(
			Math.max(1, safeCurrentPage - 2),
			Math.max(1, safeTotalPages - 4),
		);
		return start + index;
	});
	const resolvedCurrentItemCount = currentItemCount ?? (
		totalItems === undefined
			? pageSize
			: Math.max(0, Math.min(pageSize, totalItems - (safeCurrentPage - 1) * pageSize))
	);

	return (
		<nav
			aria-label="Navigasi halaman"
			className={`flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
				embedded ? "border-t border-slate-200" : "rounded-xl border border-slate-200 shadow-sm"
			} ${className}`}
		>
			<div className="text-sm text-slate-500">
				{totalItems !== undefined ? (
					<p>Menampilkan {resolvedCurrentItemCount} dari {totalItems} {itemLabel}.</p>
				) : (
					<p>Maksimal {pageSize} {itemLabel} per halaman.</p>
				)}
				<p className="mt-0.5 text-xs">Halaman {safeCurrentPage} dari {safeTotalPages}</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
					disabled={loading || safeCurrentPage <= 1}
					className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9"
				>
					Sebelumnya
				</button>
				{visiblePages.map((pageNumber) => (
					<button
						key={pageNumber}
						type="button"
						onClick={() => onPageChange(pageNumber)}
						disabled={loading}
						aria-current={pageNumber === safeCurrentPage ? "page" : undefined}
						aria-label={`Halaman ${pageNumber}`}
						className={`size-11 rounded-lg text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:opacity-50 md:size-9 ${
							pageNumber === safeCurrentPage
								? "bg-brand-700 text-white"
								: "border border-slate-300 text-slate-700 hover:bg-slate-50"
						}`}
					>
						{pageNumber}
					</button>
				))}
				<button
					type="button"
					onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
					disabled={loading || safeCurrentPage >= safeTotalPages}
					className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9"
				>
					Berikutnya
				</button>
			</div>
		</nav>
	);
}
