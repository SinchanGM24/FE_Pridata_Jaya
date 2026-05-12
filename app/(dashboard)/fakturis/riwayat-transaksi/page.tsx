"use client";

import { useEffect, useMemo, useState } from "react";
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
			dueDate?: string | null;
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
			dueDate?: string | null;
			raw: InvoiceDraftListItem;
	  };

export default function RiwayatTransaksiPage() {
	const [rows, setRows] = useState<FakturisTimelineItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [fromDate, setFromDate] = useState("");
	const [untilDate, setUntilDate] = useState("");
	const [selected, setSelected] = useState<FakturisTimelineItem | null>(null);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [invoices, drafts] = await Promise.all([
				invoicesService.list({ page: 1, limit: 100 }),
				invoiceDraftsService.list({ page: 1, limit: 100 }),
			]);
			const timelineRows: FakturisTimelineItem[] = [
				...drafts.items.map((draft) => ({
					id: draft.id,
					number: draft.draftNumber,
					kind: "draft" as const,
					customer: draft.storeNameSnapshot,
					date: draft.draftDate,
					totalAmount: draft.totalAmount,
					status: draft.status,
					dueDate: draft.dueDate ?? null,
					orderNumber: null,
					raw: draft,
				})),
				...invoices.items.map((invoice) => ({
					id: invoice.id,
					number: invoice.invoiceNumber,
					kind: "invoice" as const,
					customer: invoice.storeNameSnapshot,
					date: invoice.invoiceDate,
					totalAmount: invoice.totalAmount,
					status: invoice.status,
					dueDate: invoice.dueDate ?? null,
					orderNumber: invoice.order?.orderNumber ?? null,
					raw: invoice,
				})),
			].sort((a, b) => (a.date < b.date ? 1 : -1));
			setRows(timelineRows);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat riwayat transaksi.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return rows.filter((item) => {
			const matchSearch =
				!query ||
				item.number.toLowerCase().includes(query) ||
				item.customer.toLowerCase().includes(query) ||
				String(item.orderNumber ?? "").toLowerCase().includes(query);
			const docDate = dateOnly(item.date);
			const matchFrom = !fromDate || docDate >= fromDate;
			const matchUntil = !untilDate || docDate <= untilDate;
			return matchSearch && matchFrom && matchUntil;
		});
	}, [rows, search, fromDate, untilDate]);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold text-gray-900">Riwayat Transaksi</h1>
				<p className="text-gray-600">Sumber: invoice draft dan invoice final yang sudah dibuat di BE2.</p>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			<div className="bg-white border border-gray-200 rounded-xl p-4">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Cari nomor draft, invoice, order, atau pelanggan"
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
						onClick={load}
						disabled={loading}
						className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</div>

			<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
				<div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-gray-900">Daftar Transaksi</h2>
					<span className="text-sm text-gray-500">Total: {filteredRows.length}</span>
				</div>
				<div className="overflow-auto">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Nomor Dokumen</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Jenis</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Pelanggan</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Aksi</th>
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
								filteredRows.map((item) => (
									<tr key={item.id} className="hover:bg-gray-50">
										<td className="px-4 py-3 font-medium text-gray-900">{item.number}</td>
										<td className="px-4 py-3 text-gray-700">
											<span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
												{item.kind === "draft" ? "Draft" : "Invoice"}
											</span>
										</td>
										<td className="px-4 py-3 text-gray-700">{item.customer}</td>
										<td className="px-4 py-3 text-gray-700">{dateOnly(item.date)}</td>
										<td className="px-4 py-3 text-gray-900 text-right">
											{formatRupiah(item.totalAmount)}
										</td>
										<td className="px-4 py-3 text-gray-700">{item.status}</td>
										<td className="px-4 py-3">
											<div className="flex justify-end">
												<button
													onClick={() => setSelected(item)}
													className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
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
			</div>

			{selected ? (
				<div className="bg-white border border-gray-200 rounded-xl p-4">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h3 className="text-lg font-semibold text-gray-900">Detail Transaksi</h3>
							<p className="text-sm text-gray-600">{selected.number}</p>
						</div>
						<button
							onClick={() => setSelected(null)}
							className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
						>
							Tutup
						</button>
					</div>
					<div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
						<div className="border border-gray-200 rounded-lg p-3">
							<div className="text-gray-500">Pelanggan</div>
							<div className="text-gray-900 font-medium">{selected.customer}</div>
						</div>
						<div className="border border-gray-200 rounded-lg p-3">
							<div className="text-gray-500">Tanggal</div>
							<div className="text-gray-900 font-medium">{dateOnly(selected.date)}</div>
						</div>
						<div className="border border-gray-200 rounded-lg p-3">
							<div className="text-gray-500">Total</div>
							<div className="text-gray-900 font-medium">{formatRupiah(selected.totalAmount)}</div>
						</div>
						<div className="border border-gray-200 rounded-lg p-3">
							<div className="text-gray-500">Jatuh Tempo</div>
							<div className="text-gray-900 font-medium">{dateOnly(selected.dueDate)}</div>
						</div>
						<div className="border border-gray-200 rounded-lg p-3">
							<div className="text-gray-500">Status</div>
							<div className="text-gray-900 font-medium">{selected.status}</div>
						</div>
						<div className="border border-gray-200 rounded-lg p-3 md:col-span-2">
							<div className="text-gray-500">Nomor Order Asal</div>
							<div className="text-gray-900 font-medium">{selected.orderNumber ?? "-"}</div>
						</div>
						<div className="border border-gray-200 rounded-lg p-3">
							<div className="text-gray-500">Jenis Dokumen</div>
							<div className="text-gray-900 font-medium">
								{selected.kind === "draft" ? "Invoice Draft" : "Invoice Final"}
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
