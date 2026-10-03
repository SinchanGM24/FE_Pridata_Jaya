"use client";

import { useState } from "react";
import Modal from "@/components/shared/Modal";
import { useServerValue } from "@/hooks/useServerValue";
import { printAgingReceivableGroup } from "@/lib/aging-receivable-print";
import { formatRupiah } from "@/lib/format";
import { daysOverdueLabel, invoiceStatusLabel, toUiLabel } from "@/lib/ui-labels";
import {
	receivableService,
	type ReceivableFilters,
	type ReceivableStoreGroup,
} from "@/services/receivable";

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

/** Risiko toko dari invoice yang paling lama lewat jatuh tempo (`maxDaysOverdue`). */
export const riskTone = (daysOverdue: number) => {
	if (daysOverdue > 90) return "border border-rose-200 bg-rose-50 text-rose-700";
	if (daysOverdue > 30) return "border border-amber-200 bg-amber-50 text-amber-700";
	return "border border-emerald-200 bg-emerald-50 text-emerald-700";
};

export const riskLabel = (daysOverdue: number) => {
	if (daysOverdue > 90) return "Perlu Prioritas";
	if (daysOverdue > 30) return "Perlu Ditagih";
	return "Masih Baru";
};

type StoreFilters = Omit<ReceivableFilters, "storeId">;

interface AgingReceivableDetailModalProps {
	group: ReceivableStoreGroup | null;
	/** Filter halaman: detail dan cetakan memuat invoice yang sama dengan baris toko. */
	filters: StoreFilters;
	/** Kunci dari semua nilai `filters`, sama dengan `filterKey` daftar toko. */
	filterKey: string;
	onClose: () => void;
}

export default function AgingReceivableDetailModal({
	group,
	filters,
	filterKey,
	onClose,
}: AgingReceivableDetailModalProps) {
	return (
		<Modal
			isOpen={Boolean(group)}
			onClose={onClose}
			title="Detail Aging Piutang"
			maxWidthClassName="max-w-6xl"
		>
			{group ? <DetailBody key={group.storeId} group={group} filters={filters} filterKey={filterKey} /> : null}
		</Modal>
	);
}

function DetailBody({
	group,
	filters,
	filterKey,
}: {
	group: ReceivableStoreGroup;
	filters: StoreFilters;
	filterKey: string;
}) {
	const [printBlocked, setPrintBlocked] = useState(false);
	// ponytail: memuat semua invoice SATU toko (limit 100/halaman) untuk detail + cetak; pindah ke total per toko + endpoint cetak di BE kalau satu toko punya ribuan invoice.
	const itemsState = useServerValue(() => receivableService.listAllForStore(group.storeId, filters), {
		key: `${group.storeId}|${filterKey}`,
		errorMessage: "Gagal memuat invoice piutang toko.",
	});
	const items = itemsState.data;

	const handlePrint = () => {
		if (!items) return;
		const opened = printAgingReceivableGroup({
			storeId: group.storeId,
			storeName: group.storeName,
			totalOutstandingAmount: group.totalOutstandingAmount,
			totalInvoiceCount: group.totalInvoiceCount,
			attentionCount: group.overdueOver30Count,
			maxDaysOverdue: group.maxDaysOverdue,
			riskLabel: riskLabel(group.maxDaysOverdue),
			items: items.map((item) => ({
				invoiceNumber: item.invoiceNumber,
				invoiceDate: item.invoiceDate,
				dueDate: item.dueDate,
				status: toUiLabel(item.status, invoiceStatusLabel),
				totalAmount: item.amount ?? item.totalAmount ?? 0,
				remainingAmount: item.remainingAmount,
				daysOverdue: item.daysOverdue,
			})),
		});
		setPrintBlocked(!opened);
	};

	return (
		<div className="space-y-5 text-sm text-slate-700">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Toko</p>
					<p className="mt-2 text-base font-semibold text-slate-900">{group.storeName || "Toko"}</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Jumlah Invoice</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">{group.totalInvoiceCount}</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Perlu Ditagih (&gt;30 Hari)</p>
					<p className="mt-2 text-2xl font-semibold text-rose-700">{group.overdueOver30Count}</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sisa Tagihan</p>
					<p className="mt-2 font-semibold text-slate-900">
						{formatRupiah(group.totalOutstandingAmount)}
					</p>
				</div>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-4">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kategori Risiko</p>
						<div className="mt-2 flex items-center gap-3">
							<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${riskTone(group.maxDaysOverdue)}`}>
								{riskLabel(group.maxDaysOverdue)}
							</span>
							<span className="text-xs text-slate-500">
								Paling lama lewat jatuh tempo: {daysOverdueLabel(group.maxDaysOverdue)}
							</span>
						</div>
					</div>
					<button
						type="button"
						onClick={handlePrint}
						disabled={!items}
						className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cetak Aging Piutang
					</button>
				</div>
				{printBlocked ? (
					<p role="alert" className="mt-3 text-xs text-rose-700">
						Tab cetak diblokir browser. Izinkan pop-up untuk halaman ini, lalu coba lagi.
					</p>
				) : null}
			</div>

			<div className="rounded-xl border border-slate-200 bg-white">
				<div className="border-b border-slate-100 px-4 py-3">
					<p className="font-semibold text-slate-900">Daftar Invoice Piutang</p>
					<p className="mt-0.5 text-xs text-slate-500">Umur piutang dihitung dari tanggal jatuh tempo.</p>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-[980px] divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Invoice</th>
								<th className="px-4 py-3">Tanggal Invoice</th>
								<th className="px-4 py-3">Jatuh Tempo</th>
								<th className="px-4 py-3 text-center">Lewat Jatuh Tempo</th>
								<th className="px-4 py-3 text-right">Total</th>
								<th className="px-4 py-3 text-right">Dibayarkan</th>
								<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{!items ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={7}>
										{itemsState.loading ? (
											"Memuat invoice piutang..."
										) : (
											<>
												Invoice piutang belum bisa dimuat.{" "}
												<button type="button" onClick={itemsState.reload} className="font-semibold underline">
													Coba lagi
												</button>
											</>
										)}
									</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={7}>
										Tidak ada invoice piutang pada filter ini.
									</td>
								</tr>
							) : (
								items.map((item) => {
									const total = item.amount ?? item.totalAmount ?? 0;
									return (
										<tr key={item.id}>
											<td className="px-4 py-3 font-medium text-slate-900">{item.invoiceNumber}</td>
											<td className="px-4 py-3 text-slate-700">{dateOnly(item.invoiceDate)}</td>
											<td className="px-4 py-3 text-slate-700">{dateOnly(item.dueDate)}</td>
											<td className="px-4 py-3 text-center text-slate-700">
												{daysOverdueLabel(item.daysOverdue)}
											</td>
											<td className="px-4 py-3 text-right text-slate-900">{formatRupiah(total)}</td>
											<td className="px-4 py-3 text-right font-semibold text-emerald-700">
												{formatRupiah(Math.max(0, total - item.remainingAmount))}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-rose-700">
												{formatRupiah(item.remainingAmount)}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
