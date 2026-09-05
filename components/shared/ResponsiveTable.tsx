"use client";

import type { ReactNode } from "react";
import EmptyState from "@/components/shared/EmptyState";
import Skeleton from "@/components/shared/Skeleton";

/**
 * Satu tabel untuk dua dunia.
 *
 * < md : tiap baris jadi kartu — tidak ada scroll horizontal, tidak ada kolom hilang.
 * >= md: <table> sungguhan di dalam overflow-x-auto, header lengket, kolom pertama menempel.
 *
 * Ini menggantikan 17 tabel yang sebelumnya dibungkus `overflow-hidden`
 * (untuk membulatkan sudut) sehingga kolom terakhirnya benar-benar
 * tidak terjangkau di layar 360px.
 */
export interface ResponsiveColumn<Item> {
	key: string;
	head: string;
	render?: (item: Item) => ReactNode;
	/**
	 * Menentukan tempat kolom ini di tampilan kartu:
	 * title  — judul kartu (dan pemicu onRowClick)
	 * status — badge di kanan atas
	 * amount — nilai besar di kanan
	 * meta   — pasangan label/nilai (default)
	 * action — baris tombol paling bawah
	 */
	role?: "title" | "status" | "amount" | "meta" | "action";
	align?: "left" | "right";
	/** Sembunyikan di tampilan kartu — untuk kolom yang mengulang judul. */
	hideOnCard?: boolean;
	cellClassName?: string;
}

interface ResponsiveTableProps<Item> {
	columns: ResponsiveColumn<Item>[];
	data: Item[];
	getRowKey?: (item: Item, index: number) => string;
	loading?: boolean;
	skeletonRows?: number;
	emptyText?: string;
	emptyDescription?: string;
	emptyAction?: ReactNode;
	onRowClick?: (item: Item) => void;
	/** Baris ringkasan (mis. total keranjang). Tetap tampil di kedua tampilan. */
	summary?: ReactNode;
	className?: string;
}

const cellValue = <Item,>(column: ResponsiveColumn<Item>, item: Item): ReactNode => {
	if (column.render) return column.render(item);
	if (typeof item === "object" && item !== null && column.key in (item as Record<string, unknown>)) {
		return (item as Record<string, ReactNode | null | undefined>)[column.key] ?? "-";
	}
	return "-";
};

export default function ResponsiveTable<Item>({
	columns,
	data,
	getRowKey,
	loading = false,
	skeletonRows = 4,
	emptyText = "Belum ada data",
	emptyDescription,
	emptyAction,
	onRowClick,
	summary,
	className = "",
}: ResponsiveTableProps<Item>) {
	const rowKey = (item: Item, index: number) => getRowKey?.(item, index) ?? String(index);

	const titleColumn = columns.find((column) => column.role === "title") ?? columns[0];
	const statusColumns = columns.filter((column) => column.role === "status");
	const amountColumns = columns.filter((column) => column.role === "amount");
	const actionColumns = columns.filter((column) => column.role === "action");
	const metaColumns = columns.filter(
		(column) =>
			column !== titleColumn &&
			!column.hideOnCard &&
			(column.role === undefined || column.role === "meta"),
	);

	const isEmpty = !loading && data.length === 0;

	return (
		<div className={className}>
			{/* ---------- Kartu (< md) ---------- */}
			<div className="md:hidden">
				{loading ? (
					<div className="space-y-3">
						{Array.from({ length: skeletonRows }, (_, index) => (
							<div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
								<Skeleton className="h-4 w-2/5" />
								<Skeleton className="mt-3 h-3 w-3/5" />
								<Skeleton className="mt-2 h-3 w-1/3" />
							</div>
						))}
					</div>
				) : isEmpty ? (
					<div className="rounded-2xl border border-slate-200 bg-white">
						<EmptyState title={emptyText} description={emptyDescription} action={emptyAction} />
					</div>
				) : (
					<ul className="space-y-3">
						{data.map((item, index) => (
							<li
								key={rowKey(item, index)}
								className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										{onRowClick ? (
											<button
												type="button"
												onClick={() => onRowClick(item)}
												className="max-w-full text-left text-sm font-semibold text-slate-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
											>
												{cellValue(titleColumn, item)}
											</button>
										) : (
											<div className="text-sm font-semibold text-slate-900">
												{cellValue(titleColumn, item)}
											</div>
										)}
									</div>
									{statusColumns.length ? (
										<div className="flex shrink-0 flex-col items-end gap-1">
											{statusColumns.map((column) => (
												<div key={column.key}>{cellValue(column, item)}</div>
											))}
										</div>
									) : null}
								</div>

								{amountColumns.length ? (
									<div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
										{amountColumns.map((column) => (
											<div key={column.key} className="min-w-0">
												<p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
													{column.head}
												</p>
												<p className="text-base font-bold text-slate-900">
													{cellValue(column, item)}
												</p>
											</div>
										))}
									</div>
								) : null}

								{metaColumns.length ? (
									<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
										{metaColumns.map((column) => (
											<div key={column.key} className="min-w-0">
												<dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
													{column.head}
												</dt>
												<dd className="mt-0.5 truncate text-slate-800">
													{cellValue(column, item)}
												</dd>
											</div>
										))}
									</dl>
								) : null}

								{actionColumns.length ? (
									<div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
										{actionColumns.map((column) => (
											<div key={column.key} className="contents">
												{cellValue(column, item)}
											</div>
										))}
									</div>
								) : null}
							</li>
						))}
					</ul>
				)}
				{summary ? <div className="mt-3">{summary}</div> : null}
			</div>

			{/* ---------- Tabel (>= md) ---------- */}
			<div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-left text-sm">
						<thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
							<tr>
								{columns.map((column) => (
									<th
										key={column.key}
										scope="col"
										className={`px-4 py-3 font-semibold whitespace-nowrap ${
											column.align === "right" ? "text-right" : ""
										}`}
									>
										{column.head}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 text-slate-800">
							{loading ? (
								Array.from({ length: skeletonRows }, (_, index) => (
									<tr key={index}>
										{columns.map((column) => (
											<td key={column.key} className="px-4 py-3">
												<Skeleton className="h-4 w-full" />
											</td>
										))}
									</tr>
								))
							) : isEmpty ? (
								<tr>
									<td colSpan={columns.length} className="p-0">
										<EmptyState
											title={emptyText}
											description={emptyDescription}
											action={emptyAction}
										/>
									</td>
								</tr>
							) : (
								data.map((item, index) => (
									<tr key={rowKey(item, index)} className="transition hover:bg-slate-50">
										{columns.map((column) => {
											const content =
												column === titleColumn && onRowClick ? (
													<button
														type="button"
														onClick={() => onRowClick(item)}
														className="text-left font-semibold text-slate-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
													>
														{cellValue(column, item)}
													</button>
												) : (
													cellValue(column, item)
												);

											return (
												<td
													key={column.key}
													className={`px-4 py-3 align-middle ${
														column.align === "right" ? "text-right" : ""
													} ${column.cellClassName ?? ""}`}
												>
													{content}
												</td>
											);
										})}
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				{summary ? <div className="border-t border-slate-200 bg-slate-50">{summary}</div> : null}
			</div>
		</div>
	);
}
