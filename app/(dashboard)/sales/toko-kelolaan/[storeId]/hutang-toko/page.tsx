"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageFeedback from "@/components/shared/PageFeedback";
import Link from "next/link";
import { useParams } from "next/navigation";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { formatAppDate, formatLocalDateInput } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import {
	invoiceStatusLabel,
	paymentMethodLabel,
	paymentStatusLabel,
	statusTone,
	toUiLabel,
} from "@/lib/ui-labels";
import { paymentsService, type Payment } from "@/services/payments";
import { receivableService, type ReceivableRow } from "@/services/receivable";
import { storesService } from "@/services/stores";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";
import { buttonClasses } from "@/components/shared/Button";

const dateOnly = (v?: string | null) => (v ? formatAppDate(v) : "-");

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

export default function SalesStoreReceivablesPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();

	const [rows, setRows] = useState<ReceivableRow[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [selectedRow, setSelectedRow] = useState<ReceivableRow | null>(null);
	const [storeName, setStoreName] = useState(actingStore?.storeName || "Toko");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [today] = useState(() => formatLocalDateInput());

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [receivables, store] = await Promise.all([
				receivableService.listAllForSales({ storeId }),
				storesService.getById(storeId).catch(() => null),
			]);
			const paymentRows = await paymentsService.listAllForSales({
				storeId,
				sortBy: "paymentDate",
				sortOrder: "desc",
			});
			setRows(receivables);
			setPayments(paymentRows);
			setStoreName(store?.name || actingStore?.storeName || "Toko");
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat tagihan toko kelolaan."));
		} finally {
			setLoading(false);
		}
	}, [actingStore?.storeName, storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const summary = useMemo(() => {
		const totalOutstanding = rows.reduce((sum, item) => sum + Number(item.remainingAmount || 0), 0);
		const overdueCount = rows.filter((item) => item.dueDate && dateOnly(item.dueDate) < today).length;
		return {
			totalOutstanding,
			overdueCount,
			totalDocuments: rows.length,
		};
	}, [rows, today]);
	const paymentsByInvoice = useMemo(() => {
		const map: Record<string, Payment[]> = {};
		for (const payment of payments) {
			if (!map[payment.invoiceId]) map[payment.invoiceId] = [];
			map[payment.invoiceId].push(payment);
		}
		return map;
	}, [payments]);
	const selectedPayments = selectedRow ? paymentsByInvoice[selectedRow.id] ?? [] : [];

	const receivableColumns: ResponsiveColumn<ReceivableRow>[] = [
		{ key: "invoiceNumber", head: "Invoice", role: "title" },
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (item) => (
				<Badge tone={statusTone(item.status)}>
					{toUiLabel(item.status, invoiceStatusLabel)}
				</Badge>
			),
		},
		{
			key: "remainingAmount",
			head: "Sisa Tagihan",
			role: "amount",
			align: "right",
			render: (item) => (
				<span className="font-semibold text-rose-700">{formatRupiah(item.remainingAmount)}</span>
			),
		},
		{
			key: "store",
			head: "Toko",
			render: (item) => item.storeNameSnapshot ?? item.customerName ?? "-",
		},
		{ key: "dueDate", head: "Jatuh Tempo", render: (item) => dateOnly(item.dueDate) },
		{
			key: "totalAmount",
			head: "Total",
			align: "right",
			render: (item) => formatRupiah(item.totalAmount ?? item.amount),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (item) => (
				<Button variant="secondary" size="sm" onClick={() => setSelectedRow(item)}>
					Detail
				</Button>
			),
		},
	];

	return (
		<TokoFeatureLayout
			title="Tagihan & Pembayaran"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		>
			<section className="rounded-lg border border-brand-100 bg-brand-50 p-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-sm font-semibold text-slate-900">{storeName}</p>
						<p className="text-xs text-slate-600">
						Pantau tagihan toko kelolaan dan lanjutkan pencatatan pembayaran dari sisi sales.
						</p>
					</div>
					<Link
						href={`/sales/riwayat-transaksi?storeId=${storeId}`}
						className={buttonClasses("secondary", "sm")}
					>
						Catat Pembayaran
					</Link>
				</div>
			</section>

			<PageFeedback error={error} onDismissError={() => setError("")} onRetry={() => void load()} />

			<StatGrid columns={3}>
				<StatCard
					label="Total Tagihan Berjalan"
					value={formatRupiah(summary.totalOutstanding)}
					tone={summary.totalOutstanding > 0 ? "warning" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Sudah Lewat Jatuh Tempo"
					value={summary.overdueCount}
					tone={summary.overdueCount > 0 ? "danger" : "success"}
					loading={loading}
				/>
				<StatCard label="Total Dokumen" value={summary.totalDocuments} loading={loading} />
			</StatGrid>

			<section className="space-y-3">
				<h2 className="text-base font-semibold text-slate-900 sm:text-lg">Daftar Tagihan</h2>
				<ResponsiveTable
					columns={receivableColumns}
					data={rows}
					getRowKey={(item) => item.id}
					loading={loading}
					onRowClick={(item) => setSelectedRow(item)}
					emptyText="Tidak ada tagihan berjalan"
					emptyDescription="Semua tagihan toko ini sudah lunas."
				/>
			</section>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => setSelectedRow(null)}
				title={selectedRow ? `Detail Tagihan ${selectedRow.invoiceNumber}` : "Detail Tagihan"}
				maxWidthClassName="max-w-5xl"
			>
				{selectedRow ? (
					<div className="space-y-5 text-sm text-slate-700">
						<div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
							<div>
								<p className="text-xs text-slate-500">Invoice</p>
								<p className="font-semibold text-slate-900">{selectedRow.invoiceNumber}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Toko</p>
								<p className="font-semibold text-slate-900">
									{selectedRow.storeNameSnapshot ?? selectedRow.customerName ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Jatuh Tempo</p>
								<p className="font-semibold text-slate-900">{dateOnly(selectedRow.dueDate)}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status</p>
								<p className="font-semibold text-slate-900">{selectedRow.status}</p>
							</div>
						</div>

						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-2xl border border-slate-200 bg-white p-4">
								<p className="type-label text-slate-500">Total</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">
									{formatRupiah(selectedRow.totalAmount ?? selectedRow.amount)}
								</p>
							</div>
							<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
								<p className="type-label text-emerald-700">Terbayar</p>
								<p className="mt-2 text-lg font-semibold text-emerald-700">
									{formatRupiah(Math.max(0, (selectedRow.totalAmount ?? selectedRow.amount) - selectedRow.remainingAmount))}
								</p>
							</div>
							<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
								<p className="type-label text-rose-700">Sisa</p>
								<p className="mt-2 text-lg font-semibold text-rose-700">
									{formatRupiah(selectedRow.remainingAmount)}
								</p>
							</div>
						</div>

						<div className="overflow-hidden rounded-2xl border border-slate-200">
							<div className="border-b border-slate-100 bg-white px-4 py-3">
								<h3 className="font-semibold text-slate-900">Detail Riwayat Pembayaran</h3>
							</div>
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-slate-200 text-sm">
									<thead className="bg-slate-50 text-left type-label text-slate-500">
										<tr>
											<th className="px-4 py-3">Tanggal</th>
											<th className="px-4 py-3">Metode</th>
											<th className="px-4 py-3 text-right">Nominal</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3">Referensi</th>
											<th className="px-4 py-3">Catatan</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{selectedPayments.length ? (
											selectedPayments.map((payment) => (
												<tr key={payment.id}>
													<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
													<td className="px-4 py-3 text-slate-700">
														{toUiLabel(payment.method, paymentMethodLabel)}
													</td>
													<td className="px-4 py-3 text-right font-semibold text-slate-900">
														{formatRupiah(payment.amount)}
													</td>
													<td className="px-4 py-3 text-slate-700">
														{toUiLabel(payment.status, paymentStatusLabel)}
													</td>
													<td className="px-4 py-3 text-slate-700">
														{payment.referenceNo || payment.referenceNumber || "-"}
													</td>
													<td className="px-4 py-3 text-slate-700">{payment.notes || "-"}</td>
												</tr>
											))
										) : (
											<tr>
												<td colSpan={6} className="px-4 py-6 text-center text-slate-500">
													Belum ada riwayat pembayaran untuk invoice ini.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>

						<div className="flex justify-end gap-3">
							<Link
								href={`/sales/riwayat-transaksi?storeId=${storeId}`}
								className={buttonClasses("primary", "md")}
							>
								Input Pembayaran
							</Link>
						</div>
					</div>
				) : null}
			</Modal>
		</TokoFeatureLayout>
	);
}
