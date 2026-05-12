"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { tokoService, type TokoDashboardData } from "@/services/toko";
import { readTokoCart } from "@/services/toko-cart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function TokoDashboardPage() {
	const [data, setData] = useState<TokoDashboardData | null>(null);
	const [cartCount, setCartCount] = useState(0);

	useEffect(() => {
		tokoService.getDashboard().then(setData).catch(() => {});
		setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
	}, []);

	return (
		<TokoStorefrontShell title="Dashboard Toko" cartCount={cartCount}>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Grade", value: data?.store?.grade ?? "-", tone: "border-cyan-200 bg-cyan-50 text-cyan-800" },
					{ label: "Total Order", value: data?.store?.totalOrders ?? 0, tone: "border-indigo-200 bg-indigo-50 text-indigo-800" },
					{
						label: "Tagihan Berjalan",
						value: formatRupiah(data?.receivableStatement.totalOutstandingAmount ?? 0),
						tone: "border-amber-200 bg-amber-50 text-amber-800",
					},
					{
						label: "Invoice",
						value: data?.recentInvoices.length ?? 0,
						tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
					},
				].map((item) => (
					<div key={item.label} className={`rounded-lg border p-4 ${item.tone}`}>
						<p className="text-xs">{item.label}</p>
						<p className="mt-2 text-xl font-bold">{item.value}</p>
					</div>
				))}
			</section>

			<section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold text-slate-900">Order Terbaru</h2>
						<Link href="/toko/riwayat-transaksi" className="text-sm font-semibold text-sky-700">
							Lihat semua
						</Link>
					</div>
					<div className="mt-4 space-y-3">
						{data?.recentOrders.length ? (
							data.recentOrders.slice(0, 4).map((order) => (
								<div key={order.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
									<div className="flex items-center justify-between gap-3">
										<p className="font-medium text-slate-900">{order.orderNumber}</p>
										<span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
											{order.status}
										</span>
									</div>
									<p className="mt-1 text-sm text-slate-500">{formatRupiah(order.totalAmount)}</p>
								</div>
							))
						) : (
							<p className="text-sm text-slate-500">Belum ada order terbaru.</p>
						)}
					</div>
				</div>

				<div className="rounded-lg border border-sky-100 bg-sky-50 p-5">
					<h2 className="text-lg font-semibold text-slate-900">Mulai Belanja</h2>
					<p className="mt-2 text-sm text-slate-600">
						Buka katalog, pilih produk, lalu checkout dari keranjang untuk membuat purchase order.
					</p>
					<Link
						href="/toko/katalog"
						className="mt-4 inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
					>
						Buka Katalog
					</Link>
				</div>
			</section>
		</TokoStorefrontShell>
	);
}
