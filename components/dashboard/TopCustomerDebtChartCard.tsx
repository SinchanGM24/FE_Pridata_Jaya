"use client";

import { useMemo, useState } from "react";
import { formatRupiah } from "@/components/dashboard/chart-utils";

export interface TopCustomerDebtPoint {
	id: string;
	label: string;
	salesUserName: string;
	outstandingAmount: number;
	overdueAmount: number;
	invoiceCount: number;
	overdueCount: number;
	oldestOverdueDays: number;
	invoices: Array<{
		invoiceId: string;
		invoiceNumber: string;
		invoiceDate: string;
		dueDate: string | null;
		totalAmount: number;
		paidAmount: number;
		remainingAmount: number;
		status: string;
		overdueDays: number;
	}>;
}

const formatDate = (value: string | null) =>
	value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "-";

const priorityMeta = (days: number) => {
	if (days > 90) return { label: "Kritis", tone: "border border-rose-200 bg-rose-50 text-rose-700" };
	if (days > 30) return { label: "Tinggi", tone: "bg-orange-100 text-orange-700" };
	return { label: "Tindak lanjut", tone: "border border-amber-200 bg-amber-50 text-amber-700" };
};

export default function TopCustomerDebtChartCard({
	title,
	helper,
	items,
	footer,
}: {
	title: string;
	helper: string;
	items: TopCustomerDebtPoint[];
	footer?: string;
}) {
	const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
	const rankedItems = useMemo(
		() => [...items].sort((left, right) => right.overdueAmount - left.overdueAmount || right.oldestOverdueDays - left.oldestOverdueDays),
		[items],
	);

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="text-base font-semibold text-slate-900">{title}</h2>
			<p className="mt-1 text-sm text-slate-500">{helper}</p>

			{rankedItems.length === 0 ? (
				<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">Tidak ada piutang terlambat untuk ditindaklanjuti.</div>
			) : (
				<div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
					<div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_0.7fr_0.7fr_auto] gap-3 bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-500 lg:grid">
						<span>Toko</span><span>Sales</span><span className="text-right">Terlambat</span><span className="text-right">Invoice</span><span className="text-right">Tertua</span><span>Prioritas</span>
					</div>
					<div className="divide-y divide-slate-200">
						{rankedItems.map((item) => {
							const priority = priorityMeta(item.oldestOverdueDays);
							const expanded = expandedStoreId === item.id;
							return <div key={item.id}>
								<button type="button" onClick={() => setExpandedStoreId(expanded ? null : item.id)} className="w-full px-4 py-4 text-left transition hover:bg-slate-50">
									<div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_0.7fr_0.7fr_auto] lg:items-center">
										<div><p className="font-semibold text-slate-900">{item.label}</p><p className="mt-1 text-xs text-slate-500">Total piutang {formatRupiah(item.outstandingAmount)}</p></div>
										<p className="text-sm text-slate-600">{item.salesUserName}</p>
										<p className="text-sm font-semibold text-rose-600 lg:text-right">{formatRupiah(item.overdueAmount)}</p>
										<p className="text-sm text-slate-700 lg:text-right">{item.overdueCount}</p>
										<p className="text-sm font-medium text-slate-700 lg:text-right">{item.oldestOverdueDays} hari</p>
										<span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${priority.tone}`}>{priority.label}</span>
									</div>
								</button>
								{expanded ? <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
									<p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Invoice terlambat</p>
									<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
										<table className="min-w-full divide-y divide-slate-200 text-sm">
											<thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Jatuh Tempo</th><th className="px-3 py-2 text-right">Terlambat</th><th className="px-3 py-2 text-right">Sisa</th><th className="px-3 py-2">Status</th></tr></thead>
											<tbody className="divide-y divide-slate-100">{item.invoices.map((invoice) => <tr key={invoice.invoiceId}><td className="px-3 py-2 font-medium text-slate-900">{invoice.invoiceNumber}</td><td className="px-3 py-2 text-slate-600">{formatDate(invoice.dueDate)}</td><td className="px-3 py-2 text-right font-medium text-rose-600">{invoice.overdueDays} hari</td><td className="px-3 py-2 text-right text-slate-900">{formatRupiah(invoice.remainingAmount)}</td><td className="px-3 py-2 text-slate-600">{invoice.status}</td></tr>)}</tbody>
										</table>
									</div>
								</div> : null}
							</div>;
						})}
					</div>
				</div>
			)}
			{footer ? <p className="mt-4 text-xs text-slate-500">{footer}</p> : null}
		</section>
	);
}
