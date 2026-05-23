"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Modal from "@/components/shared/Modal";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { invoiceStatusLabel, paymentMethodLabel, paymentStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { paymentsService, type Payment } from "@/services/payments";
import { storesService } from "@/services/stores";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

const statusColors: Record<string, string> = {
	UNPAID: "border border-amber-200 bg-amber-50 text-amber-700",
	PARTIAL: "border border-sky-200 bg-sky-50 text-sky-700",
	PAID: "border border-emerald-200 bg-emerald-50 text-emerald-700",
	CANCELLED: "border border-slate-200 bg-slate-100 text-slate-600",
	PENDING: "border border-amber-200 bg-amber-50 text-amber-700",
	VERIFIED: "border border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function SalesStoreInvoiceCashPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [storeName, setStoreName] = useState(actingStore?.storeName || "Toko");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [selectedPendingPayment, setSelectedPendingPayment] = useState<Payment | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [invoiceResult, paymentResult, store] = await Promise.all([
				invoicesService.listAllForSales({ storeId }),
				paymentsService.listAllForSales({ storeId }),
				storesService.getById(storeId).catch(() => null),
			]);
			setInvoices(invoiceResult);
			setPayments(paymentResult);
			setStoreName(store?.name || actingStore?.storeName || "Toko");
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat invoice pembayaran toko."));
		} finally {
			setLoading(false);
		}
	}, [actingStore?.storeName, storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const pendingCashPayments = useMemo(
		() =>
			payments.filter(
				(item) =>
					item.method === "CASH" &&
					item.status === "PENDING" &&
					item.verificationTarget === "SALES",
			),
		[payments],
	);

	const summary = useMemo(
		() => ({
			totalInvoice: invoices.length,
			sisaTagihan: invoices.reduce((sum, item) => sum + item.remainingAmount, 0),
			menungguKonfirmasi: pendingCashPayments.length,
			riwayatCash: payments.filter((item) => item.method === "CASH").length,
		}),
		[invoices, payments, pendingCashPayments.length],
	);

	const handleVerifyPendingCash = async (paymentId: string) => {
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await paymentsService.verifyForSales(paymentId);
			setSuccess("Pembayaran tunai toko berhasil dikonfirmasi.");
			setSelectedPendingPayment(null);
			await load();
		} catch (verifyError: unknown) {
			setError(getApiErrorMessage(verifyError, "Gagal mengonfirmasi pembayaran tunai toko."));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<TokoFeatureLayout
			title="Invoice Pembayaran"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		>
			<section className="rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eef7ff_55%,#ffffff_100%)] p-5">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
					Konfirmasi Pembayaran
				</p>
				<h2 className="mt-2 text-2xl font-semibold text-slate-900">{storeName}</h2>
				<p className="mt-4 text-sm leading-6 text-slate-600">
					Halaman sales hanya dipakai untuk memeriksa dan mengonfirmasi pembayaran tunai yang diajukan toko.
					Tidak ada lagi pencatatan manual agar alur pembayaran tetap transparan dan aman dari manipulasi.
				</p>
			</section>

			{success ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Total Invoice", value: summary.totalInvoice },
					{ label: "Sisa Tagihan", value: formatRupiah(summary.sisaTagihan) },
					{ label: "Menunggu Konfirmasi", value: summary.menungguKonfirmasi },
					{ label: "Riwayat Tunai", value: summary.riwayatCash },
				].map((item) => (
					<div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-lg font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Pengajuan Tunai Menunggu Konfirmasi</h2>
					<p className="mt-1 text-sm text-slate-500">
						Sales cukup memastikan nominal dan bukti pengajuan dari toko sebelum menekan konfirmasi.
					</p>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Tanggal Bayar</th>
							<th className="px-4 py-3 text-right">Nominal</th>
							<th className="px-4 py-3">Referensi</th>
							<th className="px-4 py-3">Catatan</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{pendingCashPayments.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Tidak ada pengajuan tunai yang menunggu konfirmasi.
								</td>
							</tr>
						) : (
							pendingCashPayments.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{item.invoice?.invoiceNumber || item.invoiceId}
									</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.paymentDate)}</td>
									<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(item.amount)}</td>
									<td className="px-4 py-3 text-slate-700">{item.referenceNo || "-"}</td>
									<td className="px-4 py-3 text-slate-700">{item.notes || "-"}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => setSelectedPendingPayment(item)}
											disabled={submitting}
											className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
										>
											Konfirmasi
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Invoice Toko</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							<th className="px-4 py-3">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">Memuat...</td>
							</tr>
						) : invoices.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">Belum ada invoice.</td>
							</tr>
						) : (
							invoices.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{item.invoiceNumber}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.invoiceDate)}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.dueDate)}</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(item.remainingAmount)}</td>
									<td className="px-4 py-3">
										<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[item.status] ?? "border border-slate-200 bg-slate-100 text-slate-700"}`}>
											{toUiLabel(item.status, invoiceStatusLabel)}
										</span>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Riwayat Pembayaran</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Tanggal Bayar</th>
							<th className="px-4 py-3">Metode</th>
							<th className="px-4 py-3 text-right">Nominal</th>
							<th className="px-4 py-3">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{payments.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">Belum ada riwayat pembayaran.</td>
							</tr>
						) : (
							payments.map((payment) => (
								<tr key={payment.id}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{payment.invoice?.invoiceNumber || payment.invoiceId}
									</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
									<td className="px-4 py-3 text-slate-700">
										{toUiLabel(payment.method, paymentMethodLabel)}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(payment.amount)}</td>
									<td className="px-4 py-3">
										<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[payment.status] ?? "border border-slate-200 bg-slate-100 text-slate-700"}`}>
											{toUiLabel(payment.status, paymentStatusLabel)}
										</span>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<Modal
				isOpen={Boolean(selectedPendingPayment)}
				onClose={() => setSelectedPendingPayment(null)}
				title="Konfirmasi Pembayaran Tunai"
			>
				{selectedPendingPayment ? (
					<div className="space-y-5 text-sm text-slate-700">
						<p className="text-sm leading-6 text-slate-600">
							Periksa kembali data pengajuan tunai dari toko sebelum menekan konfirmasi.
						</p>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-2xl border border-slate-200 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoice</div>
								<div className="mt-2 font-semibold text-slate-900">
									{selectedPendingPayment.invoice?.invoiceNumber || selectedPendingPayment.invoiceId}
								</div>
							</div>
							<div className="rounded-2xl border border-slate-200 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Tanggal Bayar</div>
								<div className="mt-2 font-semibold text-slate-900">
									{dateOnly(selectedPendingPayment.paymentDate)}
								</div>
							</div>
							<div className="rounded-2xl border border-slate-200 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Nominal</div>
								<div className="mt-2 font-semibold text-slate-900">
									{formatRupiah(selectedPendingPayment.amount)}
								</div>
							</div>
							<div className="rounded-2xl border border-slate-200 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Metode</div>
								<div className="mt-2 font-semibold text-slate-900">
									{toUiLabel(selectedPendingPayment.method, paymentMethodLabel)}
								</div>
							</div>
							<div className="rounded-2xl border border-slate-200 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Referensi</div>
								<div className="mt-2 font-semibold text-slate-900">
									{selectedPendingPayment.referenceNo || selectedPendingPayment.referenceNumber || "-"}
								</div>
							</div>
							<div className="rounded-2xl border border-slate-200 p-4">
								<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
								<div className="mt-2">
									<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[selectedPendingPayment.status] ?? "border border-slate-200 bg-slate-100 text-slate-700"}`}>
										{toUiLabel(selectedPendingPayment.status, paymentStatusLabel)}
									</span>
								</div>
							</div>
						</div>
						<div className="rounded-2xl border border-slate-200 p-4">
							<div className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan Toko</div>
							<div className="mt-2 text-slate-700">{selectedPendingPayment.notes || "-"}</div>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setSelectedPendingPayment(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => void handleVerifyPendingCash(selectedPendingPayment.id)}
								disabled={submitting}
								className="rounded-xl bg-emerald-600 px-6 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
							>
								{submitting ? "Mengonfirmasi..." : "Konfirmasi Pembayaran"}
							</button>
						</div>
					</div>
				) : null}
			</Modal>
		</TokoFeatureLayout>
	);
}
