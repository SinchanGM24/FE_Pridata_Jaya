"use client";

import type { OverallSummary } from '@/services/dashboard';

interface Props {
	summary: OverallSummary | null;
}

export default function DashboardMetricsCards({ summary }: Props) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<p className="text-xs text-slate-500">Total Orders</p>
				<p className="mt-2 text-2xl font-semibold text-slate-900">{summary ? summary.totalOrders.toLocaleString() : '—'}</p>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<p className="text-xs text-slate-500">Total Invoices</p>
				<p className="mt-2 text-2xl font-semibold text-slate-900">{summary ? summary.totalInvoices.toLocaleString() : '—'}</p>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<p className="text-xs text-slate-500">Total Sales</p>
				<p className="mt-2 text-2xl font-semibold text-slate-900">{summary ? `Rp ${summary.totalSalesAmount.toLocaleString()}` : '—'}</p>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<p className="text-xs text-slate-500">Outstanding Receivables</p>
				<p className="mt-2 text-2xl font-semibold text-slate-900">{summary ? `Rp ${summary.totalOutstandingReceivableAmount.toLocaleString()}` : '—'}</p>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<p className="text-xs text-slate-500">Delivery Orders</p>
				<p className="mt-2 text-2xl font-semibold text-slate-900">{summary ? summary.totalDeliveryOrders.toLocaleString() : '—'}</p>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<p className="text-xs text-slate-500">Out of Stock SKUs</p>
				<p className="mt-2 text-2xl font-semibold text-rose-600">{summary ? summary.totalOutOfStockSkus.toLocaleString() : '—'}</p>
			</div>
		</div>
	);
}
