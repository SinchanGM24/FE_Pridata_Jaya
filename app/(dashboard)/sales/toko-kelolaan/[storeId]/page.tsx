"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { ordersService, type OrderListItem } from "@/services/orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { receivableService, type ReceivableAging, type ReceivableRow } from "@/services/receivable";
import { salesService } from "@/services/sales";
import { storesService, type Store } from "@/services/stores";
import type { StoreGradeItem } from "@/services/grade";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

export default function SalesManagedStoreDetailPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;

	const [store, setStore] = useState<Store | null>(null);
	const [grade, setGrade] = useState<StoreGradeItem | null>(null);
	const [recentOrders, setRecentOrders] = useState<OrderListItem[]>([]);
	const [recentInvoices, setRecentInvoices] = useState<InvoiceListItem[]>([]);
	const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
	const [aging, setAging] = useState<ReceivableAging | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let mounted = true;
		const load = async () => {
			setLoading(true);
			setError("");
			try {
				const [storeRes, managedStores, orderRes, invoiceRes, agingRes, receivableRes] = await Promise.all([
					storesService.getById(storeId),
					salesService.getManagedStores(),
					ordersService.listForSales({ page: 1, limit: 10, storeId }),
					invoicesService.listForSales({ page: 1, limit: 10, storeId, sortBy: "invoiceDate", sortOrder: "desc" }),
					salesService.getAging(storeId).catch(() => null),
					receivableService
						.listForSales({ page: 1, limit: 10, storeId, sortBy: "dueDate", sortOrder: "asc" })
						.catch(() => ({ data: [] })),
				]);

				if (!mounted) return;
				setStore(storeRes);
				setGrade(managedStores.find((item) => item.storeId === storeId) ?? null);
				setRecentOrders(orderRes.items);
				setRecentInvoices(invoiceRes.items);
				setAging(agingRes);
				setReceivables(receivableRes.data ?? []);
			} catch (err: any) {
				if (!mounted) return;
				setError(err?.response?.data?.message || "Gagal memuat detail toko.");
			} finally {
				if (!mounted) return;
				setLoading(false);
			}
		};
		load();
		return () => {
			mounted = false;
		};
	}, [storeId]);

	const storeTitle = store?.name || grade?.storeName || "Detail Toko";

	const storeMeta = useMemo(() => {
		const verificationStatus = store?.verificationStatus || grade?.verificationStatus || "-";
		const creditLimit = store?.creditLimit ?? grade?.creditLimit ?? 0;
		const outstanding = grade?.totalOutstandingAmount ?? 0;
		return {
			verificationStatus,
			creditLimit,
			outstanding,
			grade: grade?.grade ?? "-",
			totalOrders: grade?.totalOrders ?? 0,
			totalInvoices: grade?.totalInvoices ?? 0,
		};
	}, [grade, store?.creditLimit, store?.verificationStatus]);

	return (
		<SalesPortalShell title={storeTitle}>
			<section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Store ID</p>
					<p className="mt-1 font-mono text-xs text-slate-600">{storeId}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link
						href="/sales/toko-kelolaan"
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
					>
						Kembali
					</Link>
					<Link
						href={`/sales/toko-kelolaan/${storeId}/katalog`}
						className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
					>
						Buat PO
					</Link>
					<Link
						href={`/sales/riwayat-transaksi?storeId=${storeId}`}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
					>
						Riwayat
					</Link>
					<Link
						href={`/sales/aging-piutang?storeId=${storeId}`}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
					>
						Aging
					</Link>
				</div>
			</section>

			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Status Verifikasi", value: storeMeta.verificationStatus },
					{ label: "Credit Limit", value: formatRupiah(storeMeta.creditLimit) },
					{ label: "Outstanding", value: formatRupiah(storeMeta.outstanding) },
					{ label: "Grade", value: storeMeta.grade },
					{ label: "Total Orders", value: String(storeMeta.totalOrders) },
					{ label: "Total Invoices", value: String(storeMeta.totalInvoices) },
				].map((item) => (
					<div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-2 text-lg font-semibold text-slate-900">{loading ? "..." : item.value}</p>
					</div>
				))}
			</section>

			<section className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm font-semibold text-slate-800">Profil Toko</p>
					{loading ? (
						<p className="mt-3 text-sm text-slate-600">Memuat profil...</p>
					) : store ? (
						<div className="mt-3 space-y-2 text-sm text-slate-700">
							<div>
								<p className="text-xs text-slate-500">Nama</p>
								<p className="font-medium text-slate-900">{store.name}</p>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								<div>
									<p className="text-xs text-slate-500">Email</p>
									<p>{store.email}</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Telepon</p>
									<p>{store.phone}</p>
								</div>
							</div>
							<div>
								<p className="text-xs text-slate-500">Alamat</p>
								<p>{store.address}</p>
								<p className="mt-1 text-xs text-slate-500">
									{store.city?.name ?? "-"}
									{store.city?.province ? `, ${store.city.province}` : ""}
								</p>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								<div>
									<p className="text-xs text-slate-500">Owner User</p>
									<p>{store.user?.name ?? "-"}</p>
									<p className="text-xs text-slate-500">{store.user?.email ?? ""}</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Sales Assigned</p>
									<p>{store.assignedSalesUser?.name ?? "-"}</p>
									<p className="text-xs text-slate-500">{store.assignedSalesUser?.email ?? ""}</p>
								</div>
							</div>
						</div>
					) : (
						<p className="mt-3 text-sm text-slate-600">Toko tidak ditemukan.</p>
					)}
				</div>

				<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm font-semibold text-slate-800">Aging Piutang (Store)</p>
					{loading ? (
						<p className="mt-3 text-sm text-slate-600">Memuat aging...</p>
					) : aging ? (
						<div className="mt-3 grid gap-3 md:grid-cols-2">
							{[
								{ label: "Lancar", bucket: aging.current },
								{ label: "1-30", bucket: aging.days1To30 },
								{ label: "31-60", bucket: aging.days31To60 },
								{ label: "61-90", bucket: aging.days61To90 },
								{ label: ">90", bucket: aging.daysOver90 },
							].map((item) => (
								<div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
									<p className="mt-1 text-sm font-semibold text-slate-900">{item.bucket.count} invoice</p>
									<p className="text-xs text-slate-600">{formatRupiah(item.bucket.amount)}</p>
								</div>
							))}
						</div>
					) : (
						<p className="mt-3 text-sm text-slate-600">Tidak ada data aging.</p>
					)}
				</div>
			</section>

			<section className="grid gap-4 lg:grid-cols-2">
				<div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<p className="text-sm font-semibold text-slate-800">Order Terbaru</p>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Order</th>
								<th className="px-4 py-3">Tanggal</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3 text-right">Total</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={4}>
										Memuat...
									</td>
								</tr>
							) : recentOrders.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={4}>
										Belum ada order.
									</td>
								</tr>
							) : (
								recentOrders.map((order) => (
									<tr key={order.id}>
										<td className="px-4 py-3 font-medium text-slate-900">{order.orderNumber}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(order.documentDate)}</td>
										<td className="px-4 py-3 text-slate-700">{order.status}</td>
										<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(order.totalAmount)}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<p className="text-sm font-semibold text-slate-800">Invoice Terbaru</p>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Invoice</th>
								<th className="px-4 py-3">Tanggal</th>
								<th className="px-4 py-3">Jatuh Tempo</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3 text-right">Outstanding</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Memuat...
									</td>
								</tr>
							) : recentInvoices.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Belum ada invoice.
									</td>
								</tr>
							) : (
								recentInvoices.map((invoice) => (
									<tr key={invoice.id}>
										<td className="px-4 py-3 font-medium text-slate-900">{invoice.invoiceNumber}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(invoice.invoiceDate)}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(invoice.dueDate)}</td>
										<td className="px-4 py-3 text-slate-700">{invoice.status}</td>
										<td className="px-4 py-3 text-right font-medium text-slate-900">
											{formatRupiah(invoice.remainingAmount)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<p className="text-sm font-semibold text-slate-800">Piutang Terdekat</p>
					<p className="mt-1 text-xs text-slate-500">Urut jatuh tempo paling dekat.</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={4}>
									Memuat...
								</td>
							</tr>
						) : receivables.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={4}>
									Tidak ada piutang.
								</td>
							</tr>
						) : (
							receivables.map((row) => (
								<tr key={row.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{row.invoiceNumber}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(row.dueDate)}</td>
									<td className="px-4 py-3 text-slate-700">{row.status}</td>
									<td className="px-4 py-3 text-right font-medium text-slate-900">
										{formatRupiah(row.remainingAmount)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</SalesPortalShell>
	);
}
