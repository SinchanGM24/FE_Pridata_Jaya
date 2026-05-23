"use client";

import type { ReactNode } from "react";

function SkeletonBlock({
	className,
}: {
	className: string;
}) {
	return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
}

export function DashboardCardSkeleton({
	titleWidth = "w-40",
	lineCount = 2,
	chartHeight = 0,
	footerWidth = "w-56",
	className = "",
}: {
	titleWidth?: string;
	lineCount?: number;
	chartHeight?: number;
	footerWidth?: string;
	className?: string;
}) {
	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
			<div className="space-y-3">
				<SkeletonBlock className={`h-4 ${titleWidth}`} />
				<div className="space-y-2">
					{Array.from({ length: lineCount }).map((_, index) => (
						<SkeletonBlock
							key={index}
							className={`h-3 ${index === lineCount - 1 ? "w-2/3" : "w-full"}`}
						/>
					))}
				</div>
			</div>
			{chartHeight > 0 ? (
				<div
					className="mt-6 animate-pulse rounded-xl border border-dashed border-slate-200 bg-slate-50"
					style={{ height: chartHeight }}
				/>
			) : null}
			{footerWidth ? <SkeletonBlock className={`mt-4 h-3 ${footerWidth}`} /> : null}
		</div>
	);
}

export function DashboardMetricStripSkeleton() {
	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{Array.from({ length: 4 }).map((_, index) => (
				<div
					key={index}
					className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
				>
					<div className="flex items-start justify-between gap-3">
						<SkeletonBlock className="h-3 w-28" />
						<SkeletonBlock className="h-6 w-16 rounded-full" />
					</div>
					<SkeletonBlock className="mt-4 h-8 w-32" />
					<SkeletonBlock className="mt-3 h-3 w-40" />
				</div>
			))}
		</section>
	);
}

export function DashboardTableSkeleton({
	columns,
	rows = 5,
}: {
	columns: string[];
	rows?: number;
}) {
	return (
		<section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="border-b border-slate-200 px-5 py-4">
				<SkeletonBlock className="h-4 w-52" />
				<SkeletonBlock className="mt-3 h-3 w-72" />
			</div>
			<div className="overflow-x-auto">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							{columns.map((column) => (
								<th key={column} className="px-4 py-3">
									{column}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{Array.from({ length: rows }).map((_, rowIndex) => (
							<tr key={rowIndex}>
								{columns.map((column, columnIndex) => (
									<td key={`${column}-${rowIndex}`} className="px-4 py-3">
										<SkeletonBlock
											className={`h-3 ${
												columnIndex === 0
													? "w-24"
													: columnIndex === columns.length - 1
														? "w-16"
														: "w-28"
											}`}
										/>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export function DashboardSectionGridSkeleton({
	columnsClassName,
	children,
}: {
	columnsClassName: string;
	children: ReactNode;
}) {
	return <section className={`grid items-start gap-4 ${columnsClassName}`}>{children}</section>;
}
