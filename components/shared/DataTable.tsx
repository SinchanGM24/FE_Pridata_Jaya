import type { ReactNode } from "react";

interface Column<Item> {
	key: string;
	head: string;
	render?: (item: Item) => ReactNode;
}

interface DataTableProps<Item> {
	columns: Column<Item>[];
	data: Item[];
	emptyText?: string;
}

export default function DataTable<Item>({
	columns,
	data,
	emptyText = "Tidak ada data",
}: DataTableProps<Item>) {
	return (
		<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
			<table className="min-w-full divide-y divide-slate-200 text-left text-sm">
				<thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
					<tr>
						{columns.map((column) => (
							<th key={column.key} className="px-4 py-3 font-semibold">
								{column.head}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-200 text-slate-800">
					{data.length === 0 ? (
						<tr>
							<td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
								{emptyText}
							</td>
						</tr>
					) : (
						data.map((item, rowIndex) => (
							<tr key={rowIndex} className="transition hover:bg-slate-50">
								{columns.map((column) => (
									<td key={column.key} className="px-4 py-3 align-top">
										{column.render ? column.render(item) : (item as any)[column.key] ?? "-"}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
