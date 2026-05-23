"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CancelReasonModal from "@/components/fakturis/CancelReasonModal";
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

type WorkStage = "pending" | "ready" | "draft";

type FakturisWorkItem = {
	order: OrderListItem;
	stage: WorkStage;
	draft?: InvoiceDraftListItem | null;
	invoice?: InvoiceListItem | null;
};

type CancelTarget =
	| { kind: "order"; order: OrderListItem }
	| { kind: "draft"; order: OrderListItem; draft: InvoiceDraftListItem };

const stageBadgeClassName: Record<WorkStage, string> = {
	pending: "bg-amber-100 text-amber-800",
	ready: "bg-blue-100 text-blue-800",
	draft: "bg-emerald-100 text-emerald-800",
};

const stageLabel: Record<WorkStage, string> = {
	pending: "Perlu Verifikasi",
	ready: "Siap Invoice",
	draft: "Draft Tersimpan",
};

export default function PesananMasukPage() {
	const router = useRouter();
	const [items, setItems] = useState<FakturisWorkItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);
	const [selectedItem, setSelectedItem] = useState<FakturisWorkItem | null>(null);
	const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [pendingOrders, processedOrders, draftRows, invoiceRows] = await Promise.all([
				ordersService.listAll({ status: "PENDING", search: search || undefined }),
				ordersService.listAll({ status: "PROCESSED", search: search || undefined }),
				invoiceDraftsService.listAll({ sortBy: "draftDate", sortOrder: "desc" }),
				invoicesService.listAll({ sortBy: "invoiceDate", sortOrder: "desc" }),
			]);

			const draftByOrderId = new Map(draftRows.map((draft) => [draft.orderId, draft] as const));
			const invoiceByOrderId = new Map(invoiceRows.map((invoice) => [invoice.orderId, invoice] as const));

			const nextItems: FakturisWorkItem[] = [
				...pendingOrders.map((order) => ({
					order,
					stage: "pending" as const,
					draft: draftByOrderId.get(order.id) ?? null,
					invoice: invoiceByOrderId.get(order.id) ?? null,
				})),
				...processedOrders
					.map((order) => ({
						order,
						draft: draftByOrderId.get(order.id) ?? null,
						invoice: invoiceByOrderId.get(order.id) ?? null,
					}))
					.filter((item) => !item.invoice)
					.map((item) => ({
						...item,
						stage: item.draft?.status === "DRAFT" ? ("draft" as const) : ("ready" as const),
					})),
			];

			setItems(
				nextItems.sort((left, right) => {
					const leftDate = new Date(left.order.documentDate).getTime();
					const rightDate = new Date(right.order.documentDate).getTime();
					return rightDate - leftDate;
				}),
			);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat meja kerja fakturis."));
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
		if (!query) return items;
		return items.filter(
			(item) =>
				item.order.orderNumber.toLowerCase().includes(query) ||
				item.order.storeNameSnapshot.toLowerCase().includes(query) ||
				(item.draft?.draftNumber ?? "").toLowerCase().includes(query),
		);
	}, [items, search]);

	const openWorkspace = async (item: FakturisWorkItem) => {
		setActionId(item.order.id);
		setError("");
		setSuccess("");
		try {
			if (item.stage === "pending") {
				await ordersService.verify(item.order.id);
			}
			setSelectedItem(null);
			router.push(`/fakturis/pembuatan-invoice?orderId=${item.order.id}`);
		} catch (error: unknown) {
			setError(
				getErrorMessage(
					error,
					item.stage === "pending"
						? "Gagal verifikasi pesanan."
						: "Gagal membuka workspace invoice.",
				),
			);
		} finally {
			setActionId(null);
		}
	};

	const openCancelModal = (target: CancelTarget) => {
		setSelectedItem(null);
		setCancelTarget(target);
		setCancelReason("");
	};

	const handleCancel = async () => {
		if (!cancelTarget || !cancelReason.trim()) return;

		setActionId(cancelTarget.kind === "draft" ? cancelTarget.draft.id : cancelTarget.order.id);
		setError("");
		setSuccess("");
		try {
			if (cancelTarget.kind === "draft") {
				await invoiceDraftsService.cancel(cancelTarget.draft.id, cancelReason.trim());
				setSuccess(`Draft ${cancelTarget.draft.draftNumber} berhasil ditolak.`);
			} else {
				await ordersService.cancel(cancelTarget.order.id, cancelReason.trim());
				setSuccess(`Pesanan ${cancelTarget.order.orderNumber} berhasil dibatalkan.`);
			}
			setCancelTarget(null);
			setCancelReason("");
			await load();
		} catch (error: unknown) {
			setError(
				getErrorMessage(
					error,
					cancelTarget.kind === "draft"
						? "Gagal menolak draft invoice."
						: "Gagal membatalkan pesanan.",
				),
			);
		} finally {
			setActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Pesanan Masuk"
			description="Daftar pesanan yang perlu ditinjau fakturis sebelum diteruskan ke gudang."
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

			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-1 flex-col gap-3 lg:flex-row">
						<input
							className="w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Cari nomor order, toko, atau nomor draft"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={load}
								disabled={loading}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
							>
								Muat Ulang
							</button>
							<button
								type="button"
								onClick={() => setSearch("")}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Reset Cari
							</button>
						</div>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<h2 className="font-semibold text-slate-900">Daftar Pesanan ({rows.length})</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">No. Order</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Tahap</th>
							<th className="px-4 py-3 text-right">Nilai Order</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Memuat...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Tidak ada order yang perlu ditangani fakturis.
								</td>
							</tr>
						) : (
							rows.map((item) => (
								<tr key={`${item.order.id}:${item.stage}`} className="hover:bg-slate-50/80">
									<td className="px-4 py-3 font-medium text-slate-900">
										<div>{item.order.orderNumber}</div>
										<div className="mt-1 text-xs text-slate-500">
											{item.order.items?.length ?? 0} baris item
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{item.order.storeNameSnapshot}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(item.order.documentDate)}</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${stageBadgeClassName[item.stage]}`}
										>
											{stageLabel[item.stage]}
										</span>
										{item.stage === "draft" && item.draft ? (
											<div className="mt-1 text-xs text-slate-500">{item.draft.draftNumber}</div>
										) : null}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(item.order.totalAmount)}
									</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setSelectedItem(item)}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
											>
												Detail
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<OrderDetailModal
				order={selectedItem?.order ?? null}
				actionLabel={
					actionId === selectedItem?.order.id
						? "Membuka Halaman..."
						: selectedItem?.stage === "pending"
							? "Verifikasi & Buat Invoice"
							: selectedItem?.stage === "draft"
								? "Lanjutkan Draft"
								: "Buat Invoice"
				}
				secondaryActionLabel={
					selectedItem?.stage === "pending"
						? "Tolak"
						: selectedItem?.stage === "draft"
							? "Tolak Draft"
							: undefined
				}
				actionDisabled={Boolean(actionId)}
				onClose={() => setSelectedItem(null)}
				onPrimaryAction={(order) => {
					const target = rows.find((item) => item.order.id === order.id);
					if (!target) return;
					void openWorkspace(target);
				}}
				onSecondaryAction={(order) => {
					if (selectedItem?.stage === "draft" && selectedItem.draft) {
						openCancelModal({ kind: "draft", order, draft: selectedItem.draft });
						return;
					}
					openCancelModal({ kind: "order", order });
				}}
			/>

			<CancelReasonModal
				isOpen={Boolean(cancelTarget)}
				title={cancelTarget?.kind === "draft" ? "Tolak Draft Invoice" : "Batalkan Pesanan"}
				description={
					cancelTarget
						? cancelTarget.kind === "draft"
							? `Draft ${cancelTarget.draft.draftNumber} untuk pesanan ${cancelTarget.order.orderNumber} akan ditolak.`
							: `Pesanan ${cancelTarget.order.orderNumber} akan dibatalkan. Alasan ini dikirim ke backend sebagai cancelReason.`
						: ""
				}
				reason={cancelReason}
				submitting={Boolean(actionId)}
				onReasonChange={setCancelReason}
				onClose={() => {
					setCancelTarget(null);
					setCancelReason("");
				}}
				onConfirm={handleCancel}
			/>
		</FeaturePage>
	);
}
