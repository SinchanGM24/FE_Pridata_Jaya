"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { invoiceStatusLabel, paymentMethodLabel, paymentStatusLabel, toUiLabel } from "@/lib/ui-labels";
import {
	invoicesService,
	type InvoiceListItem,
	type InvoiceStatus,
} from "@/services/invoices";
import {
	paymentsService,
	type Payment,
	type PaymentMethod,
} from "@/services/payments";
import { tokoService } from "@/services/toko";
import { readTokoCart } from "@/services/toko-cart";

interface ErrorWithMessage {
	response?: {
		data?: {
			message?: string;
		};
	};
}

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

export default function StoreInvoiceCashPage() {
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [storeName, setStoreName] = useState("Toko");
	const [cartCount, setCartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [selected, setSelected] = useState<InvoiceListItem | null>(null);
	const [filterStatus, setFilterStatus] = useState<"ALL" | InvoiceStatus>("ALL");
	const [payAmount, setPayAmount] = useState(0);
	const [payMethod, setPayMethod] = useState<PaymentMethod>("TRANSFER");
	const [payRef, setPayRef] = useState("");
	const [payNotes, setPayNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [invoiceResult, paymentResult, dashboard] = await Promise.all([
				invoicesService.listAllForToko(),
				paymentsService.listAllForToko(),
				tokoService.getDashboard().catch(() => null),
			]);
			setInvoices(invoiceResult);
			setPayments(paymentResult);
			setStoreName(dashboard?.store?.storeName || "Toko");
			setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
		} catch (err: unknown) {
			setError(
				(err as ErrorWithMessage)?.response?.data?.message ||
					"Gagal memuat data faktur.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const paymentsByInvoice = useMemo(() => {
		const map: Record<string, Payment[]> = {};
		for (const p of payments) {
			if (!map[p.invoiceId]) map[p.invoiceId] = [];
			map[p.invoiceId].push(p);
		}
		return map;
	}, [payments]);

	const filteredInvoices = useMemo(() => {
		if (filterStatus === "ALL") return invoices;
		return invoices.filter((inv) => inv.status === filterStatus);
	}, [invoices, filterStatus]);

	const summary = useMemo(
		() => ({
			total: invoices.length,
			unpaid: invoices.filter((i) => i.status === "UNPAID").length,
			partial: invoices.filter((i) => i.status === "PARTIAL").length,
			paid: invoices.filter((i) => i.status === "PAID").length,
			outstanding: invoices
				.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED")
				.reduce((sum, i) => sum + i.remainingAmount, 0),
		}),
		[invoices],
	);

	const openPayment = (invoice: InvoiceListItem) => {
		setSelected(invoice);
		setPayAmount(invoice.remainingAmount);
		setPayMethod("TRANSFER");
		setPayRef("");
		setPayNotes("");
		setError("");
		setSuccess("");
	};

	const handleSubmitPayment = async () => {
		if (!selected) return;
		if (payAmount <= 0) {
			setError("Jumlah pembayaran harus lebih dari 0.");
			return;
		}
		if (payMethod === "TRANSFER" && !payRef.trim()) {
			setError("Nomor referensi / bukti transfer wajib diisi untuk pembayaran transfer.");
			return;
		}

		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await paymentsService.createForToko({
				invoiceId: selected.id,
				amount: payAmount,
				method: payMethod,
				paymentDate: new Date().toISOString(),
				referenceNo: payMethod === "TRANSFER" ? payRef : undefined,
				notes: payNotes || undefined,
			});
			setSuccess(
				payMethod === "CASH"
					? `Pembayaran tunai ${formatRupiah(payAmount)} berhasil diajukan dan menunggu konfirmasi sales.`
					: `Pembayaran ${formatRupiah(payAmount)} berhasil diajukan dan menunggu verifikasi akuntan.`,
			);
			setSelected(null);
			await load();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal mencatat pembayaran."));
		} finally {
			setSubmitting(false);
		}
	};

	const isSubmitDisabled =
		submitting ||
		!selected ||
		payAmount <= 0 ||
		payAmount > (selected?.remainingAmount ?? 0) ||
		(payMethod === "TRANSFER" && !payRef.trim());

	return (
		<TokoFeatureLayout title="Pembayaran Faktur" cartCount={cartCount}>
			<section className="rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eef7ff_55%,#ffffff_100%)] p-5">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
							Tagihan Toko
						</p>
						<h2 className="mt-2 text-2xl font-semibold text-slate-900">{storeName}</h2>
					</div>
					<div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-right">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sisa Tagihan Aktif</p>
						<p className="mt-2 text-xl font-semibold text-slate-900">{formatRupiah(summary.outstanding)}</p>
					</div>
				</div>
				<p className="mt-4 text-sm leading-6 text-slate-600">
					Ajukan pembayaran untuk faktur yang belum lunas. Transfer akan masuk ke verifikasi akuntan,
					sementara pembayaran tunai akan menunggu konfirmasi sales.
				</p>
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				{[
					{ label: "Total Faktur", value: summary.total },
					{ label: "Belum Bayar", value: summary.unpaid },
					{ label: "Bayar Sebagian", value: summary.partial },
					{ label: "Lunas", value: summary.paid },
					{ label: "Sisa Tagihan", value: formatRupiah(summary.outstanding) },
				].map((item) => (
					<div
						key={item.label}
						className="rounded-3xl border border-slate-200 bg-white p-5"
					>
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">
							{item.label}
						</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="rounded-3xl border border-slate-200 bg-white p-4">
				<div className="flex flex-wrap gap-2">
					{(["ALL", "UNPAID", "PARTIAL", "PAID", "CANCELLED"] as const).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setFilterStatus(s)}
							className={`rounded-full px-4 py-2 text-sm transition ${
								filterStatus === s
									? "bg-slate-900 text-white"
									: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
							}`}
						>
							{s === "ALL" ? "Semua" : toUiLabel(s, invoiceStatusLabel)}
						</button>
					))}
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Muat Ulang
					</button>
				</div>
			</section>

			<section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
				<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
					<div>
						<h3 className="text-sm font-semibold text-slate-900">Daftar Faktur</h3>
						<p className="mt-1 text-xs text-slate-500">
							Tampilan ringkas untuk membaca tagihan aktif dan status pelunasannya.
						</p>
					</div>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Faktur</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Memuat faktur...
								</td>
							</tr>
						) : filteredInvoices.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Tidak ada faktur pada filter ini.
								</td>
							</tr>
						) : (
							filteredInvoices.map((inv) => {
								const invPayments = paymentsByInvoice[inv.id] ?? [];
								const pendingPayment = invPayments.find((p) => p.status === "PENDING");
								return (
									<tr key={inv.id}>
										<td className="px-4 py-3">
											<div className="font-medium text-slate-900">{inv.invoiceNumber}</div>
											<div className="text-xs text-slate-500">
												{invPayments.length} riwayat pembayaran
											</div>
										</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(inv.invoiceDate)}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(inv.dueDate)}</td>
										<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(inv.totalAmount)}</td>
										<td className="px-4 py-3 text-right font-medium text-slate-900">{formatRupiah(inv.remainingAmount)}</td>
										<td className="px-4 py-3">
											<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[inv.status] ?? "border border-slate-200 bg-slate-100 text-slate-700"}`}>
												{toUiLabel(inv.status, invoiceStatusLabel)}
											</span>
										</td>
										<td className="px-4 py-3 text-right">
											{pendingPayment ? (
												<span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
													Menunggu verifikasi
												</span>
											) : inv.status === "UNPAID" || inv.status === "PARTIAL" ? (
												<button
													type="button"
													onClick={() => openPayment(inv)}
													className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
												>
													Ajukan Bayar
												</button>
											) : null}
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</section>

			<section className="rounded-3xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Riwayat Pengajuan Pembayaran</h2>
						<p className="mt-1 text-sm text-slate-500">
							Pantau cicilan yang sudah diajukan beserta metode dan status verifikasinya.
						</p>
					</div>
				</div>
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Faktur</th>
								<th className="px-4 py-3">Tanggal Bayar</th>
								<th className="px-4 py-3">Metode</th>
								<th className="px-4 py-3 text-right">Nominal</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">Referensi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{payments.length === 0 ? (
								<tr>
									<td colSpan={6} className="px-4 py-6 text-center text-slate-500">
										Belum ada pengajuan pembayaran.
									</td>
								</tr>
							) : (
								payments.map((payment) => (
									<tr key={payment.id}>
										<td className="px-4 py-3 font-medium text-slate-900">
											{payment.invoice?.invoiceNumber || payment.invoiceId}
										</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
										<td className="px-4 py-3 text-slate-700">
											<span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
												{toUiLabel(payment.method, paymentMethodLabel)}
											</span>
										</td>
										<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(payment.amount)}</td>
										<td className="px-4 py-3">
											<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[payment.status] ?? "border border-slate-200 bg-slate-100 text-slate-700"}`}>
												{toUiLabel(payment.status, paymentStatusLabel)}
											</span>
										</td>
										<td className="px-4 py-3 text-slate-700">
											{payment.referenceNo || payment.referenceNumber || "-"}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>

			<Modal
				isOpen={Boolean(selected)}
				onClose={() => setSelected(null)}
				title="Ajukan Pembayaran"
			>
				{selected ? (
					<div className="space-y-5">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
								Formulir Pembayaran
							</p>
							<p className="mt-2 text-sm text-slate-600">
								{selected.invoiceNumber} - sisa tagihan {formatRupiah(selected.remainingAmount)}
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Faktur</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">
									{formatRupiah(selected.totalAmount)}
								</p>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-emerald-600">Sudah Dibayar</p>
								<p className="mt-2 text-lg font-semibold text-emerald-700">
									{formatRupiah(selected.paidAmount)}
								</p>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-rose-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-rose-600">Sisa Tagihan</p>
								<p className="mt-2 text-lg font-semibold text-rose-700">
									{formatRupiah(selected.remainingAmount)}
								</p>
							</div>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Jumlah Pembayaran</span>
								<input
									type="number"
									min={1}
									max={selected.remainingAmount}
									className="w-full rounded-xl border border-slate-300 px-3 py-2"
									value={payAmount}
									onChange={(e) => setPayAmount(Number(e.target.value))}
									disabled={submitting}
								/>
							</label>
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Metode Pembayaran</span>
								<select
									className="w-full rounded-xl border border-slate-300 px-3 py-2"
									value={payMethod}
									onChange={(e) => {
										const nextMethod = e.target.value as PaymentMethod;
										setPayMethod(nextMethod);
										if (nextMethod === "CASH") setPayRef("");
									}}
									disabled={submitting}
								>
									<option value="TRANSFER">Transfer</option>
									<option value="CASH">Tunai</option>
								</select>
							</label>
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Nomor Referensi / Bukti Transfer</span>
								<input
									className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
									placeholder={payMethod === "TRANSFER" ? "Wajib untuk transfer" : "Tidak tersedia untuk tunai"}
									value={payRef}
									onChange={(e) => setPayRef(e.target.value)}
									disabled={submitting || payMethod === "CASH"}
								/>
							</label>
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Catatan</span>
								<input
									className="w-full rounded-xl border border-slate-300 px-3 py-2"
									placeholder="Opsional"
									value={payNotes}
									onChange={(e) => setPayNotes(e.target.value)}
									disabled={submitting}
								/>
							</label>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setSelected(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => void handleSubmitPayment()}
								disabled={isSubmitDisabled}
								className="rounded-xl bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
							>
								{submitting ? "Mengajukan..." : "Ajukan Pembayaran"}
							</button>
						</div>
					</div>
				) : null}
			</Modal>
		</TokoFeatureLayout>
	);
}
