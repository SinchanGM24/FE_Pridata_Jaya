"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
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
	const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
	const [amount, setAmount] = useState("0");
	const [referenceNo, setReferenceNo] = useState("");
	const [notes, setNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);

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
			if (!selectedInvoiceId && invoiceResult[0]) {
				setSelectedInvoiceId(invoiceResult[0].id);
				setAmount(String(invoiceResult[0].remainingAmount));
			}
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat invoice pembayaran toko."));
		} finally {
			setLoading(false);
		}
	}, [actingStore?.storeName, selectedInvoiceId, storeId]);

	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const selectedInvoice = useMemo(
		() => invoices.find((item) => item.id === selectedInvoiceId) ?? null,
		[invoices, selectedInvoiceId],
	);

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
			total: invoices.length,
			outstanding: invoices.reduce((sum, item) => sum + item.remainingAmount, 0),
			pendingCash: pendingCashPayments.length,
			recordedCash: payments.filter((item) => item.method === "CASH").length,
		}),
		[invoices, payments, pendingCashPayments.length],
	);

	const handleCreateCashPayment = async () => {
		if (!selectedInvoice) {
			setError("Pilih invoice yang akan dibayarkan.");
			return;
		}

		const numericAmount = Number(amount);
		if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
			setError("Nominal pembayaran cash harus lebih dari 0.");
			return;
		}

		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await paymentsService.createForSales({
				invoiceId: selectedInvoice.id,
				amount: numericAmount,
				method: "CASH",
				referenceNo: referenceNo || undefined,
				notes: notes || undefined,
			});
			setSuccess(
				`Pembayaran cash ${formatRupiah(numericAmount)} berhasil dicatat sales dan langsung masuk ke invoice.`,
			);
			setReferenceNo("");
			setNotes("");
			await load();
		} catch (submitError: unknown) {
			setError(getApiErrorMessage(submitError, "Gagal mencatat pembayaran cash oleh sales."));
		} finally {
			setSubmitting(false);
		}
	};

	const handleVerifyPendingCash = async (paymentId: string) => {
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await paymentsService.verifyForSales(paymentId);
			setSuccess("Pembayaran cash toko berhasil dikonfirmasi sales.");
			await load();
		} catch (verifyError: unknown) {
			setError(getApiErrorMessage(verifyError, "Gagal mengonfirmasi pembayaran cash toko."));
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
			<div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
				Halaman ini sekarang mendukung dua flow cash: sales bisa mencatat cash toko offline secara langsung,
				dan juga mengonfirmasi pengajuan cash yang dibuat dari akun toko.
			</div>

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
					{ label: "Total Invoice", value: summary.total },
					{ label: "Outstanding", value: formatRupiah(summary.outstanding) },
					{ label: "Cash Menunggu Sales", value: summary.pendingCash },
					{ label: "Riwayat Cash", value: summary.recordedCash },
				].map((item) => (
					<div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-lg font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Catat Pembayaran Cash Offline</h2>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Invoice</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={selectedInvoiceId}
							onChange={(event) => {
								setSelectedInvoiceId(event.target.value);
								const invoice = invoices.find((item) => item.id === event.target.value);
								setAmount(String(invoice?.remainingAmount ?? 0));
							}}
							disabled={submitting || loading}
						>
							<option value="">Pilih invoice</option>
							{invoices
								.filter((item) => item.status !== "PAID" && item.status !== "CANCELLED")
								.map((item) => (
									<option key={item.id} value={item.id}>
										{item.invoiceNumber} - outstanding {formatRupiah(item.remainingAmount)}
									</option>
								))}
						</select>
					</label>
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Nominal Cash</span>
						<input
							type="number"
							min={1}
							max={selectedInvoice?.remainingAmount ?? undefined}
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
							disabled={submitting}
						/>
					</label>
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Referensi / Kuitansi</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={referenceNo}
							onChange={(event) => setReferenceNo(event.target.value)}
							disabled={submitting}
							placeholder="Nomor kuitansi / bukti fisik"
						/>
					</label>
					<label className="space-y-1.5 text-sm text-slate-700">
						<span>Catatan</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							disabled={submitting}
							placeholder="Opsional"
						/>
					</label>
				</div>
				<div className="mt-4 flex justify-end">
					<button
						type="button"
						onClick={() => void handleCreateCashPayment()}
						disabled={submitting || loading}
						className="rounded-xl bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
					>
						{submitting ? "Menyimpan..." : "Catat Cash"}
					</button>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Pengajuan Cash Menunggu Konfirmasi Sales</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Tanggal Bayar</th>
							<th className="px-4 py-3 text-right">Nominal</th>
							<th className="px-4 py-3">Referensi</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{pendingCashPayments.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">
									Tidak ada pengajuan cash yang menunggu sales.
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
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => void handleVerifyPendingCash(item.id)}
											disabled={submitting}
											className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
										>
											Konfirmasi Cash
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Invoice Toko</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
							<th className="px-4 py-3">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
						) : invoices.length === 0 ? (
							<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Belum ada invoice.</td></tr>
						) : (
							invoices.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{item.invoiceNumber}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.invoiceDate)}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.dueDate)}</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(item.remainingAmount)}</td>
									<td className="px-4 py-3 text-slate-700">{item.status}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</TokoFeatureLayout>
	);
}
