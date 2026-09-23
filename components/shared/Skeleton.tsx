interface SkeletonProps {
	className?: string;
}

export default function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
	return <div aria-hidden className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} />;
}

/** Placeholder daftar kartu — pakai grid yang sama dengan konten aslinya. */
export function SkeletonList({ rows = 3, className = "" }: { rows?: number; className?: string }) {
	return (
		<div className={`space-y-3 ${className}`} role="status" aria-label="Memuat data">
			{Array.from({ length: rows }, (_, index) => (
				<div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
					<Skeleton className="h-4 w-2/5" />
					<Skeleton className="mt-3 h-3 w-3/5" />
					<Skeleton className="mt-2 h-3 w-1/4" />
				</div>
			))}
		</div>
	);
}
