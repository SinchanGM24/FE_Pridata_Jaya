import Modal from "@/components/shared/Modal";
import type { CatalogProduct } from "@/services/catalog-products";

interface AddInvoiceItemModalProps {
	isOpen: boolean;
	search: string;
	selectedProductId: string;
	quantity: string;
	filteredProducts: CatalogProduct[];
	onClose: () => void;
	onSearchChange: (value: string) => void;
	onSelectProductId: (value: string) => void;
	onQuantityChange: (value: string) => void;
	onConfirm: () => void;
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function AddInvoiceItemModal({
	isOpen,
	search,
	selectedProductId,
	quantity,
	filteredProducts,
	onClose,
	onSearchChange,
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

				<label className="block space-y-2">
					<span className="font-medium text-slate-900">Cari Barang</span>
					<input
						type="text"
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Ketik nama barang atau nama marketing"
						className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
					/>
				</label>

				<label className="block space-y-2">
					<span className="font-medium text-slate-900">Pilih Barang</span>
					{filteredProducts.length > 0 ? (
						<select
							value={selectedProductId}
							onChange={(event) => onSelectProductId(event.target.value)}
							className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
						>
							{filteredProducts.map((product) => (
								<option key={product.id} value={product.productId}>
									{product.marketingName} - {formatRupiah(product.sellingPrice)}
								</option>
							))}
						</select>
					) : (
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-500">
							Barang tidak ditemukan. Ubah kata kunci pencarian.
						</div>
					)}
				</label>

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
						className="rounded-lg bg-slate-950 px-4 py-2 font-medium text-white hover:bg-slate-800"
					>
						Tambahkan
					</button>
				</div>
			</div>
		</Modal>
	);
}
