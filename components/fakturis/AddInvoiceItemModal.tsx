import { useRef } from "react";
import Modal from "@/components/shared/Modal";
import SearchCombobox, { type SearchComboboxOption } from "@/components/shared/SearchCombobox";
import type { CatalogProduct } from "@/services/catalog-products";
import { formatRupiah } from "@/lib/format";

interface AddInvoiceItemModalProps {
	isOpen: boolean;
	selectedProduct: CatalogProduct | null;
	quantity: string;
	/** Pencarian katalog di server; hasilnya sudah tanpa barang yang ada di draft. */
	searchProducts: (query: string) => Promise<CatalogProduct[]>;
	onClose: () => void;
	onSelectProduct: (product: CatalogProduct | null) => void;
	onQuantityChange: (value: string) => void;
	onConfirm: () => void;
}

const toOption = (product: CatalogProduct): SearchComboboxOption => ({
	value: product.productId,
	label: product.marketingName,
	description: `${product.product.name} · ${formatRupiah(product.sellingPrice)}`,
});

export default function AddInvoiceItemModal({
	isOpen,
	selectedProduct,
	quantity,
	searchProducts,
	onClose,
	onSelectProduct,
	onQuantityChange,
	onConfirm,
}: AddInvoiceItemModalProps) {
	// Hasil pencarian terakhir, agar pilihan (yang hanya membawa id) bisa diubah kembali ke produk lengkap.
	const found = useRef(new Map<string, CatalogProduct>());

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Tambah Item Invoice">
			<div className="space-y-4 text-sm text-slate-700">
				<p className="text-slate-600">
					Pilih barang dari katalog aktif lalu isi kuantitas yang ingin ditambahkan ke draft invoice.
				</p>

				<SearchCombobox
					label="Pilih Barang"
					required
					value={selectedProduct?.productId ?? ""}
					selectedOption={selectedProduct ? toOption(selectedProduct) : null}
					loadOptions={async (query) => {
						const products = await searchProducts(query);
						for (const product of products) found.current.set(product.productId, product);
						return products.map(toOption);
					}}
					onChange={(productId) => onSelectProduct(found.current.get(productId) ?? null)}
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
						disabled={!selectedProduct}
						className="rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Tambahkan
					</button>
				</div>
			</div>
		</Modal>
	);
}
