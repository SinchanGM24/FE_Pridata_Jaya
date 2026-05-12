import Modal from "@/components/shared/Modal";
import type { OrderListItem } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

interface OrderDetailModalProps {
	order: OrderListItem | null;
	actionLabel?: string;
	secondaryActionLabel?: string;
	actionDisabled?: boolean;
	onClose: () => void;
	onPrimaryAction?: (order: OrderListItem) => void;
	onSecondaryAction?: (order: OrderListItem) => void;
}

export default function OrderDetailModal({
	order,
	actionLabel,
	secondaryActionLabel,
	actionDisabled = false,
	onClose,
	onPrimaryAction,
	onSecondaryAction,
}: OrderDetailModalProps) {
	return (
		<Modal isOpen={Boolean(order)} onClose={onClose} title="Detail Pesanan">
			{order ? (
				<div className="space-y-4 text-sm text-slate-700">
					<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
						<div>
							<p className="text-xs text-slate-500">Nomor Order</p>
							<p className="font-semibold text-slate-900">{order.orderNumber}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Tanggal</p>
							<p className="font-semibold text-slate-900">{dateOnly(order.documentDate)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Toko</p>
							<p className="font-semibold text-slate-900">{order.storeNameSnapshot}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Status</p>
							<p className="font-semibold text-slate-900">{order.status}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Total</p>
							<p className="font-semibold text-slate-900">{formatRupiah(order.totalAmount)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Catatan</p>
							<p className="font-semibold text-slate-900">{order.notes || "-"}</p>
						</div>
					</div>

					<div className="overflow-x-auto rounded-lg border border-slate-200">
						<table className="min-w-full divide-y divide-slate-200">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-3 py-2">Barang</th>
									<th className="px-3 py-2">Kondisi</th>
									<th className="px-3 py-2 text-right">Qty</th>
									<th className="px-3 py-2 text-right">Harga</th>
									<th className="px-3 py-2 text-right">Subtotal</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{order.items?.length ? (
									order.items.map((item) => (
										<tr key={item.id}>
											<td className="px-3 py-2 font-medium text-slate-900">
												{item.product?.name ?? item.productId}
											</td>
											<td className="px-3 py-2">{item.condition}</td>
											<td className="px-3 py-2 text-right">{item.quantity}</td>
											<td className="px-3 py-2 text-right">
												{formatRupiah(item.unitPriceSnapshot)}
											</td>
											<td className="px-3 py-2 text-right">{formatRupiah(item.subtotal)}</td>
										</tr>
									))
								) : (
									<tr>
										<td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
											Detail item belum tersedia.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>
							Tutup
						</button>
						{secondaryActionLabel && onSecondaryAction ? (
							<button
								type="button"
								onClick={() => onSecondaryAction(order)}
								disabled={actionDisabled}
								className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
							>
								{secondaryActionLabel}
							</button>
						) : null}
						{actionLabel && onPrimaryAction ? (
							<button
								type="button"
								onClick={() => onPrimaryAction(order)}
								disabled={actionDisabled}
								className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
							>
								{actionLabel}
							</button>
						) : null}
					</div>
				</div>
			) : null}
		</Modal>
	);
}
