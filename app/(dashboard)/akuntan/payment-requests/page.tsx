"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	paymentRequestsService,
	type PaymentRequestItem,
	type PaymentRequestStatus,
} from "@/services/payment-requests";

type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type ReviewAction = "approve" | "reject" | "cancel";

const filters: FilterStatus[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "object" && error !== null && "response" in error) {
		const response = (error as { response?: { data?: { message?: unknown } } }).response;
		if (typeof response?.data?.message === "string") return response.data.message;
	}
	return "Terjadi kesalahan saat memproses pengajuan pembayaran.";
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
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function getStoreName(request: PaymentRequestItem) {
	return request.store?.name ?? request.store?.storeName ?? request.invoice?.storeNameSnapshot ?? request.storeId ?? "-";
}

function countStatus(requests: PaymentRequestItem[], status: PaymentRequestStatus) {
	return requests.filter((request) => request.status === status).length;
}

export default function AkuntanPaymentRequestsPage() {
	const [requests, setRequests] = useState<PaymentRequestItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [filter, setFilter] = useState<FilterStatus>("ALL");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [action, setAction] = useState<ReviewAction>("approve");
	const [notes, setNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await paymentRequestsService.list({
				page: 1,
				limit: 100,
				sortBy: "createdAt",
				sortOrder: "desc",
			});
			setRequests(result.items);
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);

	const summary = useMemo(
		() => ({
			total: requests.length,
			pending: countStatus(requests, "PENDING"),
			approved: countStatus(requests, "APPROVED"),
			rejected: countStatus(requests, "REJECTED"),
			cancelled: countStatus(requests, "CANCELLED"),
		}),
		[requests],
	);

	const filteredRequests = useMemo(
		() => (filter === "ALL" ? requests : requests.filter((request) => request.status === filter)),
		[filter, requests],
	);

	const selectedRequest = useMemo(
		() => requests.find((request) => request.id === selectedId) ?? null,
		[requests, selectedId],
	);

	const selectForReview = (request: PaymentRequestItem) => {
		setSelectedId(request.id);
		setAction("approve");
		setNotes("");
		setSuccess(null);
		setError(null);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedRequest) return;
		const trimmedNotes = notes.trim();
		if ((action === "reject" || action === "cancel") && !trimmedNotes) {
			setError(action === "reject" ? "Alasan penolakan wajib diisi." : "Alasan pembatalan wajib diisi.");
			return;
		}

		setSubmitting(true);
		setError(null);
		setSuccess(null);
		try {
			if (action === "approve") {
				await paymentRequestsService.approve(selectedRequest.id, {
					reviewNotes: trimmedNotes || undefined,
				});
				setSuccess("Pengajuan pembayaran disetujui.");
			} else if (action === "reject") {
				await paymentRequestsService.reject(selectedRequest.id, { rejectionReason: trimmedNotes });
				setSuccess("Pengajuan pembayaran ditolak.");
			} else {
				await paymentRequestsService.cancel(selectedRequest.id, { cancelReason: trimmedNotes });
				setSuccess("Pengajuan pembayaran dibatalkan.");
			}
			setSelectedId(null);
			setNotes("");
			await load();
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FeaturePage title="Review Pengajuan Pembayaran" description="Tinjau, setujui, tolak, atau batalkan pengajuan pembayaran toko.">
			<section className="grid gap-4 md:grid-cols-5">
				{[
					["Total", summary.total],
					["Pending", summary.pending],
					["Approved", summary.approved],
					["Rejected", summary.rejected],
					["Cancelled", summary.cancelled],
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
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<h2 className="text-lg font-semibold text-slate-900">Daftar Pengajuan</h2>
					<div className="flex flex-wrap gap-2">
						{filters.map((item) => (
							<button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
								{item}
							</button>
						))}
						<button type="button" onClick={() => void load()} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Refresh</button>
					</div>
				</div>

				{loading ? (
					<div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Memuat pengajuan pembayaran...</div>
				) : filteredRequests.length === 0 ? (
					<div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Belum ada pengajuan pembayaran.</div>
				) : (
					<div className="mt-4 overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
								<tr><th className="px-4 py-3">Request</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Store</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Proof</th><th className="px-4 py-3">Actions</th></tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{filteredRequests.map((request) => (
									<tr key={request.id} className="text-slate-700">
										<td className="px-4 py-3 font-medium text-slate-900">{request.requestNumber ?? request.id}</td>
										<td className="px-4 py-3">{request.invoice?.invoiceNumber ?? request.invoiceId}</td>
										<td className="px-4 py-3">{getStoreName(request)}</td>
										<td className="px-4 py-3">{request.method}</td>
										<td className="px-4 py-3">{formatCurrency(request.amount)}</td>
										<td className="px-4 py-3">{formatDate(request.paymentDate ?? request.createdAt)}</td>
										<td className="px-4 py-3">{request.status}</td>
										<td className="px-4 py-3">{request.proofUrl || request.proofObjectKey ? "Ada" : "-"}</td>
										<td className="px-4 py-3">{request.status === "PENDING" ? <button type="button" onClick={() => selectForReview(request)} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Review</button> : "-"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{selectedRequest ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Panel Review</h2>
					<p className="mt-2 text-sm text-slate-600">{selectedRequest.requestNumber ?? selectedRequest.id} · {formatCurrency(selectedRequest.amount)}</p>
					<form onSubmit={handleSubmit} className="mt-4 grid gap-4">
						<select value={action} onChange={(event) => setAction(event.target.value as ReviewAction)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-xs">
							<option value="approve">Approve</option>
							<option value="reject">Reject</option>
							<option value="cancel">Cancel</option>
						</select>
						<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={action === "approve" ? "Catatan review (opsional)" : "Alasan wajib diisi"} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
						<div className="flex flex-wrap gap-2">
							<button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{submitting ? "Memproses..." : "Kirim Review"}</button>
							<button type="button" onClick={() => setSelectedId(null)} className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700">Batal</button>
						</div>
					</form>
				</section>
			) : null}
		</FeaturePage>
	);
}
