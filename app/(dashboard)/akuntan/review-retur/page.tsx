"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card, { CardHeader } from "@/components/shared/Card";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { fieldClasses } from "@/components/shared/FormInput";
import InlineAlert from "@/components/shared/InlineAlert";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { usePagedList } from "@/hooks/usePagedList";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatRupiah } from "@/lib/format";
import { storeReturnsService, type StoreReturnRequestItem } from "@/services/store-returns";

const PAGE_SIZE = 20;

// Perkiraan saja: server menghitung nilai final pro rata dari subtotal invoice.
const getEstimatedAmount = (item: StoreReturnRequestItem) =>
	item.items.reduce(
		(sum, line) => sum + (line.receivedQuantity ?? 0) * line.unitPriceSnapshot,
		0,
	);

export default function AccountantReturnReviewPage() {
	// Antrean disaring di server agar semua retur yang menunggu keputusan dapat dipaginasi.
	const list = usePagedList(
		(page, limit) =>
			storeReturnsService.list({
				page,
				limit,
				lifecycleStatus: "ACCOUNTING_REVIEW",
				sortBy: "submittedAt",
				sortOrder: "asc",
			}),
		{ filterKey: "accounting-review", errorMessage: "Gagal memuat antrean review retur.", pageSize: PAGE_SIZE },
	);
	const [selected, setSelected] = useState<StoreReturnRequestItem | null>(null);
	const [note, setNote] = useState("");
	const [actionError, setActionError] = useState("");
	const [success, setSuccess] = useState("");
	const [saving, setSaving] = useState(false);

	const totalEstimatedAmount = useMemo(
		() => list.items.reduce((sum, item) => sum + getEstimatedAmount(item), 0),
		[list.items],
	);

	const openReview = (item: StoreReturnRequestItem | null) => {
		setSelected(item);
		setNote("");
		setActionError("");
	};

	const decide = async (action: () => Promise<unknown>, done: string, failed: string) => {
		setSaving(true);
		setActionError("");
		try {
			await action();
			openReview(null);
			setSuccess(done);
			list.reload();
		} catch (cause: unknown) {
			setActionError(getApiErrorMessage(cause, failed));
		} finally {
			setSaving(false);
		}
	};

	const approve = () => {
		if (!selected) return;
		void decide(
			() => storeReturnsService.approveCredit(selected.id, note.trim() || undefined),
			`Kredit retur ${selected.requestNumber} berhasil disetujui.`,
			"Persetujuan kredit gagal diproses.",
		);
	};

	const redirectToReplacement = () => {
		if (!selected) return;
		if (!note.trim()) {
			setActionError("Alasan penolakan kredit wajib diisi.");
			return;
		}
		void decide(
			() => storeReturnsService.rejectCreditToReplacement(selected.id, note.trim()),
			`Retur ${selected.requestNumber} dialihkan ke penggantian barang.`,
			"Pengalihan ke barang pengganti gagal diproses.",
		);
	};

	const columns: ResponsiveColumn<StoreReturnRequestItem>[] = [
		{ key: "requestNumber", head: "Retur", role: "title", render: (item) => item.requestNumber },
		{ key: "status", head: "Status", role: "status", render: () => <Badge tone="warning">Menunggu keputusan</Badge> },
		{ key: "store", head: "Toko", render: (item) => item.store?.name ?? "-" },
		{ key: "invoice", head: "Invoice asal", render: (item) => item.invoice?.invoiceNumber ?? "-" },
		{
			key: "estimatedAmount",
			head: "Estimasi nilai retur",
			role: "amount",
			align: "right",
			render: (item) => formatRupiah(getEstimatedAmount(item)),
		},
		{
			key: "action",
			head: "",
			role: "action",
			align: "right",
			render: (item) => <Button variant="secondary" size="sm" onClick={() => openReview(item)}>Tinjau retur</Button>,
		},
	];

	return (
		<FeaturePage title="Review Retur" description="Tentukan kompensasi saldo atas barang retur yang telah diterima gudang.">
			<PageFeedback
				error={list.error}
				success={success}
				onRetry={list.reload}
				onDismissSuccess={() => setSuccess("")}
			/>

			<Card>
				<CardHeader
					title="Antrean keputusan kredit"
					description="Nilai retur akan mengurangi sisa invoice asal terlebih dahulu. Kelebihannya menjadi saldo toko."
					action={<div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-right"><p className="type-label text-brand-800">Total estimasi halaman ini</p><p className="mt-1 font-semibold text-slate-900">{formatRupiah(totalEstimatedAmount)}</p></div>}
				/>
				<div className="mt-5">
					<ResponsiveTable
						columns={columns}
						data={list.items}
						getRowKey={(item) => item.id}
						loading={list.loading}
						onRowClick={openReview}
						emptyText="Tidak ada retur menunggu keputusan"
						emptyDescription="Retur kredit yang telah diterima gudang akan muncul di sini."
					/>
				</div>
				<PaginationControls
					currentPage={list.page}
					totalPages={list.totalPages}
					totalItems={list.totalItems}
					currentItemCount={list.items.length}
					pageSize={PAGE_SIZE}
					itemLabel="retur"
					loading={list.loading}
					onPageChange={list.setPage}
				/>
			</Card>

			<Modal
				isOpen={Boolean(selected)}
				onClose={() => { if (!saving) openReview(null); }}
				title="Keputusan Kredit Retur"
				footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="danger" disabled={saving} onClick={redirectToReplacement}>Tolak Kredit & Kirim ke Penggantian</Button><Button disabled={saving} onClick={approve}>{saving ? "Memproses..." : "Setujui Kredit"}</Button></div>}
			>
				{selected ? (
					<div className="space-y-5 text-sm text-slate-700">
						<InlineAlert tone="brand">Harga kredit mengikuti invoice dan kuantitas yang diterima gudang. Akuntan tidak dapat mengubah nilai barang.</InlineAlert>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-4"><p className="type-label text-slate-500">Retur / Toko</p><p className="mt-2 font-semibold text-slate-900">{selected.requestNumber}</p><p className="mt-1 text-slate-600">{selected.store?.name ?? "-"}</p></div>
							<div className="rounded-xl border border-slate-200 p-4"><p className="type-label text-slate-500">Invoice asal</p><p className="mt-2 font-semibold text-slate-900">{selected.invoice?.invoiceNumber ?? "-"}</p><p className="mt-1 text-slate-600">Sisa tagihan: {formatRupiah(selected.invoice?.remainingAmount ?? 0)}</p></div>
							<div className="rounded-xl border border-slate-200 p-4"><p className="type-label text-slate-500">Estimasi nilai retur</p><p className="mt-2 text-lg font-bold text-slate-900">{formatRupiah(getEstimatedAmount(selected))}</p></div>
							<div className="rounded-xl border border-brand-200 bg-brand-50 p-4"><p className="type-label text-brand-800">Proyeksi saldo toko</p><p className="mt-2 text-lg font-bold text-slate-900">{formatRupiah(Math.max(0, getEstimatedAmount(selected) - (selected.invoice?.remainingAmount ?? 0)))}</p></div>
						</div>
						<div>
							<label htmlFor="return-review-note" className="block text-sm font-medium text-slate-700">Catatan keputusan</label>
							<p className="mt-1 text-xs text-slate-500">Wajib diisi bila kredit ditolak dan retur dialihkan menjadi barang pengganti.</p>
							<textarea id="return-review-note" className={fieldClasses("area", "mt-2")} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tambahkan catatan persetujuan atau alasan pengalihan" disabled={saving} />
						</div>
						{actionError ? <InlineAlert>{actionError}</InlineAlert> : null}
					</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
