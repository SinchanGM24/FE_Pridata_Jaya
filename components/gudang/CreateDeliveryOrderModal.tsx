import Modal from "@/components/shared/Modal";
import type { InvoiceListItem } from "@/services/invoices";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

interface CreateDeliveryOrderModalProps {
	invoice: InvoiceListItem | null;
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
							<p className="text-xs text-slate-500">Total</p>
							<p className="font-semibold text-slate-900">{formatRupiah(invoice.totalAmount)}</p>
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
									{warehouse.name} - stok siap {warehouse.totalAvailable}
								</option>
							))}
						</select>
						<p className="text-xs text-slate-500">
							Hanya gudang dengan stok jual yang cukup yang bisa dipilih. Barang rusak dan retur tidak ikut dihitung sebagai stok kirim.
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
							className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{submitting ? "Membuat..." : "Buat DO"}
						</button>
					</div>
				</div>
			) : null}
		</Modal>
	);
}
