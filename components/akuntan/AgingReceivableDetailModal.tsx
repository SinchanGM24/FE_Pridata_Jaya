import Modal from "@/components/shared/Modal";
import type { ReceivableRow } from "@/services/receivable";
import { formatRupiah } from "@/lib/format";


const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

export interface AgingReceivableGroup {
	storeId: string;
	storeName: string;
	totalOutstandingAmount: number;
	totalInvoiceCount: number;
	attentionCount: number;
	maxAgeDays: number;
	riskLabel: string;
	riskTone: string;
	items: ReceivableRow[];
}

interface AgingReceivableDetailModalProps {
	group: AgingReceivableGroup | null;
	referenceTime: number;
	onClose: () => void;
	onPrint: (group: AgingReceivableGroup) => void;
}

export default function AgingReceivableDetailModal({
	group,
	referenceTime,
	onClose,
	onPrint,
}: AgingReceivableDetailModalProps) {
	const ageDays = (item: ReceivableRow) => {
		if (!item.invoiceDate) return 0;
		const invoiceDate = new Date(item.invoiceDate);
		if (Number.isNaN(invoiceDate.getTime())) return 0;
		return Math.max(0, Math.floor((referenceTime - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)));
	};

	return (
		<Modal
			isOpen={Boolean(group)}
			onClose={onClose}
			title="Detail Aging Piutang"
			maxWidthClassName="max-w-6xl"
		>
			{group ? (
				<div className="space-y-5 text-sm text-slate-700">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Toko</p>
							<p className="mt-2 text-base font-semibold text-slate-900">{group.storeName}</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Jumlah Invoice</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">{group.totalInvoiceCount}</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Perlu Ditagih</p>
							<p className="mt-2 text-2xl font-semibold text-rose-700">{group.attentionCount}</p>
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
									<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${group.riskTone}`}>
										{group.riskLabel}
									</span>
									<span className="text-xs text-slate-500">
										Umur piutang tertua {group.maxAgeDays} hari
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={() => onPrint(group)}
								className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
							>
								Cetak Aging Piutang
							</button>
						</div>
					</div>

					<div className="rounded-xl border border-slate-200 bg-white">
						<div className="border-b border-slate-100 px-4 py-3">
							<p className="font-semibold text-slate-900">Daftar Invoice Piutang</p>
						</div>
						<div className="overflow-x-auto">
						<table className="min-w-[980px] divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-4 py-3">Invoice</th>
									<th className="px-4 py-3">Tanggal</th>
									<th className="px-4 py-3 text-center">Umur Piutang</th>
									<th className="px-4 py-3 text-right">Total</th>
									<th className="px-4 py-3 text-right">Dibayarkan</th>
									<th className="px-4 py-3 text-right">Sisa Tagihan</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{group.items.map((item) => {
									const itemAgeDays = ageDays(item);
									return (
										<tr key={item.id}>
											<td className="px-4 py-3 font-medium text-slate-900">{item.invoiceNumber}</td>
											<td className="px-4 py-3 text-slate-700">{dateOnly(item.invoiceDate)}</td>
											<td className="px-4 py-3 text-center text-slate-700">
												{itemAgeDays} hari
											</td>
											<td className="px-4 py-3 text-right text-slate-900">
												{formatRupiah(item.amount ?? item.totalAmount ?? 0)}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-emerald-700">
												{formatRupiah(Math.max(0, (item.amount ?? item.totalAmount ?? 0) - item.remainingAmount))}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-rose-700">
												{formatRupiah(item.remainingAmount)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						</div>
					</div>
				</div>
			) : null}
		</Modal>
	);
}
