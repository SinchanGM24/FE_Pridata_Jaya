"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { invoicesService } from "@/services/invoices";
import { invoiceDraftsService } from "@/services/invoice-drafts";
import { ordersService } from "@/services/orders";

export default function FakturisDashboard() {
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState({
		pendingOrders: 0,
		processedOrders: 0,
		draftInvoices: 0,
		unpaidInvoices: 0,
		finalizedDrafts: 0,
	});

	useEffect(() => {
		let mounted = true;
		Promise.all([
			ordersService.list({ page: 1, limit: 100, status: "PENDING" }),
			ordersService.list({ page: 1, limit: 100, status: "PROCESSED" }),
			invoiceDraftsService.list({ page: 1, limit: 100, status: "DRAFT" }),
			invoicesService.list({ page: 1, limit: 100, status: "UNPAID" }),
			invoiceDraftsService.list({ page: 1, limit: 100, status: "FINALIZED" }),
		])
			.then(([pendingOrders, processedOrders, draftInvoices, unpaidInvoices, finalizedDrafts]) => {
				if (!mounted) return;
				setSummary({
					pendingOrders: pendingOrders.items.length,
					processedOrders: processedOrders.items.length,
					draftInvoices: draftInvoices.items.length,
					unpaidInvoices: unpaidInvoices.items.length,
					finalizedDrafts: finalizedDrafts.items.length,
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
			title="Dashboard Fakturis"
			description="Ringkasan kerja fakturis yang ditarik langsung dari order dan invoice BE2. Fokus utamanya adalah memverifikasi order, membuat invoice dari order yang sudah diproses, dan memantau invoice yang masih terbuka."
			actions={[
				{ label: "Pesanan Masuk", href: "/fakturis/pesanan-masuk" },
				{ label: "Pembuatan Invoice", href: "/fakturis/pembuatan-invoice" },
			]}
		>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Order Pending", value: summary.pendingOrders },
					{ label: "Order Diproses", value: summary.processedOrders },
					{ label: "Draft Aktif", value: summary.draftInvoices },
					{ label: "Invoice Unpaid", value: summary.unpaidInvoices },
					{ label: "Draft Finalized", value: summary.finalizedDrafts },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-3xl font-semibold text-slate-900">
							{loading ? "..." : item.value}
						</p>
					</div>
				))}
			</section>
		</FeaturePage>
	);
}
