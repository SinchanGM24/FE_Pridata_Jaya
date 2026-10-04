"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CancelReasonModal from "@/components/fakturis/CancelReasonModal";
import OrderDetailModal from "@/components/fakturis/OrderDetailModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import { invoiceDraftsService } from "@/services/invoice-drafts";
import { ordersService, type OrderListItem } from "@/services/orders";
import { formatRupiah } from "@/lib/format";

const PAGE_SIZE = 20;


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
type WorkTab = "pending" | "processed";
type OrderDraft = NonNullable<OrderListItem["invoiceDrafts"]>[number];
type PagedListState = { items: unknown[]; loading: boolean; error: string; totalItems: number };

type FakturisWorkItem = {
	order: OrderListItem;
	stage: WorkStage;
	draft: OrderDraft | null;
};

type CancelTarget =
	| { kind: "order"; order: OrderListItem }
	| { kind: "draft"; order: OrderListItem; draft: OrderDraft };

/** Server sudah memfilter: PENDING, atau PROCESSED tanpa invoice. Draft = draft terbaru order. */
const toWorkItem = (order: OrderListItem): FakturisWorkItem => {
	const draft = order.invoiceDrafts?.[0] ?? null;
	if (order.status === "PENDING") return { order, stage: "pending", draft };
	return { order, stage: draft?.status === "DRAFT" ? "draft" : "ready", draft };
};

/** Jumlah dari `meta.totalItems`; "—" selama belum ada data yang bisa dipercaya. */
const countOf = (list: PagedListState) =>
	list.items.length === 0 && (list.loading || list.error) ? "—" : list.totalItems;

const stageBadgeClassName: Record<WorkStage, string> = {
	pending: "border border-amber-200 bg-amber-50 text-amber-700",
	ready: "bg-blue-100 text-blue-800",
	draft: "border border-emerald-200 bg-emerald-50 text-emerald-700",
};

const stageLabel: Record<WorkStage, string> = {
	pending: "Perlu Verifikasi",
	ready: "Siap Invoice",
	draft: "Draft Tersimpan",
};

export default function PesananMasukPage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<WorkTab>("pending");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search.trim());
	const [actionId, setActionId] = useState<string | null>(null);
	const [selectedItem, setSelectedItem] = useState<FakturisWorkItem | null>(null);
	const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	// Pencarian server mencakup nomor order, nama toko, dan nomor draft invoice.
	const searchParam = debouncedSearch || undefined;
	const pendingList = usePagedList(
		(page, limit) =>
			ordersService.list({ page, limit, status: "PENDING", search: searchParam, sortBy: "documentDate", sortOrder: "desc" }),
		{ filterKey: debouncedSearch, errorMessage: "Gagal memuat pesanan yang perlu diverifikasi.", pageSize: PAGE_SIZE },
	);
	const processedList = usePagedList(
		(page, limit) =>
			ordersService.list({
				page,
				limit,
				status: "PROCESSED",
				hasInvoice: false,
				search: searchParam,
				sortBy: "documentDate",
				sortOrder: "desc",
			}),
		{ filterKey: debouncedSearch, errorMessage: "Gagal memuat pesanan siap invoice.", pageSize: PAGE_SIZE },
	);
	const activeList = activeTab === "pending" ? pendingList : processedList;
	const rows = activeList.items.map(toWorkItem);

	const loadError = pendingList.error || processedList.error;
	const retryLoad = () => {
		if (pendingList.error) pendingList.reload();
		if (processedList.error) processedList.reload();
	};

	const tabItems: Array<{ id: WorkTab; label: string; count: number | string }> = [
		{ id: "pending", label: "Perlu Verifikasi", count: countOf(pendingList) },
		{ id: "processed", label: "Siap Invoice", count: countOf(processedList) },
	];

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
			pendingList.reload();
			processedList.reload();
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
			<PageFeedback
				error={error || loadError}
				success={success}
				// Galat muat tidak bisa ditutup: tanpa pesan itu tabel tampak kosong.
				onDismissError={error ? () => setError("") : undefined}
				onDismissSuccess={() => setSuccess("")}
				onRetry={error ? undefined : retryLoad}
			/>

			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="mb-4 flex flex-wrap gap-2">
					{tabItems.map((tab) => {
						const active = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								aria-pressed={active}
								className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
									active
										? "border-indigo-600 bg-indigo-600 text-white"
										: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
								}`}
							>
								{tab.label} <span className={active ? "text-slate-200" : "text-slate-500"}>{tab.count}</span>
							</button>
						);
					})}
				</div>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-1 flex-col gap-3 lg:flex-row">
						<input
							className="w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Cari nomor order, toko, atau nomor draft"
							maxLength={100}
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<div className="flex flex-wrap gap-2">
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
					<h2 className="font-semibold text-slate-900">Daftar Pesanan ({countOf(activeList)})</h2>
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
						{rows.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									{activeList.loading
										? "Memuat..."
										: activeList.error
											? "Daftar pesanan belum bisa dimuat."
											: "Tidak ada order yang perlu ditangani fakturis."}
								</td>
							</tr>
						) : (
							rows.map((item) => (
								<tr key={item.order.id} className="hover:bg-slate-50/80">
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
											className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageBadgeClassName[item.stage]}`}
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
				<PaginationControls
					currentPage={activeList.page}
					totalPages={activeList.totalPages}
					totalItems={activeList.totalItems}
					currentItemCount={activeList.items.length}
					pageSize={PAGE_SIZE}
					itemLabel="pesanan"
					loading={activeList.loading}
					onPageChange={activeList.setPage}
				/>
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
				onPrimaryAction={() => {
					if (selectedItem) void openWorkspace(selectedItem);
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
							: `Pesanan ${cancelTarget.order.orderNumber} akan dibatalkan. Alasan pembatalan wajib diisi untuk catatan transaksi.`
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
