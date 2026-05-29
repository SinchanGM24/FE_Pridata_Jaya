import Modal from "@/components/shared/Modal";
import { deliveryOrderStatusLabel, toUiLabel } from "@/lib/ui-labels";
import type { DeliveryOrderListItem } from "@/services/delivery-orders";

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

interface FulfillmentItem {
	productId: string;
	condition: "GOOD";
	quantity: number;
}

interface DeliveryOrderDetailModalProps {
	deliveryOrder: DeliveryOrderListItem | null;
	notes: string;
	shippingWarehouseName: string;
	driverName: string;
	submitting?: boolean;
	shipmentItems: FulfillmentItem[];
	shipmentBlockedReason?: string;
	onNotesChange: (value: string) => void;
	onDriverNameChange: (value: string) => void;
	onClose: () => void;
	onProcess: (deliveryOrder: DeliveryOrderListItem) => void;
}

export default function DeliveryOrderDetailModal({
	deliveryOrder,
	notes,
	shippingWarehouseName,
	driverName,
	submitting = false,
	shipmentItems,
	shipmentBlockedReason,
	onNotesChange,
	onDriverNameChange,
	onClose,
	onProcess,
}: DeliveryOrderDetailModalProps) {
	const orderedTotal =
		deliveryOrder?.items.reduce((sum, item) => sum + item.orderedQuantity, 0) ?? 0;
	const isReadOnly =
		deliveryOrder?.status === "SHIPPED" ||
		deliveryOrder?.status === "RECEIVED" ||
		deliveryOrder?.status === "CANCELLED";

	return (
		<Modal isOpen={Boolean(deliveryOrder)} onClose={onClose} title="Detail Surat Jalan">
			{deliveryOrder ? (
				<div className="space-y-4 text-sm text-slate-700">
					<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
						<div>
							<p className="text-xs text-slate-500">Nomor DO</p>
							<p className="font-semibold text-slate-900">
								{deliveryOrder.deliveryOrderNumber}
							</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Tanggal</p>
							<p className="font-semibold text-slate-900">
								{dateOnly(deliveryOrder.documentDate)}
							</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Toko</p>
							<p className="font-semibold text-slate-900">
								{deliveryOrder.storeNameSnapshot}
							</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Status</p>
							<p className="font-semibold text-slate-900">
								{toUiLabel(deliveryOrder.status, deliveryOrderStatusLabel)}
							</p>
						</div>
					</div>

					<div className="rounded-lg border border-slate-200 bg-white p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alur Proses</p>
						<p className="mt-2 text-sm text-slate-600">
							DO ini berasal dari invoice final. Gudang cukup memastikan driver terisi dan stok gudang
							pengirim mencukupi, lalu proses kirim akan langsung mencatat barang keluar dari gudang.
						</p>
					</div>

					<div className="grid gap-3">
						<div className="rounded-lg border border-slate-200 p-3">
							<p className="text-xs text-slate-500">Total Pesanan</p>
							<p className="text-lg font-semibold text-slate-900">
								{orderedTotal}
							</p>
						</div>
					</div>

					<div className="overflow-x-auto rounded-lg border border-slate-200">
						<table className="min-w-full divide-y divide-slate-200">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-3 py-2">Barang</th>
										<th className="px-3 py-2 text-right">Qty</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
								{deliveryOrder.items.map((item) => (
									<tr key={item.id}>
										<td className="px-3 py-2 font-medium text-slate-900">
											{item.product?.name ?? item.productId}
										</td>
										<td className="px-3 py-2 text-right">{item.orderedQuantity}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<label className="block space-y-2">
						<span className="font-medium">Gudang Pengirim</span>
						<input
							className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
							value={shippingWarehouseName}
							placeholder="Gudang asal pengiriman"
							disabled
						/>
					</label>

					<label className="block space-y-2">
						<span className="font-medium">Nama Driver</span>
						<input
							className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
							value={driverName}
							onChange={(event) => onDriverNameChange(event.target.value)}
							placeholder="Nama driver / kurir"
							disabled={
								submitting ||
								isReadOnly
							}
						/>
					</label>

					<label className="block space-y-2">
						<span className="font-medium">Catatan Pengiriman</span>
						<textarea
							className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							placeholder="Catatan untuk pengiriman"
							disabled={
								submitting ||
								isReadOnly
							}
						/>
					</label>

					{shipmentBlockedReason ? (
						<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
							{shipmentBlockedReason}
						</div>
					) : null}

					<div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
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
							onClick={() => onProcess(deliveryOrder)}
							disabled={submitting || shipmentItems.length === 0 || Boolean(shipmentBlockedReason)}
							className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
						>
							{submitting ? "Memproses..." : "Kirim"}
						</button>
					</div>
				</div>
			) : null}
		</Modal>
	);
}
