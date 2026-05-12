"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { invoicesService } from "@/services/invoices";
import { invoiceDraftsService } from "@/services/invoice-drafts";
import { receivableService } from "@/services/receivable";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function AccountantDashboard() {
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState({
		draftInvoices: 0,
		finalizedDrafts: 0,
		unpaidInvoices: 0,
		partialInvoices: 0,
		paidInvoices: 0,
		outstandingAmount: 0,
		overdueCount: 0,
	});

	useEffect(() => {
		let mounted = true;

		Promise.all([
			invoiceDraftsService.list({ page: 1, limit: 1, status: "DRAFT" }),
			invoiceDraftsService.list({ page: 1, limit: 1, status: "FINALIZED" }),
			invoicesService.list({ page: 1, limit: 1, status: "UNPAID" }),
			invoicesService.list({ page: 1, limit: 1, status: "PARTIAL" }),
			invoicesService.list({ page: 1, limit: 1, status: "PAID" }),
			receivableService.getAging(),
		])
			.then(([drafts, finalizedDrafts, unpaid, partial, paid, aging]) => {
				if (!mounted) return;
				setSummary({
					draftInvoices: drafts.meta?.totalItems ?? drafts.items.length,
					finalizedDrafts: finalizedDrafts.meta?.totalItems ?? finalizedDrafts.items.length,
					unpaidInvoices: unpaid.meta?.totalItems ?? unpaid.items.length,
					partialInvoices: partial.meta?.totalItems ?? partial.items.length,
					paidInvoices: paid.meta?.totalItems ?? paid.items.length,
					outstandingAmount: aging.totalOutstandingAmount,
					overdueCount: aging.overdueCount,
				});
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});

		return () => {
			mounted = false;
		};
	}, []);

	return (
		<FeaturePage
			title="Dashboard Akuntan"
			description="Ringkasan finansial yang mengikuti alur fakturis terbaru: draft invoice, draft yang sudah difinalisasi, invoice unpaid/partial/paid, dan posisi piutang outstanding."
			actions={[
				{ label: "Invoice Pembayaran", href: "/akuntan/invoice-pembayaran" },
				{ label: "Aging Piutang", href: "/akuntan/aging-piutang" },
			]}
		>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Draft Aktif", value: loading ? "..." : String(summary.draftInvoices) },
					{ label: "Draft Finalized", value: loading ? "..." : String(summary.finalizedDrafts) },
					{ label: "Invoice Unpaid", value: loading ? "..." : String(summary.unpaidInvoices) },
					{ label: "Invoice Partial", value: loading ? "..." : String(summary.partialInvoices) },
					{ label: "Invoice Paid", value: loading ? "..." : String(summary.paidInvoices) },
					{ label: "Outstanding", value: loading ? "..." : formatRupiah(summary.outstandingAmount) },
					{ label: "Invoice Overdue", value: loading ? "..." : String(summary.overdueCount) },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>
		</FeaturePage>
	);
}
