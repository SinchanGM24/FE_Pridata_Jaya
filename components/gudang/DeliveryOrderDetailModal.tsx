import Modal from "@/components/shared/Modal";
import type { DeliveryOrderListItem } from "@/services/delivery-orders";

type FulfillmentStep = "pick" | "pack" | "ship";

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

interface FulfillmentItem {
	productId: string;
	condition: "NEW" | "GOOD";
	quantity: number;
}

interface DeliveryOrderDetailModalProps {
	deliveryOrder: DeliveryOrderListItem | null;
	notes: string;
	submitting?: boolean;
	pickingItems: FulfillmentItem[];
	packingItems: FulfillmentItem[];
	shipmentItems: FulfillmentItem[];
	onNotesChange: (value: string) => void;
	onClose: () => void;
	onProcess: (step: FulfillmentStep, deliveryOrder: DeliveryOrderListItem) => void;
}

export default function DeliveryOrderDetailModal({
	deliveryOrder,
	notes,
	submitting = false,
	pickingItems,
	packingItems,
	shipmentItems,
	onNotesChange,
	onClose,
	onProcess,
}: DeliveryOrderDetailModalProps) {
	const orderedTotal =
		deliveryOrder?.items.reduce((sum, item) => sum + item.orderedQuantity, 0) ?? 0;
	const pickedTotal =
		deliveryOrder?.items.reduce((sum, item) => sum + item.pickedQuantity, 0) ?? 0;
	const packedTotal =
		deliveryOrder?.items.reduce((sum, item) => sum + item.packedQuantity, 0) ?? 0;
	const shippedTotal =
		deliveryOrder?.items.reduce((sum, item) => sum + item.shippedQuantity, 0) ?? 0;

	return (
		<Modal isOpen={Boolean(deliveryOrder)} onClose={onClose} title="Detail Delivery Order">
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
							<p className="font-semibold text-slate-900">{deliveryOrder.status}</p>
						</div>
					</div>

					<div className="rounded-lg border border-slate-200 bg-white p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alur Proses</p>
						<p className="mt-2 text-sm text-slate-600">
							DO ini berasal dari invoice final. Jalankan picking lebih dulu, lanjut packing, lalu shipment
							sampai barang benar-benar keluar dari gudang.
						</p>
					</div>

					<div className="grid gap-3 md:grid-cols-3">
						<div className="rounded-lg border border-slate-200 p-3">
							<p className="text-xs text-slate-500">Picking</p>
							<p className="text-lg font-semibold text-slate-900">
								{pickedTotal}/{orderedTotal}
							</p>
						</div>
						<div className="rounded-lg border border-slate-200 p-3">
							<p className="text-xs text-slate-500">Packing</p>
							<p className="text-lg font-semibold text-slate-900">
								{packedTotal}/{orderedTotal}
							</p>
						</div>
						<div className="rounded-lg border border-slate-200 p-3">
							<p className="text-xs text-slate-500">Shipping</p>
							<p className="text-lg font-semibold text-slate-900">
								{shippedTotal}/{orderedTotal}
							</p>
						</div>
					</div>

					<div className="overflow-x-auto rounded-lg border border-slate-200">
						<table className="min-w-full divide-y divide-slate-200">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-3 py-2">Barang</th>
									<th className="px-3 py-2">Kondisi</th>
									<th className="px-3 py-2 text-right">Order</th>
									<th className="px-3 py-2 text-right">Pick</th>
									<th className="px-3 py-2 text-right">Pack</th>
									<th className="px-3 py-2 text-right">Ship</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{deliveryOrder.items.map((item) => (
									<tr key={item.id}>
										<td className="px-3 py-2 font-medium text-slate-900">
											{item.product?.name ?? item.productId}
										</td>
										<td className="px-3 py-2">{item.condition}</td>
										<td className="px-3 py-2 text-right">{item.orderedQuantity}</td>
										<td className="px-3 py-2 text-right">{item.pickedQuantity}</td>
										<td className="px-3 py-2 text-right">{item.packedQuantity}</td>
										<td className="px-3 py-2 text-right">{item.shippedQuantity}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<label className="block space-y-2">
						<span className="font-medium">Catatan Shipment</span>
						<textarea
							className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							placeholder="Catatan untuk shipment"
							disabled={
								submitting ||
								deliveryOrder.status === "SHIPPED" ||
								deliveryOrder.status === "CANCELLED"
							}
						/>
					</label>

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
							onClick={() => onProcess("pick", deliveryOrder)}
							disabled={submitting || pickingItems.length === 0}
							className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Pick All
						</button>
						<button
							type="button"
							onClick={() => onProcess("pack", deliveryOrder)}
							disabled={submitting || packingItems.length === 0}
							className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Pack All
						</button>
						<button
							type="button"
							onClick={() => onProcess("ship", deliveryOrder)}
							disabled={submitting || shipmentItems.length === 0}
							className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
						>
							Ship All
						</button>
					</div>
				</div>
			) : null}
		</Modal>
	);
}
