"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Modal from "@/components/shared/Modal";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { formatLocalDateInput } from "@/lib/datetime";
import { paymentMethodLabel, paymentStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { paymentsService, type Payment } from "@/services/payments";
import { receivableService, type ReceivableRow } from "@/services/receivable";
import { storesService } from "@/services/stores";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

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

	return (
		<TokoFeatureLayout
			title="Tagihan & Pembayaran"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		>
			<section className="rounded-lg border border-sky-100 bg-sky-50 p-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-sm font-semibold text-slate-900">{storeName}</p>
						<p className="text-xs text-slate-600">
						Pantau tagihan toko kelolaan dan lanjutkan pencatatan pembayaran dari sisi sales.
						</p>
					</div>
					<Link
						href={`/sales/riwayat-transaksi?storeId=${storeId}`}
						className="inline-flex rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
					>
						Catat Pembayaran
					</Link>
				</div>
			</section>

			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-xs text-slate-500">Total Tagihan Berjalan</p>
					<p className="mt-2 text-xl font-bold text-slate-900">{formatRupiah(summary.totalOutstanding)}</p>
				</div>
				<div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
					<p className="text-xs text-rose-700">Sudah Lewat Jatuh Tempo</p>
					<p className="mt-2 text-xl font-bold text-rose-700">{summary.overdueCount}</p>
				</div>
				<div className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm">
					<p className="text-xs text-sky-700">Total Dokumen</p>
					<p className="mt-2 text-xl font-bold text-sky-700">{summary.totalDocuments}</p>
				</div>
			</section>

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Daftar Tagihan</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Memuat data tagihan...</td></tr>
						) : rows.length === 0 ? (
							<tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada tagihan berjalan untuk toko ini.</td></tr>
						) : (
							rows.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{item.invoiceNumber}</td>
									<td className="px-4 py-3 text-slate-700">{item.storeNameSnapshot ?? item.customerName ?? "-"}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.dueDate)}</td>
									<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(item.totalAmount ?? item.amount)}</td>
									<td className="px-4 py-3 text-right font-semibold text-rose-700">{formatRupiah(item.remainingAmount)}</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{item.status}</span>
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => setSelectedRow(item)}
											className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
										>
											Detail
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
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
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">
									{formatRupiah(selectedRow.totalAmount ?? selectedRow.amount)}
								</p>
							</div>
							<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Terbayar</p>
								<p className="mt-2 text-lg font-semibold text-emerald-700">
									{formatRupiah(Math.max(0, (selectedRow.totalAmount ?? selectedRow.amount) - selectedRow.remainingAmount))}
								</p>
							</div>
							<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-rose-700">Sisa</p>
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
									<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
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
								className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
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
