"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Badge from "@/components/shared/Badge";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import { invoiceStatusLabel, orderStatusLabel, statusTone, toUiLabel } from "@/lib/ui-labels";
import { ordersService, type OrderListItem } from "@/services/orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { receivableService, type ReceivableAging, type ReceivableRow } from "@/services/receivable";
import { salesService } from "@/services/sales";
import { storesService, type Store } from "@/services/stores";
import type { StoreGradeItem } from "@/services/grade";

const dateOnly = (value?: string | null) => (value ? formatAppDate(value) : "-");

const emptyAgingBucket = { count: 0, amount: 0 };

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
	) {
		return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
	}
	return fallback;
};

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
			} catch (error: unknown) {
				if (!mounted) return;
				setError(getErrorMessage(error, "Gagal memuat detail toko."));
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

	const agingBuckets = useMemo(() => {
		const nestedAging =
			aging && "aging" in aging
				? (aging as ReceivableAging & { aging?: Partial<ReceivableAging> }).aging
				: undefined;
		const source = nestedAging ?? aging;
		return [
			{ label: "Lancar", bucket: source?.current ?? emptyAgingBucket },
			{ label: "1-30", bucket: source?.days1To30 ?? emptyAgingBucket },
			{ label: "31-60", bucket: source?.days31To60 ?? emptyAgingBucket },
			{ label: "61-90", bucket: source?.days61To90 ?? emptyAgingBucket },
			{ label: ">90", bucket: source?.daysOver90 ?? emptyAgingBucket },
		];
	}, [aging]);

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

	const orderColumns: ResponsiveColumn<OrderListItem>[] = [
		{ key: "orderNumber", head: "Order", role: "title" },
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (order) => (
				<Badge tone={statusTone(order.status)}>
					{toUiLabel(order.status, orderStatusLabel)}
				</Badge>
			),
		},
		{
			key: "totalAmount",
			head: "Total",
			role: "amount",
			align: "right",
			render: (order) => formatRupiah(order.totalAmount),
		},
		{ key: "documentDate", head: "Tanggal", render: (order) => dateOnly(order.documentDate) },
	];

	const invoiceColumns: ResponsiveColumn<InvoiceListItem>[] = [
		{ key: "invoiceNumber", head: "Invoice", role: "title" },
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (invoice) => (
				<Badge tone={statusTone(invoice.status)}>
					{toUiLabel(invoice.status, invoiceStatusLabel)}
				</Badge>
			),
		},
		{
			key: "remainingAmount",
			head: "Sisa Tagihan",
			role: "amount",
			align: "right",
			render: (invoice) => formatRupiah(invoice.remainingAmount),
		},
		{ key: "invoiceDate", head: "Tanggal", render: (invoice) => dateOnly(invoice.invoiceDate) },
		{ key: "dueDate", head: "Jatuh Tempo", render: (invoice) => dateOnly(invoice.dueDate) },
	];

	const receivableColumns: ResponsiveColumn<ReceivableRow>[] = [
		{ key: "invoiceNumber", head: "Invoice", role: "title" },
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (row) => (
				<Badge tone={statusTone(row.status)}>{toUiLabel(row.status, invoiceStatusLabel)}</Badge>
			),
		},
		{
			key: "remainingAmount",
			head: "Sisa Tagihan",
			role: "amount",
			align: "right",
			render: (row) => formatRupiah(row.remainingAmount),
		},
		{ key: "dueDate", head: "Jatuh Tempo", render: (row) => dateOnly(row.dueDate) },
	];

	return (
		<TokoFeatureLayout
			title="Profil Toko"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={storeTitle}
			profileRoleLabel="Sales Mode Toko"
			salesName={store?.assignedSalesUser?.name ?? null}
		>
			<section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Toko</p>
					<p className="mt-1 text-sm font-semibold text-slate-900">{storeTitle}</p>
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
					{ label: "Limit Kredit", value: formatRupiah(storeMeta.creditLimit) },
					{ label: "Sisa Tagihan", value: formatRupiah(storeMeta.outstanding) },
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
							{agingBuckets.map((item) => (
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
				<div className="space-y-3">
					<p className="text-sm font-semibold text-slate-800">Order Terbaru</p>
					<ResponsiveTable
						columns={orderColumns}
						data={recentOrders}
						getRowKey={(order) => order.id}
						loading={loading}
						skeletonRows={3}
						emptyText="Belum ada order"
					/>
				</div>

				<div className="space-y-3">
					<p className="text-sm font-semibold text-slate-800">Invoice Terbaru</p>
					<ResponsiveTable
						columns={invoiceColumns}
						data={recentInvoices}
						getRowKey={(invoice) => invoice.id}
						loading={loading}
						skeletonRows={3}
						emptyText="Belum ada invoice"
					/>
				</div>
			</section>

			<section className="space-y-3">
				<div>
					<p className="text-sm font-semibold text-slate-800">Piutang Terdekat</p>
					<p className="mt-1 text-xs text-slate-500">Urut jatuh tempo paling dekat.</p>
				</div>
				<ResponsiveTable
					columns={receivableColumns}
					data={receivables}
					getRowKey={(row) => row.id}
					loading={loading}
					skeletonRows={3}
					emptyText="Tidak ada piutang"
					emptyDescription="Semua tagihan toko ini sudah lunas."
				/>
			</section>
		</TokoFeatureLayout>
	);
}
