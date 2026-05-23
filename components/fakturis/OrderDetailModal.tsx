import Modal from "@/components/shared/Modal";
import type { OrderListItem } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");
const orderStatusLabel = (status: string) => {
	if (status === "PENDING") return "Menunggu Verifikasi";
	if (status === "PROCESSED") return "Siap Invoice";
	if (status === "CANCELLED") return "Dibatalkan";
	return status;
};

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
		<Modal isOpen={Boolean(order)} onClose={onClose} title="Detail Pesanan" maxWidthClassName="max-w-3xl">
			{order ? (
				<div className="space-y-4 text-sm text-slate-700">
					<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
						<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div className="min-w-0">
								<p className="text-xs font-semibold uppercase text-slate-500">Nomor Order</p>
								<p className="mt-1 text-base font-semibold text-slate-900">{order.orderNumber}</p>
								<p className="mt-1 text-sm text-slate-600">{order.storeNameSnapshot}</p>
							</div>
							<div className="text-left md:text-right">
								<p className="text-xs font-semibold uppercase text-slate-500">Total Pesanan</p>
								<p className="mt-1 text-lg font-semibold text-slate-900">{formatRupiah(order.totalAmount)}</p>
								<p className="mt-1 text-xs text-slate-500">
									{dateOnly(order.documentDate)} · {orderStatusLabel(order.status)}
								</p>
							</div>
						</div>
						{order.notes ? (
							<div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
								<span className="font-medium text-slate-800">Catatan:</span> {order.notes}
							</div>
						) : null}
					</div>

					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-semibold text-slate-900">Item Pesanan</h4>
							<span className="text-xs text-slate-500">
								{order.items?.length ?? 0} baris item
							</span>
						</div>
						{order.items?.length ? (
							<div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
								<table className="min-w-full text-sm">
									<thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold text-slate-500">
										<tr>
											<th className="px-3 py-2">Produk</th>
											<th className="px-3 py-2 text-right">Qty</th>
											<th className="px-3 py-2 text-right">Harga</th>
											<th className="px-3 py-2 text-right">Subtotal</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 bg-white">
										{order.items.map((item) => (
											<tr key={item.id}>
												<td className="px-3 py-2 font-medium text-slate-900">
													{item.product?.name ?? item.productId}
												</td>
												<td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
												<td className="px-3 py-2 text-right text-slate-700">
													{formatRupiah(item.unitPriceSnapshot)}
												</td>
												<td className="px-3 py-2 text-right font-semibold text-slate-900">
													{formatRupiah(item.subtotal)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-500">
								Detail item belum tersedia.
							</div>
						)}
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
