import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

/**
 * Pembungkus tipis di atas ResponsiveTable agar pemakai lama tidak perlu diubah.
 * Kode baru sebaiknya langsung memakai ResponsiveTable supaya bisa menandai
 * peran kolom (title/status/amount/action) untuk tampilan kartu di mobile.
 */
interface DataTableProps<Item> {
	columns: ResponsiveColumn<Item>[];
	data: Item[];
	emptyText?: string;
}

export default function DataTable<Item>({
	columns,
	data,
	emptyText = "Tidak ada data",
}: DataTableProps<Item>) {
	return <ResponsiveTable columns={columns} data={data} emptyText={emptyText} />;
}
