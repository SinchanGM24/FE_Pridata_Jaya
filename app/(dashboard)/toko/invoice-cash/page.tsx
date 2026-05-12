"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { invoicesService, type InvoiceListItem, type InvoiceStatus } from "@/services/invoices";
import { paymentsService, type Payment, type PaymentMethod } from "@/services/payments";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

const statusColors: Record<string, string> = {
	UNPAID: "bg-amber-100 text-amber-800",
	PARTIAL: "bg-blue-100 text-blue-800",
	PAID: "bg-emerald-100 text-emerald-800",
	CANCELLED: "bg-slate-100 text-slate-600",
};

export default function StoreInvoiceCashPage() {
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [selected, setSelected] = useState<InvoiceListItem | null>(null);
	const [filterStatus, setFilterStatus] = useState<"ALL" | InvoiceStatus>("ALL");

	const [payAmount, setPayAmount] = useState(0);
	const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
	const [payRef, setPayRef] = useState("");
	const [payNotes, setPayNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [invoiceResult, paymentResult] = await Promise.all([
				invoicesService.listForToko({ page: 1, limit: 100 }),
				paymentsService.listForToko({ page: 1, limit: 100 }),
			]);
			setInvoices(invoiceResult.items);
			setPayments(paymentResult.items);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat data invoice.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, []);

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

	const summary = useMemo(() => ({
		total: invoices.length,
		unpaid: invoices.filter((i) => i.status === "UNPAID").length,
		partial: invoices.filter((i) => i.status === "PARTIAL").length,
		paid: invoices.filter((i) => i.status === "PAID").length,
		outstanding: invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED")
			.reduce((sum, i) => sum + i.remainingAmount, 0),
	}), [invoices]);

	const openPayment = (invoice: InvoiceListItem) => {
		setSelected(invoice);
		setPayAmount(invoice.remainingAmount);
		setPayMethod("CASH");
		setPayRef("");
		setPayNotes("");
		setError("");
		setSuccess("");
	};

	const handleSubmitPayment = async () => {
		if (!selected) return;
		if (payAmount <= 0) { setError("Jumlah pembayaran harus lebih dari 0."); return; }
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await paymentsService.createForToko({
				invoiceId: selected.id,
				amount: payAmount,
				method: payMethod,
				referenceNo: payRef || undefined,
				notes: payNotes || undefined,
			});
			setSuccess(`Pembayaran sebesar ${formatRupiah(payAmount)} berhasil dicatat. Menunggu verifikasi akuntan.`);
			setSelected(null);
			await load();
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal mencatat pembayaran.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FeaturePage
			title="Invoice dan Pembayaran"
			description="Daftar invoice toko. Pilih invoice yang belum lunas untuk mengajukan pembayaran cash atau transfer ke akuntan untuk diverifikasi."
		>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				{[
					{ label: "Total Invoice", value: summary.total },
					{ label: "Belum Bayar", value: summary.unpaid },
					{ label: "Sebagian", value: summary.partial },
					{ label: "Lunas", value: summary.paid },
					{ label: "Outstanding", value: formatRupiah(summary.outstanding), wide: true },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
			) : null}
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap gap-2">
					{(["ALL", "UNPAID", "PARTIAL", "PAID", "CANCELLED"] as const).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setFilterStatus(s)}
							className={`rounded-full px-4 py-2 text-sm transition ${filterStatus === s ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
						>
							{s === "ALL" ? "Semua" : s}
						</button>
					))}
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Outstanding</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={7} className="px-4 py-4 text-slate-600">Memuat invoice...</td></tr>
						) : filteredInvoices.length === 0 ? (
							<tr><td colSpan={7} className="px-4 py-4 text-slate-600">Tidak ada invoice pada filter ini.</td></tr>
						) : (
							filteredInvoices.map((inv) => {
								const invPayments = paymentsByInvoice[inv.id] ?? [];
								const pendingPayment = invPayments.find((p) => p.status === "PENDING");
								return (
									<tr key={inv.id}>
										<td className="px-4 py-3">
											<div className="font-medium text-slate-900">{inv.invoiceNumber}</div>
											<div className="text-xs text-slate-500">{invPayments.length} pembayaran</div>
										</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(inv.invoiceDate)}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(inv.dueDate)}</td>
										<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(inv.totalAmount)}</td>
										<td className="px-4 py-3 text-right font-medium text-slate-900">{formatRupiah(inv.remainingAmount)}</td>
										<td className="px-4 py-3">
											<span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[inv.status] ?? "bg-slate-100 text-slate-700"}`}>
												{inv.status}
											</span>
										</td>
										<td className="px-4 py-3 text-right">
											{pendingPayment ? (
												<span className="text-xs text-amber-600">Menunggu verifikasi</span>
											) : inv.status === "UNPAID" || inv.status === "PARTIAL" ? (
												<button
													type="button"
													onClick={() => openPayment(inv)}
													className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
												>
													Bayar
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

			{selected ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Form Pembayaran</h2>
							<p className="mt-1 text-sm text-slate-600">
								{selected.invoiceNumber} — outstanding {formatRupiah(selected.remainingAmount)}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setSelected(null)}
							className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
						>
							Tutup
						</button>
					</div>
					<div className="mt-5 grid gap-4 md:grid-cols-2">
						<label className="space-y-1.5 text-sm text-slate-700">
							<span>Jumlah Pembayaran</span>
							<input
								type="number" min={1} max={selected.remainingAmount}
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
								onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
								disabled={submitting}
							>
								<option value="CASH">Cash</option>
								<option value="TRANSFER">Transfer</option>
								<option value="GIRO">Giro</option>
								<option value="OTHER">Lainnya</option>
							</select>
						</label>
						<label className="space-y-1.5 text-sm text-slate-700">
							<span>Nomor Referensi / Bukti Transfer</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								placeholder="Opsional"
								value={payRef}
								onChange={(e) => setPayRef(e.target.value)}
								disabled={submitting}
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
					<div className="mt-5 flex justify-end gap-3">
						<button
							type="button"
							onClick={() => setSelected(null)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleSubmitPayment}
							disabled={submitting}
							className="rounded-xl bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{submitting ? "Mencatat..." : "Catat Pembayaran"}
						</button>
					</div>
				</section>
			) : null}
		</FeaturePage>
	);
}
