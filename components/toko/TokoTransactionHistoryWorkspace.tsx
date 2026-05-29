"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { deliveryOrdersService } from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

const PAGE_SIZE = 10;

type DisplayStatusKey = "PENDING" | "IN_DELIVERY" | "RECEIVED" | "CANCELLED";

type WorkspaceProps = {
	basePath?: string;
	storeId?: string;
	profileName?: string;
	profileRoleLabel?: string;
	salesName?: string | null;
};

type DeliveryOrderFulfillment = {
	id: string;
	status:
		| "OPEN"
		| "PICKING"
		| "PACKING"
		| "READY_TO_SHIP"
		| "SHIPPED"
		| "RECEIVED"
		| "CANCELLED";
	receivedAt?: string | null;
	receiptNotes?: string | null;
};

type TransactionRow = {
	id: string;
	orderNumber: string;
	invoiceId?: string | null;
	invoiceNumber: string;
	documentDate: string;
	totalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	invoiceStatus?: string | null;
	statusKey: DisplayStatusKey;
	statusLabel: string;
	note: string;
	deliveryOrderId?: string | null;
	canConfirmReceipt: boolean;
};

const statusAppearance: Record<DisplayStatusKey, string> = {
	PENDING: "bg-amber-100 text-amber-800",
	IN_DELIVERY: "bg-blue-100 text-blue-800",
	RECEIVED: "bg-emerald-100 text-emerald-800",
	CANCELLED: "bg-slate-100 text-slate-600",
};

const statusOptions: Array<{ value: DisplayStatusKey; label: string }> = [
	{ value: "PENDING", label: "Pesanan sedang diproses" },
	{ value: "IN_DELIVERY", label: "Pesanan sedang diproses gudang / pengiriman" },
	{ value: "RECEIVED", label: "Konfirmasi diterima toko" },
	{ value: "CANCELLED", label: "Pesanan dibatalkan" },
];

const deriveTransactionStatus = (
	order: OrderListItem,
	invoice: InvoiceListItem | null,
	deliveryOrder: DeliveryOrderFulfillment | null,
): Pick<TransactionRow, "statusKey" | "statusLabel"> => {
	if (order.status === "CANCELLED") {
		return { statusKey: "CANCELLED", statusLabel: "Pesanan dibatalkan" };
	}

	if (order.status === "PENDING") {
		return { statusKey: "PENDING", statusLabel: "Pesanan sedang diproses" };
	}

	if (deliveryOrder?.status === "RECEIVED") {
		return { statusKey: "RECEIVED", statusLabel: "Pesanan sudah diterima toko" };
	}

	if (deliveryOrder) {
		return {
			statusKey: "IN_DELIVERY",
			statusLabel:
				deliveryOrder.status === "SHIPPED"
					? "Pesanan sedang dalam pengiriman"
					: "Pesanan diproses gudang / pengiriman",
		};
	}

	if (invoice?.deliveryOrder?.status === "RECEIVED") {
		return { statusKey: "RECEIVED", statusLabel: "Pesanan sudah diterima toko" };
	}

	if (invoice?.deliveryOrder) {
		return {
			statusKey: "IN_DELIVERY",
			statusLabel:
				invoice.deliveryOrder.status === "SHIPPED"
					? "Pesanan sedang dalam pengiriman"
					: "Pesanan diproses gudang / pengiriman",
		};
	}

	return { statusKey: "PENDING", statusLabel: "Menunggu invoice dari fakturis" };
};

export default function TokoTransactionHistoryWorkspace({
	basePath = "/toko",
	storeId,
	profileName,
	profileRoleLabel,
	salesName,
}: WorkspaceProps) {
	const [orders, setOrders] = useState<OrderListItem[]>([]);
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [deliveryOrdersByInvoiceId, setDeliveryOrdersByInvoiceId] = useState<Record<string, DeliveryOrderFulfillment | null>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [filterStatus, setFilterStatus] = useState<DisplayStatusKey | "">("");
	const [page, setPage] = useState(1);
	const [selectedRow, setSelectedRow] = useState<TransactionRow | null>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [orderResult, invoiceResult] = await Promise.all(
				storeId
					? [
							ordersService.listAllForSales({ storeId }),
							invoicesService.listAllForSales({ storeId }),
						]
					: [ordersService.listAllForToko(), invoicesService.listAllForToko()],
			);
			setOrders(orderResult);
			setInvoices(invoiceResult);
			const deliveryOrderEntries = await Promise.all(
				invoiceResult.map(async (invoice) => {
					if (invoice.deliveryOrder) {
						return [invoice.id, invoice.deliveryOrder] as const;
					}
					try {
						const deliveryOrder = await deliveryOrdersService.getByInvoiceIdForToko(invoice.id);
						return [invoice.id, deliveryOrder] as const;
					} catch {
						return [invoice.id, null] as const;
					}
				}),
			);
			setDeliveryOrdersByInvoiceId(Object.fromEntries(deliveryOrderEntries));
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat riwayat transaksi."));
		} finally {
			setLoading(false);
		}
	}, [storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadData();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [loadData]);

	const rows = useMemo(() => {
		const invoiceByOrderId = new Map(invoices.map((invoice) => [invoice.orderId, invoice]));
		return orders.map((order) => {
			const invoice = invoiceByOrderId.get(order.id) ?? null;
			const deliveryOrder = invoice ? deliveryOrdersByInvoiceId[invoice.id] ?? invoice.deliveryOrder ?? null : null;
			const status = deriveTransactionStatus(order, invoice, deliveryOrder);
			return {
				id: order.id,
				orderNumber: order.orderNumber,
				invoiceId: invoice?.id ?? null,
				invoiceNumber: invoice?.invoiceNumber ?? "-",
				documentDate: order.documentDate,
				totalAmount: order.totalAmount,
				paidAmount: invoice?.paidAmount ?? 0,
				remainingAmount: invoice?.remainingAmount ?? order.totalAmount,
				invoiceStatus: invoice?.status ?? null,
				statusKey: status.statusKey,
				statusLabel: status.statusLabel,
				deliveryOrderId: deliveryOrder?.id ?? null,
				canConfirmReceipt:
					deliveryOrder?.status === "SHIPPED",
				note:
					order.cancelReason ||
					order.notes ||
					deliveryOrder?.receiptNotes ||
					invoice?.notes ||
					"-",
			} satisfies TransactionRow;
		});
	}, [deliveryOrdersByInvoiceId, invoices, orders]);

	const handleConfirmReceipt = async (row: TransactionRow) => {
		if (!row.deliveryOrderId) return;
		setError("");
		setSuccess("");
		try {
			await deliveryOrdersService.confirmReceiptForToko(row.deliveryOrderId);
			setSuccess(`Penerimaan barang untuk ${row.orderNumber} berhasil dikonfirmasi.`);
			await loadData();
		} catch (confirmError: unknown) {
			setError(getApiErrorMessage(confirmError, "Gagal mengonfirmasi penerimaan barang."));
		}
	};

	const filteredRows = useMemo(() => {
		let result = rows;
		if (filterStatus) {
			result = result.filter((row) => row.statusKey === filterStatus);
		}
		if (search.trim()) {
			const query = search.trim().toLowerCase();
			result = result.filter(
				(row) =>
					row.orderNumber.toLowerCase().includes(query) ||
					row.invoiceNumber.toLowerCase().includes(query),
			);
		}
		return result;
	}, [filterStatus, rows, search]);
	const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const paginatedRows = useMemo(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return filteredRows.slice(start, start + PAGE_SIZE);
	}, [currentPage, filteredRows]);

	return (
		<TokoFeatureLayout
			title="Riwayat Transaksi"
			basePath={basePath}
			profileName={profileName}
			profileRoleLabel={profileRoleLabel}
			salesName={salesName}
		>
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Riwayat Transaksi</h2>
						<p className="mt-1 text-sm text-slate-600">
							Halaman ini menampilkan perjalanan pesanan toko. Status tagihan dibuka terpisah di menu
							`Tagihan`, dan halaman ini tidak lagi menganggap invoice lunas sebagai bukti barang sudah diterima.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<input
							className="w-56 rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Cari nomor pesanan / invoice"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
						/>
						<select
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={filterStatus}
							onChange={(event) => {
								setFilterStatus((event.target.value as DisplayStatusKey | "") || "");
								setPage(1);
							}}
						>
							<option value="">Semua Status</option>
							{statusOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={() => void loadData()}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Refresh
						</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
					<p>
						Menampilkan {paginatedRows.length} transaksi dari {filteredRows.length} hasil filter.
					</p>
					<p>
						Halaman {currentPage} / {totalPages}
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Nomor Pesanan</th>
							<th className="px-4 py-3">Nomor Invoice</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3">Status Pesanan</th>
							<th className="px-4 py-3">Catatan</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Memuat riwayat transaksi...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Tidak ada riwayat transaksi pada filter ini.
								</td>
							</tr>
						) : (
							paginatedRows.map((row) => (
								<tr key={row.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{row.orderNumber}</td>
									<td className="px-4 py-3 text-slate-700">{row.invoiceNumber}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(row.documentDate)}</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(row.totalAmount)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-1 text-xs font-medium ${
												statusAppearance[row.statusKey]
											}`}
										>
											{row.statusLabel}
										</span>
									</td>
									<td className="px-4 py-3 text-xs text-slate-500">{row.note}</td>
									<td className="px-4 py-3 text-right">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setSelectedRow(row)}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
											>
												Detail
											</button>
											{row.canConfirmReceipt && row.deliveryOrderId ? (
												<button
													type="button"
													onClick={() => void handleConfirmReceipt(row)}
													className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
												>
													Konfirmasi Terima
												</button>
											) : null}
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
				<div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
					<button
						type="button"
						onClick={() => setPage((current) => Math.max(1, current - 1))}
						disabled={loading || currentPage <= 1}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Sebelumnya
					</button>
					<button
						type="button"
						onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
						disabled={loading || currentPage >= totalPages}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						Berikutnya
					</button>
				</div>
			</section>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => setSelectedRow(null)}
				title="Detail Transaksi"
			>
				{selectedRow ? (
					<div className="space-y-5 text-sm text-slate-700">
						<div className="grid gap-3 md:grid-cols-2">
							{[
								{ label: "Nomor Pesanan", value: selectedRow.orderNumber },
								{ label: "Nomor Invoice", value: selectedRow.invoiceNumber },
								{ label: "Tanggal", value: dateOnly(selectedRow.documentDate) },
								{ label: "Status Pesanan", value: selectedRow.statusLabel },
								{ label: "Total Tagihan", value: formatRupiah(selectedRow.totalAmount) },
								{ label: "Sudah Dibayar", value: formatRupiah(selectedRow.paidAmount) },
								{ label: "Sisa Tagihan", value: formatRupiah(selectedRow.remainingAmount) },
								{ label: "Status Invoice", value: selectedRow.invoiceStatus || "-" },
							].map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
										{item.label}
									</p>
									<p className="mt-2 font-semibold text-slate-900">{item.value}</p>
								</div>
							))}
						</div>
						<div className="rounded-xl border border-slate-200 p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Catatan</p>
							<p className="mt-2 text-slate-700">{selectedRow.note}</p>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setSelectedRow(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								Tutup
							</button>
						</div>
					</div>
				) : null}
			</Modal>

		</TokoFeatureLayout>
	);
}
