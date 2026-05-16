"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { tokoService, type TokoDashboardData } from "@/services/toko";
import { readTokoCart, setActiveTokoCartStore } from "@/services/toko-cart";

interface ErrorWithMessage {
	response?: {
		data?: {
			message?: string;
		};
	};
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

export default function TokoDashboardPage() {
	const [data, setData] = useState<TokoDashboardData | null>(null);
	const [cartCount, setCartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const dashboard = await tokoService.getDashboard();
			if (dashboard.store?.storeId) {
				setActiveTokoCartStore(dashboard.store.storeId);
			}
			setData(dashboard);
		} catch (err: unknown) {
			setError(
				(err as ErrorWithMessage)?.response?.data?.message ||
					"Gagal memuat dashboard toko.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const syncCart = () =>
			setCartCount(readTokoCart().reduce((sum, item) => sum + item.quantity, 0));
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		window.addEventListener("toko-cart-updated", syncCart);
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("toko-cart-updated", syncCart);
		};
	}, [load]);

	const quickActions = useMemo(
		() => [
			{
				label: "Belanja Produk",
				href: "/toko/katalog",
				description: "Lihat katalog dan masukkan produk ke keranjang.",
			},
			{
				label: "Cek Keranjang",
				href: "/toko/purchase-order",
				description: "Review item lalu ajukan purchase order ke fakturis.",
			},
			{
				label: "Lihat Tagihan",
				href: "/toko/hutang-toko",
				description: "Pantau invoice outstanding dan tanggal jatuh tempo.",
			},
			{
				label: "Ajukan Pembayaran",
				href: "/toko/pembayaran-online",
				description: "Input bukti bayar untuk diverifikasi oleh akuntan.",
			},
		],
		[],
	);

	return (
		<TokoStorefrontShell title="Dashboard Toko" cartCount={cartCount}>
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
				<div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
					<div>
						<p className="text-2xl font-semibold text-slate-900">
							{data?.store?.storeName || "Portal Operasional Toko"}
						</p>
						<p className="mt-1 text-sm text-slate-600">
							Gunakan dashboard ini untuk memantau grade, order, tagihan, dan pembayaran
							dengan alur yang mengikuti data scoped dari `BE2`.
						</p>
						<div className="mt-4 flex flex-wrap gap-2">
							<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
								Verifikasi: {data?.store?.verificationStatus || "-"}
							</span>
							<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
								Grade: {data?.store?.grade || "-"}
							</span>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						{quickActions.slice(0, 4).map((action) => (
							<Link
								key={action.href}
								href={action.href}
								className="rounded-xl border border-white/70 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
							>
								<p className="text-sm font-semibold text-slate-900">{action.label}</p>
								<p className="mt-1 text-xs text-slate-500">{action.description}</p>
							</Link>
						))}
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{
						label: "Grade Toko",
						value: data?.store?.grade ?? "-",
						tone: "border-cyan-200 bg-cyan-50 text-cyan-800",
					},
					{
						label: "Total Order",
						value: data?.store?.totalOrders ?? 0,
						tone: "border-indigo-200 bg-indigo-50 text-indigo-800",
					},
					{
						label: "Tagihan Berjalan",
						value: formatRupiah(data?.receivableStatement.totalOutstandingAmount ?? 0),
						tone: "border-amber-200 bg-amber-50 text-amber-800",
					},
					{
						label: "Pembayaran Masuk",
						value: formatRupiah(data?.receivableStatement.totalPaidAmount ?? 0),
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
						{loading ? (
							<p className="text-sm text-slate-500">Memuat order terbaru...</p>
						) : data?.recentOrders.length ? (
							data.recentOrders.slice(0, 4).map((order) => (
								<div key={order.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="font-medium text-slate-900">{order.orderNumber}</p>
											<p className="mt-1 text-xs text-slate-500">{dateOnly(order.documentDate)}</p>
										</div>
										<span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
											{order.status}
										</span>
									</div>
									<p className="mt-2 text-sm text-slate-700">{formatRupiah(order.totalAmount)}</p>
								</div>
							))
						) : (
							<p className="text-sm text-slate-500">Belum ada order terbaru.</p>
						)}
					</div>
				</div>

				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold text-slate-900">Invoice Terbaru</h2>
						<Link href="/toko/pembayaran-online" className="text-sm font-semibold text-sky-700">
							Buka pembayaran
						</Link>
					</div>
					<div className="mt-4 space-y-3">
						{loading ? (
							<p className="text-sm text-slate-500">Memuat invoice terbaru...</p>
						) : data?.recentInvoices.length ? (
							data.recentInvoices.slice(0, 4).map((invoice) => (
								<div key={invoice.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="font-medium text-slate-900">{invoice.invoiceNumber}</p>
											<p className="mt-1 text-xs text-slate-500">{dateOnly(invoice.invoiceDate)}</p>
										</div>
										<span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
											{invoice.status}
										</span>
									</div>
									<p className="mt-2 text-sm text-slate-700">
										Sisa: {formatRupiah(invoice.remainingAmount)}
									</p>
								</div>
							))
						) : (
							<p className="text-sm text-slate-500">Belum ada invoice terbaru.</p>
						)}
					</div>
				</div>
			</section>
		</TokoStorefrontShell>
	);
}
