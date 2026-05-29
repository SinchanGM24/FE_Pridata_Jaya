"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { cashInvoicesService, type CashInvoiceItem } from "@/services/cash-invoices";
import { paymentRequestsService, type PaymentRequestItem } from "@/services/payment-requests";

const initialForm = {
	invoiceId: "",
	amount: 0,
	referenceNo: "",
	notes: "",
};

type FormState = typeof initialForm;

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null && "response" in error) {
		const response = (error as { response?: { data?: { message?: unknown } } }).response;
		if (typeof response?.data?.message === "string") return response.data.message;
	}
	return "Terjadi kesalahan saat memproses permintaan pembayaran.";
}

function formatCurrency(value?: number | null) {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value ?? 0);
}

function formatDate(value?: string | null) {
	if (!value) return "-";
	return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

export default function TokoPaymentRequestsPage() {
	const [invoices, setInvoices] = useState<CashInvoiceItem[]>([]);
	const [requests, setRequests] = useState<PaymentRequestItem[]>([]);
	const [form, setForm] = useState<FormState>(initialForm);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [uploadingId, setUploadingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [invoiceResult, requestResult] = await Promise.all([
				cashInvoicesService.list({ page: 1, limit: 50, sortBy: "invoiceDate", sortOrder: "desc" }),
				paymentRequestsService.list({ page: 1, limit: 50, sortBy: "createdAt", sortOrder: "desc" }),
			]);
			setInvoices(invoiceResult.items);
			setRequests(requestResult.items);
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);

	const selectedInvoice = useMemo(
		() => invoices.find((invoice) => invoice.id === form.invoiceId) ?? null,
		[form.invoiceId, invoices],
	);

	const summary = useMemo(
		() => ({
			totalInvoices: invoices.length,
			outstandingAmount: invoices.reduce((total, invoice) => total + invoice.remainingAmount, 0),
			pendingRequests: requests.filter((request) => request.status === "PENDING").length,
			approvedRequests: requests.filter((request) => request.status === "APPROVED").length,
		}),
		[invoices, requests],
	);

	const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
		setForm((current) => ({ ...current, [key]: value }));
	};

	const selectInvoice = (invoice: CashInvoiceItem) => {
		setForm((current) => ({ ...current, invoiceId: invoice.id, amount: invoice.remainingAmount }));
		setSuccess(null);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!form.invoiceId) {
			setError("Pilih invoice terlebih dahulu.");
			return;
		}
		setSubmitting(true);
		setError(null);
		setSuccess(null);
		try {
			await cashInvoicesService.createPaymentRequest(form.invoiceId, {
				amount: form.amount,
				referenceNo: form.referenceNo.trim() || undefined,
				notes: form.notes.trim() || undefined,
			});
			setForm(initialForm);
			setSuccess("Pengajuan pembayaran berhasil dibuat.");
			await load();
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setSubmitting(false);
		}
	};

	const handleProofUpload = async (requestId: string, event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		setUploadingId(requestId);
		setError(null);
		setSuccess(null);
		try {
			await paymentRequestsService.uploadProof(requestId, file);
			setSuccess("Bukti pembayaran berhasil diunggah.");
			await load();
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setUploadingId(null);
			event.target.value = "";
		}
	};

	return (
		<FeaturePage title="Pengajuan Pembayaran" description="Buat pengajuan pembayaran invoice tunai dan unggah bukti pembayaran toko.">
			<section className="grid gap-4 md:grid-cols-4">
				{[
					["Total Invoice", summary.totalInvoices],
					["Sisa Tagihan", formatCurrency(summary.outstandingAmount)],
					["Menunggu", summary.pendingRequests],
					["Approved", summary.approvedRequests],
				].map(([label, value]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-sm font-medium text-slate-500">{label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
					</div>
				))}
			</section>

			{success ? <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{success}</div> : null}
			{error ? <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Form Pengajuan</h2>
				<form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:col-span-2">
						Invoice terpilih: <span className="font-semibold text-slate-900">{selectedInvoice?.invoiceNumber ?? "Belum dipilih"}</span>
					</div>
					<input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" min={1} max={selectedInvoice?.remainingAmount ?? undefined} required value={form.amount} onChange={(event) => updateForm("amount", Math.max(1, Number(event.target.value)))} />
					<input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="No referensi (opsional)" value={form.referenceNo} onChange={(event) => updateForm("referenceNo", event.target.value)} />
					<textarea className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Catatan (opsional)" rows={3} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
					<button type="submit" disabled={submitting || !form.invoiceId} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
						{submitting ? "Mengirim..." : "Buat Pengajuan"}
					</button>
				</form>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-slate-900">Invoice Tunai</h2>
					<button type="button" onClick={() => void load()} className="text-sm font-medium text-slate-600 hover:text-slate-900">Refresh</button>
				</div>
				{loading ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Memuat data...</div> : invoices.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Belum ada invoice tunai.</div> : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Sisa</th><th className="px-4 py-3">Aksi</th></tr></thead>
							<tbody className="divide-y divide-slate-100">
								{invoices.map((invoice) => <tr key={invoice.id} className="text-slate-700"><td className="px-4 py-3 font-medium text-slate-900">{invoice.invoiceNumber}</td><td className="px-4 py-3">{formatDate(invoice.invoiceDate)}</td><td className="px-4 py-3">{invoice.status}</td><td className="px-4 py-3">{formatCurrency(invoice.totalAmount)}</td><td className="px-4 py-3">{formatCurrency(invoice.remainingAmount)}</td><td className="px-4 py-3"><button type="button" disabled={invoice.remainingAmount <= 0} onClick={() => selectInvoice(invoice)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">Pilih</button></td></tr>)}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="mb-4 text-lg font-semibold text-slate-900">Pengajuan Pembayaran</h2>
				{loading ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Memuat pengajuan...</div> : requests.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Belum ada pengajuan pembayaran.</div> : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Request</th><th className="px-4 py-3">Invoice ID</th><th className="px-4 py-3">Metode</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Bukti</th></tr></thead>
							<tbody className="divide-y divide-slate-100">
								{requests.map((request) => <tr key={request.id} className="text-slate-700"><td className="px-4 py-3 font-medium text-slate-900">{request.requestNumber ?? request.id}</td><td className="px-4 py-3">{request.invoiceId}</td><td className="px-4 py-3">{request.method}</td><td className="px-4 py-3">{formatCurrency(request.amount)}</td><td className="px-4 py-3">{request.status}</td><td className="px-4 py-3">{request.status === "PENDING" ? <input type="file" disabled={uploadingId === request.id} onChange={(event) => void handleProofUpload(request.id, event)} className="text-xs" /> : request.proofUrl ? "Terunggah" : "-"}</td></tr>)}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</FeaturePage>
	);
}
