"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import PaginationControls from "@/components/shared/PaginationControls";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { deliveryOrderStatusLabel, invoiceDraftStatusLabel, invoiceStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { type DeliveryOrderStatus } from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import {
	invoiceDraftsService,
	type InvoiceDraftItem,
	type InvoiceDraftListItem,
} from "@/services/invoice-drafts";
import { ordersService, type OrderItem, type OrderListItem } from "@/services/orders";
import { formatRupiah } from "@/lib/format";


const dateOnly = (value?: string | null) => String(value || "").slice(0, 10);

const getErrorMessage = (error: unknown, fallback: string) => {
	if (error instanceof Error && error.message) return error.message;
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: unknown }).response === "object" &&
		(error as { response?: { data?: { message?: string } } }).response?.data?.message
	) {
		return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
	}
	return fallback;
};

type FakturisTimelineItem =
	| {
			id: string;
			number: string;
			kind: "invoice";
			customer: string;
			date: string;
			totalAmount: number;
			status: string;
			orderNumber?: string | null;
			orderId?: string | null;
			dueDate?: string | null;
			deliveryOrderId?: string | null;
			deliveryOrderNumber?: string | null;
			deliveryOrderStatus?: DeliveryOrderStatus | null;
			raw: InvoiceListItem;
	  }
	| {
			id: string;
			number: string;
			kind: "draft";
			customer: string;
			date: string;
			totalAmount: number;
			status: string;
			orderNumber?: string | null;
			orderId?: string | null;
			dueDate?: string | null;
			deliveryOrderId?: string | null;
			deliveryOrderNumber?: string | null;
			deliveryOrderStatus?: DeliveryOrderStatus | null;
			raw: InvoiceDraftListItem;
	  }
	| {
			id: string;
			number: string;
			kind: "order";
			customer: string;
			date: string;
			totalAmount: number;
			status: string;
			orderNumber?: string | null;
			orderId?: string | null;
			dueDate?: string | null;
			deliveryOrderId?: string | null;
			deliveryOrderNumber?: string | null;
			deliveryOrderStatus?: DeliveryOrderStatus | null;
			raw: OrderListItem;
	  };

type TransactionView = "accepted" | "rejected";
interface TransactionDetailItem {
	id: string;
	productName: string;
	sku?: string | null;
	condition: string;
	quantity: number;
	unitPrice: number;
	subtotal: number;
}

const PAGE_SIZE = 10;

const canPrintFinalInvoice = (item: FakturisTimelineItem) =>
	item.kind === "invoice" &&
	item.status !== "CANCELLED" &&
	Boolean(item.deliveryOrderId) &&
	item.deliveryOrderStatus !== "CANCELLED";

const getWarehouseProcessStatus = (item: FakturisTimelineItem) => {
	if (item.kind !== "invoice") {
		return {
			label: "Tidak Diproses Gudang",
			badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
		};
	}

	if (!item.deliveryOrderId) {
		return {
			label: "Belum Diproses Gudang",
			badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
		};
	}

	if (item.deliveryOrderStatus === "CANCELLED") {
		return {
			label: "Proses Gudang Dibatalkan",
			badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
		};
	}

	return {
		label: "Sudah Diproses Gudang",
		badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
	};
};

const mapOrderItemToDetailItem = (item: OrderItem): TransactionDetailItem => ({
	id: item.id,
	productName: item.product?.name ?? "Produk",
	sku: item.product?.sku ?? null,
	condition: item.condition,
	quantity: item.quantity,
	unitPrice: item.unitPriceSnapshot,
	subtotal: item.subtotal,
});

const mapDraftItemToDetailItem = (item: InvoiceDraftItem): TransactionDetailItem => ({
	id: item.id,
	productName: item.productNameSnapshot || "Produk",
	sku: null,
	condition: item.condition,
	quantity: item.quantity,
	unitPrice: item.unitPriceSnapshot,
	subtotal: item.subtotal,
});

export default function RiwayatTransaksiPage() {
	const [rows, setRows] = useState<FakturisTimelineItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [fromDate, setFromDate] = useState("");
	const [untilDate, setUntilDate] = useState("");
	const [selected, setSelected] = useState<FakturisTimelineItem | null>(null);
	const [selectedItems, setSelectedItems] = useState<TransactionDetailItem[]>([]);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState("");
	const [printError, setPrintError] = useState("");
	const [printingInvoiceId, setPrintingInvoiceId] = useState<string | null>(null);
	const [transactionView, setTransactionView] = useState<TransactionView>("accepted");
	const [currentPage, setCurrentPage] = useState(1);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			// The delivery order travels with each invoice, so there is no separate
			// list to fetch and join here.
			const [invoices, drafts, cancelledOrders] = await Promise.all([
				invoicesService.list({ page: 1, limit: 100 }),
				invoiceDraftsService.list({ page: 1, limit: 100 }),
				ordersService.listAll({ status: "CANCELLED" }),
			]);

			const rejectedDrafts = drafts.items.filter((draft) => draft.status === "CANCELLED");
			const acceptedInvoices = invoices.items.filter((invoice) => invoice.status !== "CANCELLED");
			const rejectedInvoices = invoices.items.filter((invoice) => invoice.status === "CANCELLED");
			const rejectedDocumentOrderIds = new Set(
				[
					...rejectedDrafts.map((draft) => draft.orderId),
					...rejectedInvoices.map((invoice) => invoice.orderId),
				].filter(Boolean) as string[],
			);
			const rejectedOrders = cancelledOrders.filter((order) => !rejectedDocumentOrderIds.has(order.id));

			const timelineRows: FakturisTimelineItem[] = [
				...rejectedOrders.map((order) => ({
					id: order.id,
					number: order.orderNumber,
					kind: "order" as const,
					customer: order.storeNameSnapshot,
					date: order.cancelledAt ?? order.documentDate,
					totalAmount: order.totalAmount,
					status: order.status,
					dueDate: null,
					orderNumber: order.orderNumber,
					orderId: order.id,
					deliveryOrderId: null,
					deliveryOrderNumber: null,
					deliveryOrderStatus: null,
					raw: order,
				})),
				...rejectedDrafts.map((draft) => ({
					id: draft.id,
					number: draft.draftNumber,
					kind: "draft" as const,
					customer: draft.storeNameSnapshot,
					date: draft.draftDate,
					totalAmount: draft.totalAmount,
					status: draft.status,
					dueDate: draft.dueDate ?? null,
					orderNumber: null,
					orderId: draft.orderId,
					deliveryOrderId: null,
					deliveryOrderNumber: null,
					deliveryOrderStatus: null,
					raw: draft,
				})),
				...acceptedInvoices.map((invoice) => {
					const deliveryOrder = invoice.deliveryOrder;
					return {
						id: invoice.id,
						number: invoice.invoiceNumber,
						kind: "invoice" as const,
						customer: invoice.storeNameSnapshot,
						date: invoice.invoiceDate,
						totalAmount: invoice.totalAmount,
						status: invoice.status,
						dueDate: invoice.dueDate ?? null,
						orderNumber: invoice.order?.orderNumber ?? null,
						orderId: invoice.orderId,
						deliveryOrderId: deliveryOrder?.id ?? null,
						deliveryOrderNumber: deliveryOrder?.deliveryOrderNumber ?? null,
						deliveryOrderStatus: deliveryOrder?.status ?? null,
						raw: invoice,
					};
				}),
				...rejectedInvoices.map((invoice) => {
					const deliveryOrder = invoice.deliveryOrder;
					return {
						id: invoice.id,
						number: invoice.invoiceNumber,
						kind: "invoice" as const,
						customer: invoice.storeNameSnapshot,
						date: invoice.invoiceDate,
						totalAmount: invoice.totalAmount,
						status: invoice.status,
						dueDate: invoice.dueDate ?? null,
						orderNumber: invoice.order?.orderNumber ?? null,
						orderId: invoice.orderId,
						deliveryOrderId: deliveryOrder?.id ?? null,
						deliveryOrderNumber: deliveryOrder?.deliveryOrderNumber ?? null,
						deliveryOrderStatus: deliveryOrder?.status ?? null,
						raw: invoice,
					};
				}),
			].sort((a, b) => (a.date < b.date ? 1 : -1));
			setRows(timelineRows);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat riwayat transaksi."));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [load]);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return rows.filter((item) => {
			const matchView =
				transactionView === "accepted"
					? item.kind === "invoice" && item.status !== "CANCELLED"
					: item.status === "CANCELLED";
			const matchSearch =
				!query ||
				item.number.toLowerCase().includes(query) ||
				item.customer.toLowerCase().includes(query) ||
				String(item.orderNumber ?? "").toLowerCase().includes(query);
			const docDate = dateOnly(item.date);
			const matchFrom = !fromDate || docDate >= fromDate;
			const matchUntil = !untilDate || docDate <= untilDate;
			return matchView && matchSearch && matchFrom && matchUntil;
		});
	}, [rows, search, fromDate, transactionView, untilDate]);

	const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
	const safeCurrentPage = Math.min(currentPage, totalPages);
	const paginatedRows = useMemo(() => {
		const start = (safeCurrentPage - 1) * PAGE_SIZE;
		return filteredRows.slice(start, start + PAGE_SIZE);
	}, [filteredRows, safeCurrentPage]);

	const openDetail = async (item: FakturisTimelineItem) => {
		setSelected(item);
		setSelectedItems([]);
		setDetailError("");
		setPrintError("");
		setDetailLoading(true);
		try {
			if (item.kind === "draft") {
				const detail = await invoiceDraftsService.getById(item.id);
				setSelectedItems(detail.items.map(mapDraftItemToDetailItem));
				return;
			}

			if (!item.orderId) {
				setSelectedItems([]);
				return;
			}

			const order = await ordersService.getById(item.orderId);
			setSelectedItems((order.items ?? []).map(mapOrderItemToDetailItem));
		} catch (error: unknown) {
			setDetailError(getErrorMessage(error, "Gagal memuat rincian item transaksi."));
		} finally {
			setDetailLoading(false);
		}
	};

	const printFinalInvoice = async (invoice: FakturisTimelineItem) => {
		if (!canPrintFinalInvoice(invoice)) {
			setPrintError("Faktur hanya dapat dicetak setelah diproses gudang dan proses gudang tidak dibatalkan.");
			return;
		}

		const previewWindow = window.open("", "_blank");
		if (!previewWindow) {
			setPrintError("Popup diblokir browser. Izinkan popup untuk membuka faktur cetak.");
			return;
		}

		previewWindow.opener = null;
		previewWindow.document.title = `Menyiapkan ${invoice.number}`;
		previewWindow.document.body.innerHTML =
			'<p style="font-family: sans-serif; padding: 24px">Menyiapkan faktur final...</p>';
		setPrintingInvoiceId(invoice.id);
		setPrintError("");

		try {
			const pdf = await invoicesService.exportPdf(invoice.id);
			const pdfUrl = URL.createObjectURL(pdf);
			previewWindow.location.replace(pdfUrl);
			window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
		} catch (error: unknown) {
			previewWindow.close();
			setPrintError(getErrorMessage(error, "Gagal menyiapkan faktur final untuk dicetak."));
		} finally {
			setPrintingInvoiceId(null);
		}
	};

	return (
		<FeaturePage
			title="Riwayat Transaksi"
			description="Pantau invoice final dan invoice yang ditolak dari proses fakturis."
		>

			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="rounded-xl border border-gray-200 bg-white p-4">
				<div className="mb-4 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => {
							setTransactionView("accepted");
							setCurrentPage(1);
						}}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
							transactionView === "accepted"
								? "bg-emerald-600 text-white"
								: "border border-slate-300 text-slate-700 hover:bg-slate-50"
						}`}
					>
						Invoice Final
					</button>
					<button
						type="button"
						onClick={() => {
							setTransactionView("rejected");
							setCurrentPage(1);
						}}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
							transactionView === "rejected"
								? "bg-rose-600 text-white"
								: "border border-slate-300 text-slate-700 hover:bg-slate-50"
						}`}
					>
						Ditolak / Dibatalkan
					</button>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
					<input
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setCurrentPage(1);
						}}
						placeholder={
									transactionView === "accepted"
										? "Cari invoice, order, atau pelanggan"
										: "Cari dokumen ditolak atau pelanggan"
						}
						className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
					/>
					<div>
						<label className="mb-1 block text-xs text-gray-500">Dari Tanggal</label>
						<input
							type="date"
							value={fromDate}
							onChange={(e) => {
								setFromDate(e.target.value);
								setCurrentPage(1);
							}}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-gray-500">Sampai Tanggal</label>
						<input
							type="date"
							value={untilDate}
							onChange={(e) => {
								setUntilDate(e.target.value);
								setCurrentPage(1);
							}}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
						/>
					</div>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
				<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
					<div>
						<h2 className="text-lg font-semibold text-gray-900">Daftar Transaksi</h2>
					</div>
					<span className="text-sm text-gray-500">Total: {filteredRows.length}</span>
				</div>
				<div className="overflow-auto">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Nomor Dokumen</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Pelanggan</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Tanggal</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Status Gudang</th>
								<th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
								<th className="px-4 py-3 text-right font-medium text-gray-600">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-gray-600" colSpan={6}>
										Memuat...
									</td>
								</tr>
							) : filteredRows.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-gray-600" colSpan={6}>
										Tidak ada data transaksi.
									</td>
								</tr>
							) : (
								paginatedRows.map((item) => {
									const warehouseStatus = getWarehouseProcessStatus(item);
									return (
										<tr key={item.id} className="hover:bg-gray-50">
											<td className="px-4 py-3 font-medium text-gray-900">
												<div>{item.number}</div>
												<div className="mt-1 text-xs text-gray-500">
													{item.kind === "draft" ? "Dokumen draft" : "Dokumen final"}
												</div>
											</td>
											<td className="px-4 py-3 text-gray-700">{item.customer}</td>
											<td className="px-4 py-3 text-gray-700">{dateOnly(item.date)}</td>
											<td className="px-4 py-3">
												<span
													className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${warehouseStatus.badgeClassName}`}
												>
													{warehouseStatus.label}
												</span>
											</td>
											<td className="px-4 py-3 text-right text-gray-900">
												{formatRupiah(item.totalAmount)}
											</td>
											<td className="px-4 py-3">
												<div className="flex justify-end gap-2">
													<button
														onClick={() => void openDetail(item)}
														className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
													>
														Detail
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
				{filteredRows.length > 0 ? (
					<PaginationControls
						currentPage={safeCurrentPage}
						totalPages={totalPages}
						totalItems={filteredRows.length}
						currentItemCount={paginatedRows.length}
						pageSize={PAGE_SIZE}
						itemLabel="transaksi"
						onPageChange={setCurrentPage}
					/>
				) : null}
			</div>

			<Modal
				isOpen={Boolean(selected)}
				onClose={() => {
					setSelected(null);
					setPrintError("");
				}}
				title="Detail Transaksi"
				maxWidthClassName="max-w-5xl"
			>
				{selected ? (
				<div className="space-y-4">
					<div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="mt-1 text-sm text-gray-600">{selected.number}</p>
						</div>
						{canPrintFinalInvoice(selected) ? (
							<button
								type="button"
								onClick={() => void printFinalInvoice(selected)}
								disabled={printingInvoiceId === selected.id}
								className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{printingInvoiceId === selected.id ? "Menyiapkan PDF..." : "Cetak Faktur Final"}
							</button>
						) : null}
					</div>
					{printError ? (
						<div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
							{printError}
						</div>
					) : null}
					<div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
						<div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
							<div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Pelanggan</div>
								<div className="mt-2 font-semibold text-gray-900">{selected.customer}</div>
							</div>
							<div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Tanggal</div>
								<div className="mt-2 font-semibold text-gray-900">{dateOnly(selected.date)}</div>
							</div>
							<div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Jatuh Tempo</div>
								<div className="mt-2 font-semibold text-gray-900">{dateOnly(selected.dueDate)}</div>
							</div>
							<div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Jenis Dokumen</div>
								<div className="mt-2 font-semibold text-gray-900">
									{selected.kind === "draft"
										? "Invoice Draft"
										: selected.kind === "order"
											? "Pesanan Dibatalkan"
											: "Invoice Final"}
								</div>
							</div>
							<div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Status Dokumen</div>
								<div className="mt-2 font-semibold text-gray-900">
									{selected.kind === "draft"
										? toUiLabel(selected.status, invoiceDraftStatusLabel)
										: toUiLabel(selected.status, invoiceStatusLabel)}
								</div>
							</div>
							<div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Order Asal</div>
								<div className="mt-2 font-semibold text-gray-900">{selected.orderNumber ?? "-"}</div>
							</div>
						</div>
						<div className="space-y-3">
							<div className="rounded-2xl bg-indigo-700 p-5 text-white">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-300">Nilai Dokumen</div>
								<div className="mt-3 text-3xl font-semibold">{formatRupiah(selected.totalAmount)}</div>
							</div>
							<div className="rounded-2xl border border-gray-200 bg-white p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Dokumen Gudang</div>
								<div className="mt-2 font-semibold text-gray-900">
									{selected.kind === "order"
										? "Tidak diteruskan ke gudang"
										: selected.deliveryOrderNumber ?? "Belum diteruskan ke gudang"}
								</div>
								{selected.kind === "order" ? (
									<div className="mt-2 text-sm text-gray-500">
										Pesanan dibatalkan sebelum menjadi invoice final.
									</div>
								) : selected.deliveryOrderNumber ? (
									<div className="mt-2 text-sm text-gray-500">
										Status gudang:{" "}
										{toUiLabel(
											selected.deliveryOrderStatus,
											deliveryOrderStatusLabel,
										)}
									</div>
								) : (
									<div className="mt-2 text-sm text-gray-500">
										Fakturis sudah selesai, dokumen tinggal menunggu proses gudang.
									</div>
								)}
							</div>
						</div>
					</div>
					<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
						<div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
							<h3 className="font-semibold text-gray-900">Rincian Pesanan</h3>
						</div>
						<table className="min-w-full divide-y divide-gray-200 text-sm">
							<thead className="bg-white text-left text-xs uppercase tracking-[0.16em] text-gray-500">
								<tr>
									<th className="px-4 py-3">Barang</th>
									<th className="px-4 py-3 text-right">Qty</th>
									<th className="px-4 py-3 text-right">Harga</th>
									<th className="px-4 py-3 text-right">Total</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{detailLoading ? (
									<tr>
										<td className="px-4 py-4 text-gray-600" colSpan={4}>
											Memuat rincian pesanan...
										</td>
									</tr>
								) : detailError ? (
									<tr>
										<td className="px-4 py-4 text-rose-700" colSpan={4}>
											{detailError}
										</td>
									</tr>
								) : selectedItems.length === 0 ? (
									<tr>
										<td className="px-4 py-4 text-gray-600" colSpan={4}>
											Rincian item belum tersedia untuk transaksi ini.
										</td>
									</tr>
								) : (
									selectedItems.map((item) => (
										<tr key={item.id}>
											<td className="px-4 py-3">
												<div className="font-medium text-gray-900">{item.productName}</div>
												{item.sku ? <div className="text-xs text-gray-500">{item.sku}</div> : null}
											</td>
											<td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
											<td className="px-4 py-3 text-right text-gray-700">
												{formatRupiah(item.unitPrice)}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-gray-900">
												{formatRupiah(item.subtotal)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
