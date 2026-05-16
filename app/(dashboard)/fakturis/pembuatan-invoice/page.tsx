"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CancelReasonModal from "@/components/fakturis/CancelReasonModal";
import InvoiceDraftWorkspace from "@/components/fakturis/InvoiceDraftWorkspace";
import OrderDetailModal from "@/components/fakturis/OrderDetailModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { invoiceDraftsService, type InvoiceDraftListItem } from "@/services/invoice-drafts";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

type CancelTarget =
	| { kind: "draft"; item: InvoiceDraftListItem }
	| { kind: "invoice"; item: InvoiceListItem };

type WorkflowFilter = "all" | "ready" | "draft" | "final" | "cancelled";

const statusBadgeClassName: Record<string, string> = {
	DRAFT: "bg-amber-100 text-amber-800",
	FINALIZED: "bg-blue-100 text-blue-800",
	CANCELLED: "bg-rose-100 text-rose-800",
	UNPAID: "bg-amber-100 text-amber-800",
	PARTIAL: "bg-blue-100 text-blue-800",
	PAID: "bg-emerald-100 text-emerald-800",
};

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

function PembuatanInvoicePageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const orderIdParam = searchParams.get("orderId");

	const [orders, setOrders] = useState<OrderListItem[]>([]);
	const [invoiceMap, setInvoiceMap] = useState<Record<string, InvoiceListItem | null>>({});
	const [draftMap, setDraftMap] = useState<Record<string, InvoiceDraftListItem | null>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);
	const [dueDates, setDueDates] = useState<Record<string, string>>({});
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [search, setSearch] = useState("");
	const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>("all");
	const [detailOrder, setDetailOrder] = useState<OrderListItem | null>(null);
	const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [orderResult, invoiceResult, draftResult] = await Promise.all([
				ordersService.list({
					page: 1,
					limit: 50,
					status: "PROCESSED",
					search: search || undefined,
				}),
				invoicesService.list({ page: 1, limit: 100, sortBy: "invoiceDate", sortOrder: "desc" }),
				invoiceDraftsService.list({ page: 1, limit: 100, sortBy: "draftDate", sortOrder: "desc" }),
			]);

			setOrders(orderResult.items);

			const invoiceByOrderId = new Map(invoiceResult.items.map((invoice) => [invoice.orderId, invoice] as const));
			const draftByOrderId = new Map(draftResult.items.map((draft) => [draft.orderId, draft] as const));

			setInvoiceMap(
				Object.fromEntries(orderResult.items.map((order) => [order.id, invoiceByOrderId.get(order.id) ?? null])),
			);
			setDraftMap(
				Object.fromEntries(orderResult.items.map((order) => [order.id, draftByOrderId.get(order.id) ?? null])),
			);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat order siap invoice."));
		} finally {
			setLoading(false);
		}
	}, [search]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [load]);

	const rows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return orders.filter((order) => {
			const matchSearch =
				!query ||
				order.orderNumber.toLowerCase().includes(query) ||
				order.storeNameSnapshot.toLowerCase().includes(query);
			const invoice = invoiceMap[order.id];
			const draft = draftMap[order.id];
			const matchWorkflow =
				workflowFilter === "all" ||
				(workflowFilter === "ready" && !invoice && !draft) ||
				(workflowFilter === "draft" && Boolean(draft) && draft?.status === "DRAFT") ||
				(workflowFilter === "final" &&
					(Boolean(invoice) || Boolean(draft && draft.status === "FINALIZED"))) ||
				(workflowFilter === "cancelled" &&
					(invoice?.status === "CANCELLED" || draft?.status === "CANCELLED"));
			return matchSearch && matchWorkflow;
		});
	}, [draftMap, invoiceMap, orders, search, workflowFilter]);

	const summary = useMemo(
		() => ({
			totalOrders: orders.length,
			ready: orders.filter((order) => !invoiceMap[order.id] && !draftMap[order.id]).length,
			draft: orders.filter((order) => draftMap[order.id]?.status === "DRAFT").length,
			finalized: orders.filter((order) => Boolean(invoiceMap[order.id])).length,
		}),
		[draftMap, invoiceMap, orders],
	);

	const activeOrder = useMemo(
		() => rows.find((order) => order.id === orderIdParam) ?? orders.find((order) => order.id === orderIdParam) ?? null,
		[orderIdParam, orders, rows],
	);

	const selectedDraft = activeOrder ? draftMap[activeOrder.id] : null;
	const selectedInvoice = activeOrder ? invoiceMap[activeOrder.id] : null;

	const handleDueDateChange = useCallback(
		(value: string) => {
			if (!activeOrder) return;
			setDueDates((prev) => ({ ...prev, [activeOrder.id]: value }));
		},
		[activeOrder],
	);

	const handleNotesChange = useCallback(
		(value: string) => {
			if (!activeOrder) return;
			setNotes((prev) => ({ ...prev, [activeOrder.id]: value }));
		},
		[activeOrder],
	);

	const buildInvoicePayload = (orderId: string) => ({
		dueDate: dueDates[orderId] ? new Date(dueDates[orderId]).toISOString() : undefined,
		notes: notes[orderId]?.trim() || undefined,
	});

	const openWorkspace = (order: OrderListItem) => {
		router.replace(`/fakturis/pembuatan-invoice?orderId=${order.id}`);
	};

	const closeWorkspace = () => {
		router.replace("/fakturis/pembuatan-invoice");
	};

	const handleCreateDraft = async (order: OrderListItem) => {
		setActionId(order.id);
		setError("");
		setSuccess("");
		try {
			await invoiceDraftsService.createFromOrder(order.id, buildInvoicePayload(order.id));
			setSuccess(`Draft invoice untuk ${order.orderNumber} berhasil dibuat.`);
			await load();
			openWorkspace(order);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal membuat invoice draft."));
		} finally {
			setActionId(null);
		}
	};

	const handleFinalizeDraft = async (draft: InvoiceDraftListItem, order: OrderListItem) => {
		setActionId(draft.id);
		setError("");
		setSuccess("");
		try {
			const result = await invoiceDraftsService.finalize(draft.id, buildInvoicePayload(order.id));
			setSuccess(
				`Invoice ${result.invoice.invoiceNumber} berhasil difinalisasi. Dokumen sekarang tercatat di riwayat transaksi dan siap diteruskan ke gudang.`,
			);
			await load();
			openWorkspace(order);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal finalize invoice draft."));
		} finally {
			setActionId(null);
		}
	};

	const openCancelModal = (target: CancelTarget) => {
		setCancelTarget(target);
		setCancelReason("");
	};

	const handleCancelTarget = async () => {
		if (!cancelTarget || !cancelReason.trim()) return;

		setActionId(cancelTarget.item.id);
		setError("");
		setSuccess("");
		try {
			if (cancelTarget.kind === "draft") {
				await invoiceDraftsService.cancel(cancelTarget.item.id, cancelReason.trim());
				setSuccess(`Draft ${cancelTarget.item.draftNumber} berhasil dibatalkan.`);
			} else {
				await invoicesService.cancel(cancelTarget.item.id, cancelReason.trim());
				setSuccess(`Invoice ${cancelTarget.item.invoiceNumber} berhasil dibatalkan.`);
			}
			setCancelTarget(null);
			setCancelReason("");
			await load();
		} catch (error: unknown) {
			setError(
				getErrorMessage(
					error,
					(cancelTarget.kind === "draft"
						? "Gagal membatalkan invoice draft."
						: "Gagal membatalkan invoice."),
				),
			);
		} finally {
			setActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Pembuatan Invoice"
			description="Workspace fakturis untuk memproses order `PROCESSED` menjadi invoice. Fokusnya dibuat mirip FE1: buka order, sesuaikan kuantitas invoice, lalu terima atau tolak dengan alur yang tetap sah menurut BE2."
		>
			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Order Diproses", value: summary.totalOrders },
					{ label: "Siap Buat Draft", value: summary.ready },
					{ label: "Draft Aktif", value: summary.draft },
					{ label: "Invoice Final", value: summary.finalized },
				].map((item) => (
					<div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			{activeOrder ? (
				<div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
					<aside className="space-y-4">
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
								Antrian Fakturis
							</h2>
							<p className="mt-2 text-sm text-slate-600">
								Pilih order lain tanpa keluar dari workspace invoice.
							</p>
							<div className="mt-4 space-y-2">
								{rows.slice(0, 8).map((order) => {
									const isActive = order.id === activeOrder.id;
									const draft = draftMap[order.id];
									const invoice = invoiceMap[order.id];
									return (
										<button
											key={order.id}
											type="button"
											onClick={() => openWorkspace(order)}
											className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
												isActive
													? "border-slate-900 bg-slate-900 text-white"
													: "border-slate-200 bg-slate-50 text-slate-900 hover:bg-white"
											}`}
										>
											<div className="font-semibold">{order.orderNumber}</div>
											<div className={`mt-1 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
												{order.storeNameSnapshot}
											</div>
											<div className={`mt-2 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
												{invoice
													? invoice.invoiceNumber
													: draft
														? `${draft.draftNumber} (${draft.status})`
														: "Belum ada draft"}
											</div>
										</button>
									);
								})}
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
								Alur Lanjutan
							</h2>
							<div className="mt-3 space-y-3 text-sm text-slate-600">
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
									<p className="font-medium text-slate-900">1. Fakturis Finalisasi Invoice</p>
									<p className="mt-1">Order menjadi dokumen penagihan yang sah.</p>
								</div>
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
									<p className="font-medium text-slate-900">2. Tercatat di Riwayat Transaksi</p>
									<p className="mt-1">Audit transaksi fakturis tetap rapi dan mudah ditelusuri.</p>
								</div>
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
									<p className="font-medium text-slate-900">3. Gudang Lanjut ke Pengiriman</p>
									<p className="mt-1">Tim gudang membuat delivery order dari invoice final.</p>
								</div>
							</div>
						</section>
					</aside>

					<InvoiceDraftWorkspace
						key={`${activeOrder.id}:${selectedDraft?.id ?? "none"}:${selectedInvoice?.id ?? "none"}`}
						order={activeOrder}
						draft={selectedDraft}
						invoice={selectedInvoice}
						dueDate={dueDates[activeOrder.id] ?? ""}
						notes={notes[activeOrder.id] ?? ""}
						submitting={Boolean(actionId)}
						onDueDateChange={handleDueDateChange}
						onNotesChange={handleNotesChange}
						onBack={closeWorkspace}
						onCreateDraft={handleCreateDraft}
						onFinalizeDraft={handleFinalizeDraft}
						onCancelDraft={(draft) => openCancelModal({ kind: "draft", item: draft })}
						onCancelInvoice={(invoice) => openCancelModal({ kind: "invoice", item: invoice })}
					/>
				</div>
			) : null}

			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 lg:flex-row">
					<input
						className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari nomor order atau nama toko"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<select
						value={workflowFilter}
						onChange={(event) => setWorkflowFilter(event.target.value as WorkflowFilter)}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:w-56"
					>
						<option value="all">Semua Workflow</option>
						<option value="ready">Belum Ada Draft</option>
						<option value="draft">Draft Aktif</option>
						<option value="final">Sudah Final</option>
						<option value="cancelled">Cancelled</option>
					</select>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</section>

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

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<div>
						<h2 className="font-semibold text-slate-900">Daftar Order Siap Invoice</h2>
						<p className="text-sm text-slate-500">
							Pilih order untuk membuka halaman invoice penuh seperti alur FE1.
						</p>
					</div>
					<span className="text-sm text-slate-500">{rows.length} order</span>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">Order</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Status Invoice</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Memuat order siap invoice...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Tidak ada order yang siap dibuat invoice.
								</td>
							</tr>
						) : (
							rows.map((order) => {
								const invoice = invoiceMap[order.id];
								const draft = draftMap[order.id];
								const disabled =
									actionId === order.id || actionId === invoice?.id || actionId === draft?.id;

								return (
									<tr key={order.id} className={order.id === activeOrder?.id ? "bg-slate-50" : undefined}>
										<td className="px-4 py-3 align-top">
											<div className="font-medium text-slate-900">{order.orderNumber}</div>
											<div className="text-slate-500">{dateOnly(order.documentDate)}</div>
										</td>
										<td className="px-4 py-3 align-top text-slate-700">
											{order.storeNameSnapshot}
										</td>
										<td className="px-4 py-3 align-top">
											{invoice ? (
												<div>
													<div className="font-medium text-slate-900">{invoice.invoiceNumber}</div>
													<div className="mt-1">
														<span
															className={`rounded-full px-2 py-1 text-xs font-medium ${
																statusBadgeClassName[invoice.status] ?? "bg-slate-100 text-slate-700"
															}`}
														>
															{invoice.status}
														</span>
													</div>
													<div className="text-xs text-slate-500">Due {dateOnly(invoice.dueDate)}</div>
												</div>
											) : draft ? (
												<div>
													<div className="font-medium text-slate-900">{draft.draftNumber}</div>
													<div className="mt-1">
														<span
															className={`rounded-full px-2 py-1 text-xs font-medium ${
																statusBadgeClassName[draft.status] ?? "bg-slate-100 text-slate-700"
															}`}
														>
															{draft.status}
														</span>
													</div>
													<div className="text-xs text-slate-500">Due {dateOnly(draft.dueDate)}</div>
												</div>
											) : (
												<span className="text-slate-500">Belum ada draft</span>
											)}
										</td>
										<td className="px-4 py-3 text-right align-top text-slate-900">
											{formatRupiah(order.totalAmount)}
										</td>
										<td className="px-4 py-3 align-top">
											<div className="flex justify-end gap-2">
												<button
													type="button"
													onClick={() => setDetailOrder(order)}
													className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50"
												>
													Detail
												</button>
												<button
													type="button"
													onClick={() => openWorkspace(order)}
													disabled={disabled}
													className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
												>
													{invoice ? "Lihat Invoice" : draft ? "Lanjutkan Draft" : "Buka Workspace"}
												</button>
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</section>

			<OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />

			<CancelReasonModal
				isOpen={Boolean(cancelTarget)}
				title={cancelTarget?.kind === "draft" ? "Batalkan Draft" : "Batalkan Invoice"}
				description={
					cancelTarget?.kind === "draft"
						? `Draft ${cancelTarget.item.draftNumber} akan dibatalkan.`
						: cancelTarget
							? `Invoice ${cancelTarget.item.invoiceNumber} akan dibatalkan.`
							: ""
				}
				reason={cancelReason}
				submitting={Boolean(actionId)}
				onReasonChange={setCancelReason}
				onClose={() => {
					setCancelTarget(null);
					setCancelReason("");
				}}
				onConfirm={handleCancelTarget}
			/>
		</FeaturePage>
	);
}

export default function PembuatanInvoicePage() {
	return (
		<Suspense fallback={<FeaturePage title="Pembuatan Invoice" description="Memuat workspace fakturis..." />}>
			<PembuatanInvoicePageContent />
		</Suspense>
	);
}
