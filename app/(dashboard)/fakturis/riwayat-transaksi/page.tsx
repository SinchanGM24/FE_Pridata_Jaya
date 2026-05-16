"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deliveryOrdersService } from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import {
	invoiceDraftsService,
	type InvoiceDraftListItem,
} from "@/services/invoice-drafts";

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

export default function RiwayatTransaksiPage() {
	const [rows, setRows] = useState<FakturisTimelineItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [fromDate, setFromDate] = useState("");
	const [untilDate, setUntilDate] = useState("");
	const [selected, setSelected] = useState<FakturisTimelineItem | null>(null);
	const [transactionView, setTransactionView] = useState<TransactionView>("accepted");

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
				String(item.orderNumber ?? "").toLowerCase().includes(query) ||
				String(item.deliveryOrderNumber ?? "").toLowerCase().includes(query);
			const docDate = dateOnly(item.date);
			const matchFrom = !fromDate || docDate >= fromDate;
			const matchUntil = !untilDate || docDate <= untilDate;
			return matchView && matchSearch && matchFrom && matchUntil;
		});
	}, [rows, search, fromDate, transactionView, untilDate]);

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
						onClick={() => setTransactionView("accepted")}
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
						onClick={() => setTransactionView("rejected")}
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
						onChange={(e) => setSearch(e.target.value)}
						placeholder={
							transactionView === "accepted"
								? "Cari invoice, order, DO, atau pelanggan"
								: "Cari dokumen ditolak atau pelanggan"
						}
						className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
					/>
					<div>
						<label className="mb-1 block text-xs text-gray-500">Dari Tanggal</label>
						<input
							type="date"
							value={fromDate}
							onChange={(e) => setFromDate(e.target.value)}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-gray-500">Sampai Tanggal</label>
						<input
							type="date"
							value={untilDate}
							onChange={(e) => setUntilDate(e.target.value)}
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
								<th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
								<th className="px-4 py-3 text-left font-medium text-gray-600">Tindak Lanjut</th>
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
								filteredRows.map((item) => {
									const followUpLabel =
										item.kind === "draft"
											? item.status === "CANCELLED"
												? "Draft ditolak"
												: "Draft"
											: item.deliveryOrderNumber
												? `Sudah ke gudang: ${item.deliveryOrderNumber}`
												: item.status === "CANCELLED"
													? "Invoice dibatalkan"
													: "Siap diteruskan ke gudang";

									return (
										<tr key={item.id} className="hover:bg-gray-50">
											<td className="px-4 py-3 font-medium text-gray-900">{item.number}</td>
											<td className="px-4 py-3 text-gray-700">
												<span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
													{item.kind === "draft" ? "Draft" : "Invoice"}
												</span>
											</td>
											<td className="px-4 py-3 text-gray-700">{item.customer}</td>
											<td className="px-4 py-3 text-gray-700">{dateOnly(item.date)}</td>
											<td className="px-4 py-3 text-right text-gray-900">
												{formatRupiah(item.totalAmount)}
											</td>
											<td className="px-4 py-3 text-gray-700">{followUpLabel}</td>
											<td className="px-4 py-3">
												<div className="flex justify-end gap-2">
													<button
														onClick={() => setSelected(item)}
														className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
													>
														Detail
													</button>
													{transactionView === "accepted" &&
													item.kind === "invoice" &&
													item.status !== "CANCELLED" ? (
														<Link
															href={`/gudang/pengiriman?invoiceId=${item.id}`}
															className="rounded-lg bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800"
														>
															Ke Gudang
														</Link>
													) : null}
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{selected ? (
				<div className="rounded-xl border border-gray-200 bg-white p-4">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h3 className="text-lg font-semibold text-gray-900">Detail Transaksi</h3>
							<p className="text-sm text-gray-600">{selected.number}</p>
						</div>
						<button
							onClick={() => setSelected(null)}
							className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
						>
							Tutup
						</button>
					</div>
					<div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
						<div className="rounded-lg border border-gray-200 p-3">
							<div className="text-gray-500">Pelanggan</div>
							<div className="font-medium text-gray-900">{selected.customer}</div>
						</div>
						<div className="rounded-lg border border-gray-200 p-3">
							<div className="text-gray-500">Tanggal</div>
							<div className="font-medium text-gray-900">{dateOnly(selected.date)}</div>
						</div>
						<div className="rounded-lg border border-gray-200 p-3">
							<div className="text-gray-500">Total</div>
							<div className="font-medium text-gray-900">{formatRupiah(selected.totalAmount)}</div>
						</div>
						<div className="rounded-lg border border-gray-200 p-3">
							<div className="text-gray-500">Jatuh Tempo</div>
							<div className="font-medium text-gray-900">{dateOnly(selected.dueDate)}</div>
						</div>
						<div className="rounded-lg border border-gray-200 p-3">
							<div className="text-gray-500">Status Dokumen</div>
							<div className="font-medium text-gray-900">{selected.status}</div>
						</div>
						<div className="rounded-lg border border-gray-200 p-3">
							<div className="text-gray-500">Order Asal</div>
							<div className="font-medium text-gray-900">{selected.orderNumber ?? "-"}</div>
						</div>
						<div className="rounded-lg border border-gray-200 p-3 md:col-span-2">
							<div className="text-gray-500">Dokumen Gudang</div>
							<div className="font-medium text-gray-900">
								{selected.deliveryOrderNumber ?? "Belum diteruskan ke gudang"}
							</div>
						</div>
						<div className="rounded-lg border border-gray-200 p-3">
							<div className="text-gray-500">Jenis Dokumen</div>
							<div className="font-medium text-gray-900">
								{selected.kind === "draft" ? "Invoice Draft" : "Invoice Final"}
							</div>
						</div>
					</div>
					{transactionView === "accepted" &&
					selected.kind === "invoice" &&
					selected.status !== "CANCELLED" ? (
						<div className="mt-4 flex justify-end">
							<Link
								href={`/gudang/pengiriman?invoiceId=${selected.id}`}
								className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
							>
								Buka di Pengiriman Gudang
							</Link>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
