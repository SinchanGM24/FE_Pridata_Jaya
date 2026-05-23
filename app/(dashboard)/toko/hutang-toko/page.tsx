"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { invoiceStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { receivableService, type ReceivableRow } from "@/services/receivable";
import { tokoService } from "@/services/toko";
import { readTokoCart } from "@/services/toko-cart";

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

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";

export default function StoreReceivablesPage() {
	const [rows, setRows] = useState<ReceivableRow[]>([]);
	const [cartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
	const [storeName, setStoreName] = useState("Toko");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [today] = useState(() => new Date().toISOString().slice(0, 10));

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [receivables, dashboard] = await Promise.all([
				receivableService.listAllForToko(),
				tokoService.getDashboard().catch(() => null),
			]);
			setRows(receivables);
			setStoreName(dashboard?.store?.storeName || "Toko");
		} catch (err: unknown) {
			setError(
				(err as ErrorWithMessage)?.response?.data?.message ||
					"Gagal memuat tagihan toko.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const summary = useMemo(() => {
		const totalOutstanding = rows.reduce(
			(sum, item) => sum + Number(item.remainingAmount || 0),
			0,
		);
		const overdueCount = rows.filter((item) => {
			if (!item.dueDate) return false;
			return dateOnly(item.dueDate) < today;
		}).length;

		return {
			totalOutstanding,
			overdueCount,
			totalDocuments: rows.length,
		};
	}, [rows, today]);

	return (
		<TokoFeatureLayout title="Tagihan Toko" cartCount={cartCount}>
			<section className="rounded-lg border border-sky-100 bg-sky-50 p-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-sm font-semibold text-slate-900">{storeName}</p>
						<p className="text-xs text-slate-600">
							Pantau seluruh tagihan aktif toko sebelum mengajukan pembayaran.
						</p>
					</div>
					<Link
						href="/toko/pembayaran-online"
						className="inline-flex rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
					>
						Buka Pembayaran
					</Link>
				</div>
			</section>

			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-xs text-slate-500">Total Tagihan Berjalan</p>
					<p className="mt-2 text-xl font-bold text-slate-900">
						{formatRupiah(summary.totalOutstanding)}
					</p>
				</div>
				<div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
					<p className="text-xs text-rose-700">Sudah Lewat Jatuh Tempo</p>
					<p className="mt-2 text-xl font-bold text-rose-700">
						{summary.overdueCount}
					</p>
				</div>
				<div className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm">
					<p className="text-xs text-sky-700">Total Dokumen</p>
					<p className="mt-2 text-xl font-bold text-sky-700">
						{summary.totalDocuments}
					</p>
				</div>
			</section>

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Daftar Tagihan</h2>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Muat Ulang
					</button>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Faktur</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Jatuh Tempo</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Sisa Tagihan</th>
							<th className="px-4 py-3">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-slate-500">
									Memuat data tagihan...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-slate-500">
									Tidak ada tagihan berjalan untuk toko ini.
								</td>
							</tr>
						) : (
							rows.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{item.invoiceNumber}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{item.storeNameSnapshot ?? item.customerName ?? "-"}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{dateOnly(item.dueDate)}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(item.totalAmount ?? item.amount)}
									</td>
									<td className="px-4 py-3 text-right font-semibold text-rose-700">
										{formatRupiah(item.remainingAmount)}
									</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
											{toUiLabel(item.status, invoiceStatusLabel)}
										</span>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</TokoFeatureLayout>
	);
}
