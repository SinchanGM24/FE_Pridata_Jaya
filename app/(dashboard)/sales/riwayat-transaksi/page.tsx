"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { ordersService, type OrderListItem } from "@/services/orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

const orderStatusColors: Record<string, string> = {
	PENDING: "bg-amber-100 text-amber-800",
	PROCESSED: "bg-blue-100 text-blue-800",
	CANCELLED: "bg-slate-100 text-slate-600",
};

const invoiceStatusColors: Record<string, string> = {
	UNPAID: "bg-amber-100 text-amber-800",
	PARTIAL: "bg-blue-100 text-blue-800",
	PAID: "bg-emerald-100 text-emerald-800",
	CANCELLED: "bg-slate-100 text-slate-600",
};

type TabMode = "orders" | "invoices";

export default function SalesTransactionHistoryPage() {
	const searchParams = useSearchParams();
	const storeId = searchParams.get("storeId") ?? undefined;
	const [orders, setOrders] = useState<OrderListItem[]>([]);
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [tab, setTab] = useState<TabMode>("orders");
	const [search, setSearch] = useState("");
	const [filterStatus, setFilterStatus] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [orderResult, invoiceResult] = await Promise.all([
				ordersService.listForSales({ page: 1, limit: 100, storeId }),
				invoicesService.listForSales({ page: 1, limit: 100, storeId }),
			]);
			setOrders(orderResult.items);
			setInvoices(invoiceResult.items);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat riwayat transaksi.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, [storeId]);

	const filteredOrders = useMemo(() => {
		let rows = orders;
		if (filterStatus) rows = rows.filter((o) => o.status === filterStatus);
		if (search) {
			const q = search.toLowerCase();
			rows = rows.filter(
				(o) => o.orderNumber.toLowerCase().includes(q) || o.storeNameSnapshot.toLowerCase().includes(q),
			);
		}
		return rows;
	}, [orders, search, filterStatus]);

	const filteredInvoices = useMemo(() => {
		let rows = invoices;
		if (filterStatus) rows = rows.filter((i) => i.status === filterStatus);
		if (search) {
			const q = search.toLowerCase();
			rows = rows.filter(
				(i) => i.invoiceNumber.toLowerCase().includes(q) || i.storeNameSnapshot.toLowerCase().includes(q),
			);
		}
		return rows;
	}, [invoices, search, filterStatus]);

	const handleTabChange = (next: TabMode) => {
		setTab(next);
		setFilterStatus("");
	};

	return (
		<SalesPortalShell title="Riwayat Transaksi Sales">
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
					{(["orders", "invoices"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => handleTabChange(t)}
							className={`rounded-lg px-5 py-2 text-sm font-medium transition ${tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
						>
							{t === "orders" ? `Order (${orders.length})` : `Invoice (${invoices.length})`}
						</button>
					))}
				</div>
				<div className="flex flex-wrap gap-2">
					<input
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm w-56"
						placeholder="Cari nomor / toko..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value)}
					>
						<option value="">Semua Status</option>
						{tab === "orders" ? (
							<>
								<option value="PENDING">PENDING</option>
								<option value="PROCESSED">PROCESSED</option>
								<option value="CANCELLED">CANCELLED</option>
							</>
						) : (
							<>
								<option value="UNPAID">UNPAID</option>
								<option value="PARTIAL">PARTIAL</option>
								<option value="PAID">PAID</option>
								<option value="CANCELLED">CANCELLED</option>
							</>
						)}
					</select>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</div>

			{tab === "orders" ? (
				<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Nomor Order</th>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Tanggal</th>
								<th className="px-4 py-3 text-right">Total</th>
								<th className="px-4 py-3">Status</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
							) : filteredOrders.length === 0 ? (
								<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Tidak ada order.</td></tr>
							) : (
								filteredOrders.map((o) => (
									<tr key={o.id}>
										<td className="px-4 py-3 font-medium text-slate-900">{o.orderNumber}</td>
										<td className="px-4 py-3 text-slate-700">{o.storeNameSnapshot}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(o.documentDate)}</td>
										<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(o.totalAmount)}</td>
										<td className="px-4 py-3">
											<span className={`rounded-full px-2 py-1 text-xs font-medium ${orderStatusColors[o.status] ?? "bg-slate-100 text-slate-700"}`}>
												{o.status}
											</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</section>
			) : (
				<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Nomor Invoice</th>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Tgl Invoice</th>
								<th className="px-4 py-3">Jatuh Tempo</th>
								<th className="px-4 py-3 text-right">Total</th>
								<th className="px-4 py-3 text-right">Sisa</th>
								<th className="px-4 py-3">Status</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr><td colSpan={7} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
							) : filteredInvoices.length === 0 ? (
								<tr><td colSpan={7} className="px-4 py-4 text-slate-600">Tidak ada invoice.</td></tr>
							) : (
								filteredInvoices.map((inv) => (
									<tr key={inv.id}>
										<td className="px-4 py-3 font-medium text-slate-900">{inv.invoiceNumber}</td>
										<td className="px-4 py-3 text-slate-700">{inv.storeNameSnapshot}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(inv.invoiceDate)}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(inv.dueDate)}</td>
										<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(inv.totalAmount)}</td>
										<td className="px-4 py-3 text-right font-medium text-slate-900">{formatRupiah(inv.remainingAmount)}</td>
										<td className="px-4 py-3">
											<span className={`rounded-full px-2 py-1 text-xs font-medium ${invoiceStatusColors[inv.status] ?? "bg-slate-100 text-slate-700"}`}>
												{inv.status}
											</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</section>
			)}
		</SalesPortalShell>
	);
}
