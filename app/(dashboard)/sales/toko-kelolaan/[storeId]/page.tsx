"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Badge from "@/components/shared/Badge";
import Card, { CardHeader } from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import PageFeedback from "@/components/shared/PageFeedback";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import {
	invoiceStatusLabel,
	orderStatusLabel,
	statusTone,
	toUiLabel,
	verificationStatusLabel,
} from "@/lib/ui-labels";
import { ordersService, type OrderListItem } from "@/services/orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { receivableService, type ReceivableAging, type ReceivableRow } from "@/services/receivable";
import { salesService } from "@/services/sales";
import { storesService, type Store } from "@/services/stores";
import type { StoreGradeItem } from "@/services/grade";
import { buttonClasses } from "@/components/shared/Button";

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
				const [storeRes, storeGrade, orderRes, invoiceRes, agingRes, receivableRes] = await Promise.all([
					/*
					 * GET /stores/{id} adalah route detail, dan route detail hanya untuk
					 * role internal — sesi sales dijawab 403. Sebelumnya panggilan ini
					 * telanjang di dalam Promise.all, jadi satu 403 menjatuhkan seluruh
					 * halaman: order, faktur, dan piutang semuanya 200 tapi tidak pernah
					 * ditampilkan. Identitas toko yang boleh dilihat sales sudah ikut di
					 * managed-stores di bawah, jadi ini murni pelengkap.
					 */
					storesService.getById(storeId).catch(() => null),
					salesService.getManagedStoreGrade(storeId).catch(() => null),
					ordersService.listForSales({ page: 1, limit: 10, storeId }),
					invoicesService.listForSales({ page: 1, limit: 10, storeId, sortBy: "invoiceDate", sortOrder: "desc" }),
					salesService.getAging(storeId).catch(() => null),
					receivableService
						.listForSales({ page: 1, limit: 10, storeId, sortBy: "dueDate", sortOrder: "asc" })
						.catch(() => ({ data: [] })),
				]);

				if (!mounted) return;
				setStore(storeRes);
				setGrade(storeGrade);
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

	/*
	 * Identitas toko dari dua sumber: /stores/{id} kalau sesi boleh (owner,
	 * admin, fakturis), dan baris managed-stores kalau tidak. Sales selalu
	 * dapat yang kedua, jadi kartu profil tidak pernah kosong lagi.
	 */
	const storeProfile = useMemo(() => {
		if (!store && !grade) return null;
		return {
			name: store?.name || grade?.storeName || "-",
			email: store?.email || grade?.email || "-",
			phone: store?.phone || grade?.phone || "",
			address: store?.address || grade?.address || "-",
			cityLabel: (() => {
				const city = store?.city ?? grade?.city;
				if (!city?.name) return null;
				return city.province ? `${city.name}, ${city.province}` : city.name;
			})(),
			ownerName: store?.user?.name ?? null,
			ownerEmail: store?.user?.email ?? null,
			salesName: store?.assignedSalesUser?.name ?? null,
			salesEmail: store?.assignedSalesUser?.email ?? null,
		};
	}, [grade, store]);

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
			{/*
			 * Status verifikasi dan grade turun ke sini dari baris KPI: keduanya
			 * status bernama, bukan angka, dan StatCard merendernya dengan
			 * type-display — ukuran yang dipesan untuk angka penentu tindakan.
			 * Di sebelah nama toko keduanya justru terbaca pada pandangan pertama,
			 * yang persis dibutuhkan saat sales membuka layar ini di depan toko.
			 */}
			<Card>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="min-w-0">
						<p className="type-label text-slate-500">Toko</p>
						<p className="type-title mt-1 truncate text-slate-900">{storeTitle}</p>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<Badge tone={statusTone(storeMeta.verificationStatus)}>
								{toUiLabel(storeMeta.verificationStatus, verificationStatusLabel)}
							</Badge>
							<Badge>Grade {storeMeta.grade}</Badge>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{/* Satu aksi komersial; sisanya navigasi. */}
						<Link
							href={`/sales/toko-kelolaan/${storeId}/katalog`}
							className={buttonClasses("commerce", "sm")}
						>
							Buat PO
						</Link>
						<Link
							href={`/sales/riwayat-transaksi?storeId=${storeId}`}
							className={buttonClasses("secondary", "sm")}
						>
							Riwayat
						</Link>
						<Link
							href={`/sales/aging-piutang?storeId=${storeId}`}
							className={buttonClasses("secondary", "sm")}
						>
							Aging
						</Link>
						<Link href="/sales/toko-kelolaan" className={buttonClasses("ghost", "sm")}>
							Kembali
						</Link>
					</div>
				</div>
			</Card>

			<PageFeedback error={error} onDismissError={() => setError("")} />

			{/*
			 * Dulu grid statistik tulisan tangan yang merender literal "..." di
			 * tempat angka selama memuat, dan menulis label campur bahasa
			 * ("Total Orders"). StatCard sudah punya skeleton berbentuk benar.
			 */}
			<StatGrid columns={4}>
				<StatCard
					label="Sisa Tagihan"
					value={formatRupiah(storeMeta.outstanding)}
					tone={storeMeta.outstanding > 0 ? "warning" : "success"}
					loading={loading}
					lead
				/>
				<StatCard
					label="Limit Kredit"
					value={formatRupiah(storeMeta.creditLimit)}
					loading={loading}
				/>
				<StatCard label="Total Pesanan" value={storeMeta.totalOrders} loading={loading} />
				<StatCard label="Total Faktur" value={storeMeta.totalInvoices} loading={loading} />
			</StatGrid>

			<section className="grid items-start gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader title="Profil Toko" />
					{loading ? (
						<div className="mt-4 space-y-3">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-56" />
							<Skeleton className="h-4 w-48" />
						</div>
					) : storeProfile ? (
						<dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
							<div className="sm:col-span-2">
								<dt className="type-label text-slate-500">Nama</dt>
								<dd className="type-body mt-1 font-medium text-slate-900">{storeProfile.name}</dd>
							</div>
							<div className="min-w-0">
								<dt className="type-label text-slate-500">Email</dt>
								<dd className="type-body mt-1 break-words text-slate-900">{storeProfile.email}</dd>
							</div>
							<div>
								<dt className="type-label text-slate-500">Telepon</dt>
								{/* Penagihan dimulai dari menelepon — nomornya harus bisa ditekan. */}
								<dd className="type-body mt-1 text-slate-900">
									{storeProfile.phone ? (
										<a
											href={`tel:${storeProfile.phone.replace(/\s+/g, "")}`}
											className="inline-flex min-h-11 items-center font-medium text-brand-700 underline-offset-4 hover:underline md:min-h-9"
										>
											{storeProfile.phone}
										</a>
									) : (
										"-"
									)}
								</dd>
							</div>
							<div className="sm:col-span-2">
								<dt className="type-label text-slate-500">Alamat</dt>
								<dd className="type-body mt-1 text-slate-900">
									{storeProfile.address}
									{storeProfile.cityLabel ? (
										<span className="block text-slate-500">{storeProfile.cityLabel}</span>
									) : null}
								</dd>
							</div>
							{storeProfile.ownerName ? (
								<div className="min-w-0">
									<dt className="type-label text-slate-500">Pemilik Akun</dt>
									<dd className="type-body mt-1 text-slate-900">
										{storeProfile.ownerName}
										<span className="block break-words text-slate-500">
											{storeProfile.ownerEmail ?? ""}
										</span>
									</dd>
								</div>
							) : null}
							{storeProfile.salesName ? (
								<div className="min-w-0">
									<dt className="type-label text-slate-500">Sales Penanggung Jawab</dt>
									<dd className="type-body mt-1 text-slate-900">
										{storeProfile.salesName}
										<span className="block break-words text-slate-500">
											{storeProfile.salesEmail ?? ""}
										</span>
									</dd>
								</div>
							) : null}
						</dl>
					) : (
						<p className="type-body mt-4 text-slate-600">Toko tidak ditemukan.</p>
					)}
				</Card>

				<Card>
					<CardHeader title="Aging Piutang Toko" />
					{loading ? (
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							<Skeleton className="h-16" />
							<Skeleton className="h-16" />
							<Skeleton className="h-16" />
							<Skeleton className="h-16" />
						</div>
					) : aging ? (
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							{agingBuckets.map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
									<p className="type-label text-slate-500">{item.label}</p>
									<p className="type-body mt-1 font-medium text-slate-900">
										{item.bucket.count} invoice
									</p>
									<p className="type-body text-slate-600">{formatRupiah(item.bucket.amount)}</p>
								</div>
							))}
						</div>
					) : (
						<p className="type-body mt-4 text-slate-600">Tidak ada data aging.</p>
					)}
				</Card>
			</section>

			<section className="grid items-start gap-4 lg:grid-cols-2">
				<div className="space-y-3">
					<h2 className="type-title text-slate-900">Order Terbaru</h2>
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
					<h2 className="type-title text-slate-900">Invoice Terbaru</h2>
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
					<h2 className="type-title text-slate-900">Piutang Terdekat</h2>
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
