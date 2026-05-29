"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { deliveryOrderStatusLabel, invoiceDraftStatusLabel, invoiceStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { deliveryOrdersService } from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import {
	invoiceDraftsService,
	type InvoiceDraftItem,
	type InvoiceDraftListItem,
} from "@/services/invoice-drafts";
import { ordersService, type OrderItem } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10);

const getErrorMessage = (error: unknown, fallback: string) => {
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
			raw: InvoiceDraftListItem;
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

const mapOrderItemToDetailItem = (item: OrderItem): TransactionDetailItem => ({
	id: item.id,
	productName: item.product?.name ?? item.productId,
	sku: item.product?.sku ?? null,
	condition: item.condition,
	quantity: item.quantity,
	unitPrice: item.unitPriceSnapshot,
	subtotal: item.subtotal,
});

const mapDraftItemToDetailItem = (item: InvoiceDraftItem): TransactionDetailItem => ({
	id: item.id,
	productName: item.productNameSnapshot,
	sku: item.productId,
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
	const [transactionView, setTransactionView] = useState<TransactionView>("accepted");
	const [currentPage, setCurrentPage] = useState(1);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [invoices, drafts, deliveryOrders] = await Promise.all([
				invoicesService.list({ page: 1, limit: 100 }),
				invoiceDraftsService.list({ page: 1, limit: 100 }),
				deliveryOrdersService.list({ page: 1, limit: 100 }),
			]);

			const deliveryOrderByInvoiceId = new Map(
				deliveryOrders.items
					.filter((item) => item.invoiceId)
					.map((item) => [item.invoiceId as string, item] as const),
			);

			const rejectedDrafts = drafts.items.filter((draft) => draft.status === "CANCELLED");
			const acceptedInvoices = invoices.items.filter((invoice) => invoice.status !== "CANCELLED");
			const rejectedInvoices = invoices.items.filter((invoice) => invoice.status === "CANCELLED");

			const timelineRows: FakturisTimelineItem[] = [
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
					raw: draft,
				})),
				...acceptedInvoices.map((invoice) => {
					const deliveryOrder = deliveryOrderByInvoiceId.get(invoice.id);
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
						raw: invoice,
					};
				}),
				...rejectedInvoices.map((invoice) => {
					const deliveryOrder = deliveryOrderByInvoiceId.get(invoice.id);
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

	const summary = useMemo(
		() => ({
			accepted: rows.filter((item) => item.kind === "invoice" && item.status !== "CANCELLED").length,
			rejected: rows.filter((item) => item.status === "CANCELLED").length,
			readyForWarehouse: rows.filter(
				(item) => item.kind === "invoice" && item.status !== "CANCELLED" && !item.deliveryOrderId,
			).length,
			sentToWarehouse: rows.filter(
				(item) => item.kind === "invoice" && item.status !== "CANCELLED" && Boolean(item.deliveryOrderId),
			).length,
		}),
		[rows],
	);

	const openDetail = async (item: FakturisTimelineItem) => {
		setSelected(item);
		setSelectedItems([]);
		setDetailError("");
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

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Riwayat Transaksi</h1>
					<p className="mt-2 max-w-3xl text-gray-600">
						Mengikuti pola FE1, riwayat utama hanya menampilkan transaksi yang berhasil. Dokumen yang
						ditolak dipisahkan ke filter terpisah agar operator fokus ke hasil akhir transaksi.
					</p>
				</div>
				<Link
					href="/fakturis/pembuatan-invoice"
					className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				>
					Kembali ke Workspace Invoice
				</Link>
			</div>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Transaksi Diterima", value: summary.accepted },
					{ label: "Transaksi Ditolak", value: summary.rejected },
					{ label: "Siap ke Gudang", value: summary.readyForWarehouse },
					{ label: "Sudah ke Gudang", value: summary.sentToWarehouse },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

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
						Transaksi Diterima
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
						Transaksi Ditolak
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
				<div className="mt-3 flex justify-end">
					<button
						onClick={() => void load()}
						disabled={loading}
						className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
				<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
					<div>
						<h2 className="text-lg font-semibold text-gray-900">Daftar Transaksi</h2>
						<p className="text-sm text-gray-500">
							{transactionView === "accepted"
								? "Hanya transaksi berhasil yang tampil di sini. Invoice final bisa langsung diteruskan ke gudang."
								: "Dokumen yang ditolak dipisahkan dari riwayat utama agar audit lebih rapi."}
						</p>
					</div>
					<span className="text-sm text-gray-500">Total: {filteredRows.length}</span>
				</div>
				<div className="overflow-auto">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Nomor Dokumen</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Jenis</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Pelanggan</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Tanggal</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Ringkasan</th>
								<th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
								<th className="px-4 py-3 text-right font-medium text-gray-600">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-gray-600" colSpan={7}>
										Memuat...
									</td>
								</tr>
							) : filteredRows.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-gray-600" colSpan={7}>
										Tidak ada data transaksi.
									</td>
								</tr>
							) : (
								paginatedRows.map((item) => (
										<tr key={item.id} className="hover:bg-gray-50">
											<td className="px-4 py-3 font-medium text-gray-900">
												<div>{item.number}</div>
												<div className="mt-1 text-xs text-gray-500">
													{item.kind === "draft" ? "Dokumen draft" : "Dokumen final"}
												</div>
											</td>
											<td className="px-4 py-3 text-gray-700">
												<span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
													{item.kind === "draft" ? "Draft" : "Invoice"}
												</span>
											</td>
											<td className="px-4 py-3 text-gray-700">{item.customer}</td>
											<td className="px-4 py-3 text-gray-700">{dateOnly(item.date)}</td>
											<td className="px-4 py-3 text-gray-700">
												<div className="space-y-1">
													<div>Jatuh tempo {dateOnly(item.dueDate)}</div>
													<div className="text-xs text-gray-500">
														{item.kind === "invoice"
															? item.deliveryOrderNumber
																? `Gudang: ${item.deliveryOrderNumber}`
																: "Belum diteruskan ke gudang"
															: item.status === "CANCELLED"
																? "Draft ditolak"
																: "Draft masih aktif"}
													</div>
												</div>
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
									))
							)}
						</tbody>
					</table>
				</div>
				{filteredRows.length > 0 ? (
					<div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
						<span>
							Menampilkan {(safeCurrentPage - 1) * PAGE_SIZE + 1}-
							{Math.min(safeCurrentPage * PAGE_SIZE, filteredRows.length)} dari {filteredRows.length} data
						</span>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
								disabled={safeCurrentPage <= 1}
								className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
							>
								Sebelumnya
							</button>
							<span className="px-2 text-gray-500">
								Halaman {safeCurrentPage} / {totalPages}
							</span>
							<button
								type="button"
								onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
								disabled={safeCurrentPage >= totalPages}
								className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
							>
								Berikutnya
							</button>
						</div>
					</div>
				) : null}
			</div>

			<Modal
				isOpen={Boolean(selected)}
				onClose={() => setSelected(null)}
				title="Detail Transaksi"
				maxWidthClassName="max-w-5xl"
			>
				{selected ? (
				<div className="space-y-4">
					<div className="flex flex-col gap-3 border-b border-gray-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<p className="mt-1 text-sm text-gray-600">{selected.number}</p>
						</div>
					</div>
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
									{selected.kind === "draft" ? "Invoice Draft" : "Invoice Final"}
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
							<div className="rounded-2xl bg-slate-950 p-5 text-white">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-300">Nilai Dokumen</div>
								<div className="mt-3 text-3xl font-semibold">{formatRupiah(selected.totalAmount)}</div>
							</div>
							<div className="rounded-2xl border border-gray-200 bg-white p-4">
								<div className="text-xs uppercase tracking-[0.16em] text-gray-500">Dokumen Gudang</div>
								<div className="mt-2 font-semibold text-gray-900">
									{selected.deliveryOrderNumber ?? "Belum diteruskan ke gudang"}
								</div>
								{selected.deliveryOrderNumber ? (
									<div className="mt-2 text-sm text-gray-500">
										Status gudang:{" "}
										{toUiLabel(
											(selected.raw as InvoiceListItem).deliveryOrder?.status,
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
									<th className="px-4 py-3">Kondisi</th>
									<th className="px-4 py-3 text-right">Qty</th>
									<th className="px-4 py-3 text-right">Harga</th>
									<th className="px-4 py-3 text-right">Subtotal</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{detailLoading ? (
									<tr>
										<td className="px-4 py-4 text-gray-600" colSpan={5}>
											Memuat rincian pesanan...
										</td>
									</tr>
								) : detailError ? (
									<tr>
										<td className="px-4 py-4 text-rose-700" colSpan={5}>
											{detailError}
										</td>
									</tr>
								) : selectedItems.length === 0 ? (
									<tr>
										<td className="px-4 py-4 text-gray-600" colSpan={5}>
											Rincian item belum tersedia untuk transaksi ini.
										</td>
									</tr>
								) : (
									selectedItems.map((item) => (
										<tr key={item.id}>
											<td className="px-4 py-3">
												<div className="font-medium text-gray-900">{item.productName}</div>
												<div className="text-xs text-gray-500">{item.sku ?? "-"}</div>
											</td>
											<td className="px-4 py-3 text-gray-700">{item.condition}</td>
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
		</div>
	);
}
