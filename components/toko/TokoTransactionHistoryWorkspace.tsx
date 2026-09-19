"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import Card from "@/components/shared/Card";
import { fieldClasses } from "@/components/shared/FormInput";
import PaginationControls from "@/components/shared/PaginationControls";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import type { StatusTone } from "@/lib/ui-labels";
import { deliveryOrdersService } from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";

const dateOnly = (value?: string | null) => (value ? formatAppDate(value) : "-");

const PAGE_SIZE = 10;

type DisplayStatusKey = "FACTURIS" | "GUDANG" | "SHIPPED" | "RECEIVED" | "CANCELLED";

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

// Tahapan alur pesanan; nadanya semantik, bukan hue per status.
const statusToneByStage: Record<DisplayStatusKey, StatusTone> = {
	FACTURIS: "warning",
	GUDANG: "brand",
	SHIPPED: "brand",
	RECEIVED: "success",
	CANCELLED: "neutral",
};

const statusOptions: Array<{ value: DisplayStatusKey; label: string }> = [
	{ value: "FACTURIS", label: "Pesanan diproses fakturis" },
	{ value: "GUDANG", label: "Pesanan diproses gudang" },
	{ value: "SHIPPED", label: "Pesanan sedang dalam pengiriman" },
	{ value: "RECEIVED", label: "Pesanan sudah diterima toko" },
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
		return { statusKey: "FACTURIS", statusLabel: "Pesanan diproses fakturis" };
	}

	if (deliveryOrder?.status === "RECEIVED") {
		return { statusKey: "RECEIVED", statusLabel: "Pesanan sudah diterima toko" };
	}

	if (deliveryOrder) {
		if (deliveryOrder.status === "SHIPPED") {
			return { statusKey: "SHIPPED", statusLabel: "Pesanan sedang dalam pengiriman" };
		}
		return {
			statusKey: "GUDANG",
			statusLabel: "Pesanan diproses gudang",
		};
	}

	if (invoice?.deliveryOrder?.status === "RECEIVED") {
		return { statusKey: "RECEIVED", statusLabel: "Pesanan sudah diterima toko" };
	}

	if (invoice?.deliveryOrder) {
		if (invoice.deliveryOrder.status === "SHIPPED") {
			return { statusKey: "SHIPPED", statusLabel: "Pesanan sedang dalam pengiriman" };
		}
		return {
			statusKey: "GUDANG",
			statusLabel: "Pesanan diproses gudang",
		};
	}

	if (invoice) {
		return { statusKey: "GUDANG", statusLabel: "Pesanan diproses gudang" };
	}

	return { statusKey: "FACTURIS", statusLabel: "Pesanan diproses fakturis" };
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
			setSelectedRow(null);
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
					row.orderNumber.toLowerCase().includes(query),
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

	const columns: ResponsiveColumn<(typeof paginatedRows)[number]>[] = [
		{ key: "orderNumber", head: "Nomor Pesanan", role: "title" },
		{
			key: "status",
			head: "Status Pesanan",
			role: "status",
			render: (row) => <Badge tone={statusToneByStage[row.statusKey]}>{row.statusLabel}</Badge>,
		},
		{
			key: "totalAmount",
			head: "Total",
			role: "amount",
			align: "right",
			render: (row) => formatRupiah(row.totalAmount),
		},
		{ key: "documentDate", head: "Tanggal", render: (row) => dateOnly(row.documentDate) },
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (row) => (
				<Button variant="secondary" size="sm" onClick={() => setSelectedRow(row)}>
					Detail
				</Button>
			),
		},
	];

	return (
		<TokoFeatureLayout
			title="Riwayat Transaksi"
			basePath={basePath}
			profileName={profileName}
			profileRoleLabel={profileRoleLabel}
			salesName={salesName}
		>
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>

			<Card>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<h2 className="type-title text-slate-900">Riwayat Transaksi</h2>
						<p className="type-body mt-1 text-slate-600">
							Halaman ini menampilkan perjalanan pesanan toko. Status tagihan dibuka terpisah di menu
							Tagihan, dan halaman ini tidak lagi menganggap invoice lunas sebagai bukti barang sudah diterima.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<input
							className={fieldClasses("control", "md:w-56")}
							type="search"
							aria-label="Cari nomor pesanan"
							placeholder="Cari nomor pesanan"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
						/>
						<select
							className={fieldClasses("control", "md:w-48")}
							aria-label="Saring status transaksi"
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
					</div>
				</div>
			</Card>

			<section className="space-y-3">
				<ResponsiveTable
					columns={columns}
					data={paginatedRows}
					getRowKey={(row) => row.id}
					loading={loading}
					onRowClick={(row) => setSelectedRow(row)}
					emptyText="Tidak ada riwayat transaksi"
					emptyDescription="Coba ubah kata kunci atau filter status di atas."
				/>
				<PaginationControls
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={filteredRows.length}
					currentItemCount={paginatedRows.length}
					pageSize={PAGE_SIZE}
					itemLabel="transaksi"
					loading={loading}
					onPageChange={setPage}
				/>
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
									<p className="type-label text-slate-500">
										{item.label}
									</p>
									<p className="mt-2 font-semibold text-slate-900">{item.value}</p>
								</div>
							))}
						</div>
						<div className="rounded-xl border border-slate-200 p-4">
							<p className="type-label text-slate-500">Catatan</p>
							<p className="mt-2 text-slate-700">{selectedRow.note}</p>
						</div>
						{selectedRow.canConfirmReceipt && selectedRow.deliveryOrderId ? (
							<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
								<p className="font-semibold">Barang sudah dikirim oleh gudang.</p>
								<p className="mt-1 text-sm">
									Konfirmasi hanya jika barang untuk pesanan ini sudah diterima toko.
								</p>
							</div>
						) : selectedRow.statusKey !== "RECEIVED" && selectedRow.statusKey !== "CANCELLED" ? (
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
								Konfirmasi penerimaan tersedia setelah gudang mengirim barang.
							</div>
						) : null}
						<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<Button variant="secondary" onClick={() => setSelectedRow(null)}>
								Tutup
							</Button>
							{selectedRow.canConfirmReceipt && selectedRow.deliveryOrderId ? (
								<Button onClick={() => void handleConfirmReceipt(selectedRow)}>
									Konfirmasi Barang Diterima
								</Button>
							) : null}
						</div>
					</div>
				) : null}
			</Modal>

		</TokoFeatureLayout>
	);
}
