"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	returnsService,
	type CreateReturnPayload,
	type ProductCondition,
	type ReturnListItem,
} from "@/services/returns";

const conditions: ProductCondition[] = ["NEW", "GOOD", "DAMAGED", "DEFECTIVE"];

const initialForm = {
	invoiceId: "",
	invoiceItemId: "",
	requestedQuantity: 1,
	condition: "GOOD" as ProductCondition,
	reason: "",
	notes: "",
};

type ReturnFormState = typeof initialForm;

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null && "response" in error) {
		const response = (error as { response?: { data?: { message?: unknown } } }).response;
		if (typeof response?.data?.message === "string") return response.data.message;
	}
	return "Terjadi kesalahan saat memuat data retur.";
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
	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function totalQuantity(retur: ReturnListItem) {
	return retur.items?.reduce((total, item) => total + item.requestedQuantity, 0) ?? 0;
}

export default function StoreReturnPage() {
	const [returns, setReturns] = useState<ReturnListItem[]>([]);
	const [form, setForm] = useState<ReturnFormState>(initialForm);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const loadReturns = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await returnsService.list({
				page: 1,
				limit: 50,
				sortBy: "createdAt",
				sortOrder: "desc",
			});
			setReturns(result.items);
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void Promise.resolve().then(loadReturns);
	}, [loadReturns]);

	const summary = useMemo(
		() => ({
			total: returns.length,
			requested: returns.filter((item) => item.status === "REQUESTED").length,
			credited: returns.filter((item) => item.status === "CREDITED").length,
		}),
		[returns],
	);

	const updateForm = <K extends keyof ReturnFormState>(key: K, value: ReturnFormState[K]) => {
		setForm((current) => ({ ...current, [key]: value }));
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		setSuccess(null);
		try {
			const payload: CreateReturnPayload = {
				invoiceId: form.invoiceId.trim(),
				reason: form.reason.trim() || undefined,
				notes: form.notes.trim() || undefined,
				items: [
					{
						invoiceItemId: form.invoiceItemId.trim(),
						requestedQuantity: form.requestedQuantity,
						condition: form.condition,
						reason: form.reason.trim() || undefined,
					},
				],
			};
			await returnsService.create(payload);
			setForm(initialForm);
			setSuccess("Pengajuan retur berhasil dibuat.");
			await loadReturns();
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FeaturePage
			title="Pengajuan Retur"
			description="Buat dan pantau pengajuan retur toko dari invoice yang sudah diterbitkan."
		>
			<section className="grid gap-4 md:grid-cols-3">
				{[
					["Total Retur", summary.total],
					["Requested", summary.requested],
					["Credited", summary.credited],
				].map(([label, value]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-sm font-medium text-slate-500">{label}</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Form Retur</h2>
				<form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
					<input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Invoice ID" required value={form.invoiceId} onChange={(e) => updateForm("invoiceId", e.target.value)} />
					<input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Invoice Item ID" required value={form.invoiceItemId} onChange={(e) => updateForm("invoiceItemId", e.target.value)} />
					<input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" min={1} required value={form.requestedQuantity} onChange={(e) => updateForm("requestedQuantity", Math.max(1, Number(e.target.value)))} />
					<select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.condition} onChange={(e) => updateForm("condition", e.target.value as ProductCondition)}>
						{conditions.map((condition) => (
							<option key={condition} value={condition}>{condition}</option>
						))}
					</select>
					<textarea className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Reason (opsional)" rows={3} value={form.reason} onChange={(e) => updateForm("reason", e.target.value)} />
					<textarea className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Notes (opsional)" rows={3} value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} />
					<div className="md:col-span-2 flex items-center gap-3">
						<button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
							{submitting ? "Mengirim..." : "Ajukan Retur"}
						</button>
						{success ? <p className="text-sm font-medium text-emerald-600">{success}</p> : null}
					</div>
				</form>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-slate-900">Daftar Retur</h2>
					<button type="button" onClick={() => void loadReturns()} className="text-sm font-medium text-slate-600 hover:text-slate-900">Refresh</button>
				</div>
				{loading ? (
					<div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Memuat data retur...</div>
				) : error ? (
					<div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
				) : returns.length === 0 ? (
					<div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Belum ada pengajuan retur.</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-4 py-3">No Retur</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Credited</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Reason</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{returns.map((retur) => (
									<tr key={retur.id} className="text-slate-700">
										<td className="px-4 py-3 font-medium text-slate-900">{retur.returnNumber}</td>
										<td className="px-4 py-3">{retur.invoiceId}</td>
										<td className="px-4 py-3">{retur.status}</td>
										<td className="px-4 py-3">{totalQuantity(retur)}</td>
										<td className="px-4 py-3">{formatCurrency(retur.requestedAmount)}</td>
										<td className="px-4 py-3">{formatCurrency(retur.creditedAmount)}</td>
										<td className="px-4 py-3">{formatDate(retur.requestedAt ?? retur.createdAt)}</td>
										<td className="px-4 py-3">{retur.reason ?? "-"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</FeaturePage>
	);
}
