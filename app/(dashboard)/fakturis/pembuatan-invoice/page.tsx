"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CancelReasonModal from "@/components/fakturis/CancelReasonModal";
import InvoiceDraftWorkspace from "@/components/fakturis/InvoiceDraftWorkspace";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { invoiceDraftsService, type InvoiceDraftListItem } from "@/services/invoice-drafts";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: unknown }).response === "object" &&
		(error as { response?: { data?: { message?: string } } }).response?.data?.message
	) {
		return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
	}
	return fallback;
};

async function readOptionalByOrder<T>(reader: (orderId: string) => Promise<T>, orderId: string) {
	try {
		return await reader(orderId);
	} catch (error: unknown) {
		if (
			typeof error === "object" &&
			error !== null &&
			"response" in error &&
			typeof (error as { response?: { status?: number } }).response?.status === "number" &&
			(error as { response?: { status?: number } }).response?.status === 404
		) {
			return null;
		}
		throw error;
	}
}

function PembuatanInvoicePageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const orderIdParam = searchParams.get("orderId");

	const [order, setOrder] = useState<OrderListItem | null>(null);
	const [draft, setDraft] = useState<InvoiceDraftListItem | null>(null);
	const [invoice, setInvoice] = useState<InvoiceListItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);
	const [notes, setNotes] = useState("");
	const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<InvoiceListItem | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const load = useCallback(async () => {
		if (!orderIdParam) {
			setOrder(null);
			setDraft(null);
			setInvoice(null);
			setNotes("");
			setLoading(false);
			return;
		}

		setLoading(true);
		setError("");
		try {
			const [orderResult, draftResult, invoiceResult] = await Promise.all([
				ordersService.getById(orderIdParam),
				readOptionalByOrder(invoiceDraftsService.getByOrderId, orderIdParam),
				readOptionalByOrder(invoicesService.getByOrderId, orderIdParam),
			]);

			let activeDraft = draftResult;
			if (orderResult && !draftResult && !invoiceResult) {
				activeDraft = await invoiceDraftsService.createFromOrder(orderResult.id);
			}

			setOrder(orderResult);
			setDraft(activeDraft);
			setInvoice(invoiceResult);
			setNotes(activeDraft?.notes ?? "");
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat halaman invoice."));
			setOrder(null);
			setDraft(null);
			setInvoice(null);
			setNotes("");
		} finally {
			setLoading(false);
		}
	}, [orderIdParam]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [load]);

	const openBack = () => {
		router.push("/fakturis/pesanan-masuk");
	};

	const buildInvoicePayload = () => ({
		notes: notes.trim() || undefined,
	});

	const handleFinalizeDraft = async (activeDraft: InvoiceDraftListItem, activeOrder: OrderListItem) => {
		setActionId(activeDraft.id);
		setError("");
		setSuccess("");
		try {
			const result = await invoiceDraftsService.finalize(activeDraft.id, buildInvoicePayload());
			setSuccess(`Invoice ${result.invoice.invoiceNumber} berhasil difinalisasi untuk ${activeOrder.orderNumber}.`);
			await load();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal mengirim invoice ke gudang."));
		} finally {
			setActionId(null);
		}
	};

	const handleCancelInvoice = async () => {
		if (!cancelInvoiceTarget || !cancelReason.trim()) return;

		setActionId(cancelInvoiceTarget.id);
		setError("");
		setSuccess("");
		try {
			await invoicesService.cancel(cancelInvoiceTarget.id, cancelReason.trim());
			setSuccess(`Invoice ${cancelInvoiceTarget.invoiceNumber} berhasil dibatalkan.`);
			setCancelInvoiceTarget(null);
			setCancelReason("");
			await load();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal membatalkan invoice."));
		} finally {
			setActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Pembuatan Invoice"
			description="Halaman fakturis untuk menyusun invoice pesanan yang akan diteruskan ke gudang."
		>
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			{!orderIdParam ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Halaman Invoice Dibuka Dari Pesanan Masuk</h2>
					<p className="mt-2 max-w-3xl text-sm text-slate-600">
						Halaman ini tidak dipakai sebagai daftar kerja terpisah. Buka order dari menu
						`Pesanan Masuk`, lalu lanjutkan verifikasi atau edit draft terakhir dari sana.
					</p>
					<div className="mt-5">
						<button
							type="button"
							onClick={openBack}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
						>
							Buka Pesanan Masuk
						</button>
					</div>
				</section>
			) : loading ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
					Memuat halaman invoice...
				</section>
			) : order ? (
				<div className="space-y-4">
					<InvoiceDraftWorkspace
						key={`${order.id}:${draft?.id ?? "none"}:${invoice?.id ?? "none"}`}
						order={order}
						draft={draft}
						invoice={invoice}
						notes={notes}
						submitting={Boolean(actionId)}
						onNotesChange={setNotes}
						onBack={openBack}
						onFinalizeDraft={handleFinalizeDraft}
						onCancelInvoice={(activeInvoice) => {
							setCancelInvoiceTarget(activeInvoice);
							setCancelReason("");
						}}
					/>
				</div>
			) : (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
					Order tidak ditemukan atau sudah tidak bisa diproses ke invoice.
				</section>
			)}

			<CancelReasonModal
				isOpen={Boolean(cancelInvoiceTarget)}
				title="Batalkan Invoice"
				description={
					cancelInvoiceTarget
						? `Invoice ${cancelInvoiceTarget.invoiceNumber} akan dibatalkan. Alasan pembatalan wajib diisi.`
						: ""
				}
				reason={cancelReason}
				submitting={Boolean(actionId)}
				onReasonChange={setCancelReason}
				onClose={() => {
					setCancelInvoiceTarget(null);
					setCancelReason("");
				}}
				onConfirm={handleCancelInvoice}
			/>
		</FeaturePage>
	);
}

export default function PembuatanInvoicePage() {
	return (
		<Suspense
			fallback={
				<FeaturePage
					title="Pembuatan Invoice"
					description="Menyiapkan workspace invoice fakturis."
				>
					<div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
						Memuat...
					</div>
				</FeaturePage>
			}
		>
			<PembuatanInvoicePageContent />
		</Suspense>
	);
}
