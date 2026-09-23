import Modal from "@/components/shared/Modal";
import SearchCombobox from "@/components/shared/SearchCombobox";
import type { CatalogProduct } from "@/services/catalog-products";
import { formatRupiah } from "@/lib/format";

interface AddInvoiceItemModalProps {
	isOpen: boolean;
	selectedProductId: string;
	quantity: string;
	filteredProducts: CatalogProduct[];
	onClose: () => void;
	onSelectProductId: (value: string) => void;
	onQuantityChange: (value: string) => void;
	onConfirm: () => void;
}


export default function AddInvoiceItemModal({
	isOpen,
	selectedProductId,
	quantity,
	filteredProducts,
	onClose,
	onSelectProductId,
	onQuantityChange,
	onConfirm,
}: AddInvoiceItemModalProps) {
	const selectedProduct =
		filteredProducts.find((item) => item.productId === selectedProductId) ??
		filteredProducts[0] ??
		null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Tambah Item Invoice">
			<div className="space-y-4 text-sm text-slate-700">
				<p className="text-slate-600">
					Pilih barang dari katalog aktif lalu isi kuantitas yang ingin ditambahkan ke draft invoice.
				</p>

				<SearchCombobox
					label="Pilih Barang"
					required
					value={selectedProductId}
					options={filteredProducts.map((product) => ({
						value: product.productId,
						label: product.marketingName,
						description: `${product.product.name} · ${formatRupiah(product.sellingPrice)}`,
						keywords: product.product.name,
					}))}
					onChange={(productId) => onSelectProductId(productId)}
					placeholder="Cari nama barang atau nama marketing"
				/>

				<label className="block space-y-2">
					<span className="font-medium text-slate-900">Kuantitas</span>
					<input
						type="number"
						min={1}
						value={quantity}
						onChange={(event) => onQuantityChange(event.target.value)}
						className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
					/>
				</label>

				{selectedProduct ? (
					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
						<p className="font-semibold text-slate-900">{selectedProduct.marketingName}</p>
						<p className="mt-1 text-slate-600">Harga katalog {formatRupiah(selectedProduct.sellingPrice)}</p>
					</div>
				) : null}

				<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
					>
						Batal
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-700"
					>
						Tambahkan
					</button>
				</div>
			</div>
		</Modal>
	);
}
