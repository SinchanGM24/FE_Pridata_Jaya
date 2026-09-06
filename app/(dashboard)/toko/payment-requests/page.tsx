"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card, { CardHeader } from "@/components/shared/Card";
import PageFeedback from "@/components/shared/PageFeedback";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { useTokoCartCount } from "@/hooks/useTokoCartCount";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import { statusTone, toUiLabel, invoiceStatusLabel, paymentStatusLabel, paymentMethodLabel } from "@/lib/ui-labels";
import { cashInvoicesService, type CashInvoiceItem } from "@/services/cash-invoices";
import { paymentRequestsService, type PaymentRequestItem } from "@/services/payment-requests";
import { fieldClasses } from "@/components/shared/FormInput";

const initialForm = {
	invoiceId: "",
	amount: 0,
	referenceNo: "",
	notes: "",
};

type FormState = typeof initialForm;

const getErrorMessage = (error: unknown) =>
	getApiErrorMessage(error, "Terjadi kesalahan saat memproses permintaan pembayaran.");

const formatCurrency = (value?: number | null) => formatRupiah(value ?? 0);

const formatDate = (value?: string | null) => (value ? formatAppDate(value) : "-");

export default function TokoPaymentRequestsPage() {
	const cartCount = useTokoCartCount();
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

	const invoiceColumns: ResponsiveColumn<CashInvoiceItem>[] = [
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
			head: "Sisa",
			role: "amount",
			align: "right",
			render: (invoice) => formatCurrency(invoice.remainingAmount),
		},
		{
			key: "invoiceDate",
			head: "Tanggal",
			render: (invoice) => formatDate(invoice.invoiceDate),
		},
		{
			key: "totalAmount",
			head: "Total",
			align: "right",
			render: (invoice) => formatCurrency(invoice.totalAmount),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (invoice) => (
				<Button
					variant={form.invoiceId === invoice.id ? "primary" : "secondary"}
					size="sm"
					disabled={invoice.remainingAmount <= 0}
					onClick={() => selectInvoice(invoice)}
				>
					{form.invoiceId === invoice.id ? "Terpilih" : "Pilih"}
				</Button>
			),
		},
	];

	const requestColumns: ResponsiveColumn<PaymentRequestItem>[] = [
		{
			key: "requestNumber",
			head: "Pengajuan",
			role: "title",
			render: (request) => request.requestNumber ?? "-",
		},
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (request) => (
				<Badge tone={statusTone(request.status)}>
					{toUiLabel(request.status, paymentStatusLabel)}
				</Badge>
			),
		},
		{
			key: "amount",
			head: "Jumlah",
			role: "amount",
			align: "right",
			render: (request) => formatCurrency(request.amount),
		},
		{
			key: "invoice",
			head: "Invoice",
			render: (request) => request.invoice?.invoiceNumber ?? "-",
		},
		{
			key: "method",
			head: "Metode",
			render: (request) => toUiLabel(request.method, paymentMethodLabel),
		},
		{
			key: "proof",
			head: "Bukti Bayar",
			role: "action",
			render: (request) =>
				request.status === "PENDING" ? (
					<label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:min-h-9">
						{uploadingId === request.id ? "Mengunggah..." : "Unggah bukti"}
						<input
							type="file"
							accept="image/*,application/pdf"
							className="sr-only"
							disabled={uploadingId === request.id}
							onChange={(event) => void handleProofUpload(request.id, event)}
						/>
					</label>
				) : request.proofUrl ? (
					<span className="text-sm text-slate-600">Terunggah</span>
				) : (
					<span className="text-sm text-slate-400">-</span>
				),
		},
	];

	return (
		<TokoFeatureLayout title="Pengajuan Pembayaran" cartCount={cartCount}>
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError(null)}
				onDismissSuccess={() => setSuccess(null)}
			/>

			<StatGrid columns={4}>
				<StatCard label="Total Invoice" value={summary.totalInvoices} loading={loading} />
				<StatCard
					label="Sisa Tagihan"
					value={formatCurrency(summary.outstandingAmount)}
					tone={summary.outstandingAmount > 0 ? "danger" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Menunggu"
					value={summary.pendingRequests}
					tone={summary.pendingRequests > 0 ? "warning" : "neutral"}
					loading={loading}
				/>
				<StatCard label="Disetujui" value={summary.approvedRequests} loading={loading} />
			</StatGrid>

			<Card>
				<CardHeader
					title="Form Pengajuan"
					description="Pilih invoice tunai di bawah, isi jumlah pembayaran, lalu kirim pengajuan."
				/>
				<form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:col-span-2">
						Invoice terpilih:{" "}
						<span className="font-semibold text-slate-900">
							{selectedInvoice?.invoiceNumber ?? "Belum dipilih"}
						</span>
						{selectedInvoice ? (
							<span className="block text-xs text-slate-500">
								Sisa tagihan {formatCurrency(selectedInvoice.remainingAmount)}
							</span>
						) : null}
					</div>
					<label className="space-y-1.5">
						<span className="block text-sm font-medium text-slate-700">Jumlah pembayaran</span>
						<input
							className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none"
							type="number"
							inputMode="numeric"
							min={1}
							max={selectedInvoice?.remainingAmount ?? undefined}
							required
							value={form.amount}
							onChange={(event) => updateForm("amount", Math.max(1, Number(event.target.value)))}
						/>
					</label>
					<label className="space-y-1.5">
						<span className="block text-sm font-medium text-slate-700">
							No referensi <span className="font-normal text-slate-400">(opsional)</span>
						</span>
						<input
							className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none"
							placeholder="mis. nomor bukti transfer"
							value={form.referenceNo}
							onChange={(event) => updateForm("referenceNo", event.target.value)}
						/>
					</label>
					<label className="space-y-1.5 md:col-span-2">
						<span className="block text-sm font-medium text-slate-700">
							Catatan <span className="font-normal text-slate-400">(opsional)</span>
						</span>
						<textarea
							className={fieldClasses("control")}
							rows={3}
							value={form.notes}
							onChange={(event) => updateForm("notes", event.target.value)}
						/>
					</label>
					<div className="md:col-span-2">
						<Button
							type="submit"
							variant="commerce"
							disabled={submitting || !form.invoiceId}
							className="w-full sm:w-auto"
						>
							{submitting ? "Mengirim..." : "Buat Pengajuan"}
						</Button>
					</div>
				</form>
			</Card>

			<section className="space-y-3">
				<CardHeader title="Invoice Tunai" description="Pilih invoice yang ingin dibayar." />
				<ResponsiveTable
					columns={invoiceColumns}
					data={invoices}
					getRowKey={(invoice) => invoice.id}
					loading={loading}
					emptyText="Belum ada invoice tunai"
					emptyDescription="Invoice tunai akan muncul di sini setelah fakturis menerbitkannya."
				/>
			</section>

			<section className="space-y-3">
				<CardHeader
					title="Pengajuan Pembayaran"
					description="Unggah bukti bayar selama status masih menunggu."
				/>
				<ResponsiveTable
					columns={requestColumns}
					data={requests}
					getRowKey={(request) => request.id}
					loading={loading}
					emptyText="Belum ada pengajuan pembayaran"
					emptyDescription="Pilih invoice di atas lalu kirim pengajuan pertama Anda."
				/>
			</section>
		</TokoFeatureLayout>
	);
}
