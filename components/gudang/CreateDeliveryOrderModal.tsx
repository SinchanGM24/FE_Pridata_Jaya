import Modal from "@/components/shared/Modal";
import type { InvoiceListItem } from "@/services/invoices";
import type { OrderItem } from "@/services/orders";

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

interface CreateDeliveryOrderModalProps {
	invoice: InvoiceListItem | null;
	orderItems: OrderItem[];
	itemStockRows: Array<{
		orderItemId: string;
		available: number;
		required: number;
		fulfilled: boolean;
	}>;
	notes: string;
	sourceWarehouseId: string;
	sourceWarehouseOptions: Array<{
		id: string;
		name: string;
		shortfallCount: number;
		totalAvailable: number;
	}>;
	submitting?: boolean;
	onSourceWarehouseChange: (value: string) => void;
	onNotesChange: (value: string) => void;
	onClose: () => void;
	onConfirm: (invoice: InvoiceListItem) => void;
}

export default function CreateDeliveryOrderModal({
	invoice,
	orderItems,
	itemStockRows,
	notes,
	sourceWarehouseId,
	sourceWarehouseOptions,
	submitting = false,
	onSourceWarehouseChange,
	onNotesChange,
	onClose,
	onConfirm,
}: CreateDeliveryOrderModalProps) {
	const selectedWarehouse =
		sourceWarehouseOptions.find((warehouse) => warehouse.id === sourceWarehouseId) ?? null;
	const itemStockById = new Map(itemStockRows.map((row) => [row.orderItemId, row]));

	return (
		<Modal isOpen={Boolean(invoice)} onClose={onClose} title="Buat Delivery Order">
			{invoice ? (
				<div className="space-y-4 text-sm text-slate-700">
					<div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
						Invoice ini sudah lolos proses fakturis dan sekarang siap diturunkan ke workflow gudang.
					</div>
					<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
						<div>
							<p className="text-xs text-slate-500">Invoice</p>
							<p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Order</p>
							<p className="font-semibold text-slate-900">{invoice.order?.orderNumber ?? "-"}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Toko</p>
							<p className="font-semibold text-slate-900">{invoice.storeNameSnapshot}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Barang</p>
							<p className="font-semibold text-slate-900">
								{orderItems.length} jenis / {orderItems.reduce((sum, item) => sum + item.quantity, 0)} qty
							</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Tanggal Invoice</p>
							<p className="font-semibold text-slate-900">{dateOnly(invoice.invoiceDate)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Status</p>
							<p className="font-semibold text-slate-900">{invoice.status}</p>
						</div>
					</div>
					<div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
						<div className="border-b border-slate-200 px-4 py-3">
							<p className="font-medium text-slate-900">Detail Barang Pesanan</p>
							<p className="mt-1 text-xs text-slate-500">
								Seluruh item di bawah ini akan menjadi dasar pembuatan DO dan pengecekan stok gudang.
							</p>
						</div>
						<table className="min-w-full divide-y divide-slate-200">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-3 py-2">Barang</th>
									<th className="px-3 py-2 text-right">Qty Pesanan</th>
									<th className="px-3 py-2 text-right">Stok Gudang</th>
									<th className="px-3 py-2 text-right">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{orderItems.length === 0 ? (
									<tr>
										<td colSpan={4} className="px-3 py-3 text-slate-500">
											Detail item belum tersedia dari order terkait.
										</td>
									</tr>
								) : (
									orderItems.map((item) => {
										const stock = itemStockById.get(item.id);
										const available = stock?.available ?? 0;
										const fulfilled = stock?.fulfilled ?? false;

										return (
											<tr key={item.id}>
												<td className="px-3 py-2">
													<div className="font-medium text-slate-900">
														{item.product?.name ?? "Produk belum dikenali"}
													</div>
													{item.product?.sku ? (
														<div className="text-xs text-slate-500">{item.product.sku}</div>
													) : null}
												</td>
												<td className="px-3 py-2 text-right text-slate-900">{item.quantity}</td>
												<td className="px-3 py-2 text-right font-medium text-slate-900">
													{sourceWarehouseId ? available : "-"}
												</td>
												<td className="px-3 py-2 text-right">
													<span
														title={fulfilled ? "Stok terpenuhi" : "Stok kurang"}
														aria-label={fulfilled ? "Stok terpenuhi" : "Stok kurang"}
														className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
															fulfilled
																? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
																: "bg-red-50 text-red-700 ring-1 ring-red-200"
														}`}
													>
														{fulfilled ? "✓" : "×"}
													</span>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
					<label className="block space-y-2">
						<span className="font-medium">Gudang Pengirim</span>
						<select
							className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
							value={sourceWarehouseId}
							onChange={(event) => onSourceWarehouseChange(event.target.value)}
							disabled={submitting || sourceWarehouseOptions.length === 0}
						>
							{sourceWarehouseOptions.length === 0 ? (
								<option value="">Tidak ada gudang yang stoknya cukup</option>
							) : null}
							{sourceWarehouseOptions.map((warehouse) => (
								<option key={warehouse.id} value={warehouse.id}>
									{warehouse.name} - memenuhi seluruh item
								</option>
							))}
						</select>
						<p className="text-xs text-slate-500">
							Hanya gudang yang mampu memenuhi seluruh item pesanan yang bisa dipilih. Barang rusak dan retur tidak ikut dihitung sebagai stok kirim.
						</p>
						{selectedWarehouse ? (
							<p className="text-xs text-emerald-700">
								Gudang ini siap memenuhi seluruh item pesanan dari stok aktifnya.
							</p>
						) : null}
					</label>
					<label className="block space-y-2">
						<span className="font-medium">Catatan Gudang</span>
						<textarea
							className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							placeholder="Catatan untuk DO dari invoice ini"
							disabled={submitting}
						/>
					</label>
					<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
						<button
							type="button"
							onClick={onClose}
							disabled={submitting}
							className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Tutup
						</button>
						<button
							type="button"
							onClick={() => onConfirm(invoice)}
							disabled={submitting || !sourceWarehouseId}
							className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
						>
							{submitting ? "Membuat..." : "Buat DO"}
						</button>
					</div>
				</div>
			) : null}
		</Modal>
	);
}
