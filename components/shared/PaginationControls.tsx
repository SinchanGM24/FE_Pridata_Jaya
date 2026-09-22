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
			className={`flex items-center justify-between gap-2 bg-white px-3 py-3 sm:gap-3 sm:px-4 ${
				embedded ? "border-t border-slate-200" : "rounded-xl border border-slate-200 shadow-sm"
			} ${className}`}
		>
			<div className="hidden text-sm text-slate-500 sm:block">
				{totalItems !== undefined ? (
					<p>Menampilkan {resolvedCurrentItemCount} dari {totalItems} {itemLabel}.</p>
				) : (
					<p>Maksimal {pageSize} {itemLabel} per halaman.</p>
				)}
				<p className="mt-0.5 text-xs">Halaman {safeCurrentPage} dari {safeTotalPages}</p>
			</div>
			<div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
				<button
					type="button"
					onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
					disabled={loading || safeCurrentPage <= 1}
					className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
				>
					Sebelumnya
				</button>
				<span className="text-xs font-semibold text-slate-600 sm:hidden">Hal. {safeCurrentPage}/{safeTotalPages}</span>
				<div className="hidden items-center gap-2 sm:flex">
				{visiblePages.map((pageNumber) => (
					<button
						key={pageNumber}
						type="button"
						onClick={() => onPageChange(pageNumber)}
						disabled={loading}
						aria-current={pageNumber === safeCurrentPage ? "page" : undefined}
						aria-label={`Halaman ${pageNumber}`}
						className={`size-9 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${
							pageNumber === safeCurrentPage
								? "bg-sky-600 text-white"
								: "border border-slate-300 text-slate-700 hover:bg-slate-50"
						}`}
					>
						{pageNumber}
					</button>
				))}
				</div>
				<button
					type="button"
					onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
					disabled={loading || safeCurrentPage >= safeTotalPages}
					className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
				>
					Berikutnya
				</button>
			</div>
		</nav>
	);
}
