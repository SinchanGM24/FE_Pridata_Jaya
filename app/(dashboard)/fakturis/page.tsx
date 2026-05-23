"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { invoicesService } from "@/services/invoices";
import { invoiceDraftsService } from "@/services/invoice-drafts";
import { ordersService } from "@/services/orders";

export default function FakturisDashboard() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [summary, setSummary] = useState({
		pendingOrders: 0,
		processedOrders: 0,
		draftInvoices: 0,
		unpaidInvoices: 0,
		finalizedDrafts: 0,
	});

	useEffect(() => {
		let mounted = true;
		const timer = window.setTimeout(() => {
			void (async () => {
				setLoading(true);
				setError("");
				try {
					const [pendingOrders, processedOrders, draftInvoices, unpaidInvoices, finalizedDrafts] = await Promise.all([
						ordersService.listAll({ status: "PENDING" }),
						ordersService.listAll({ status: "PROCESSED" }),
						invoiceDraftsService.listAll({ status: "DRAFT" }),
						invoicesService.listAll({ status: "UNPAID" }),
						invoiceDraftsService.listAll({ status: "FINALIZED" }),
					]);

					if (!mounted) return;

					setSummary({
						pendingOrders: pendingOrders.length,
						processedOrders: processedOrders.length,
						draftInvoices: draftInvoices.length,
						unpaidInvoices: unpaidInvoices.length,
						finalizedDrafts: finalizedDrafts.length,
					});
				} catch {
					if (!mounted) return;
					setError("Gagal memuat ringkasan fakturis.");
				} finally {
					if (mounted) setLoading(false);
				}
			})();
		}, 0);

		return () => {
			mounted = false;
			window.clearTimeout(timer);
		};
	}, []);

	return (
		<FeaturePage
			title="Dashboard Fakturis"
			description="Ringkasan kerja fakturis untuk memverifikasi pesanan, menyiapkan invoice, dan memantau dokumen yang masih berjalan."
			actions={[
				{ label: "Pesanan Masuk", href: "/fakturis/pesanan-masuk" },
				{ label: "Pembuatan Invoice", href: "/fakturis/pembuatan-invoice" },
			]}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Pesanan Menunggu", value: summary.pendingOrders },
					{ label: "Pesanan Diproses", value: summary.processedOrders },
					{ label: "Rancangan Aktif", value: summary.draftInvoices },
					{ label: "Invoice Belum Lunas", value: summary.unpaidInvoices },
					{ label: "Rancangan Difinalisasi", value: summary.finalizedDrafts },
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
