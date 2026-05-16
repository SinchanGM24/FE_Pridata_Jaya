"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CancelReasonModal from "@/components/fakturis/CancelReasonModal";
import OrderDetailModal from "@/components/fakturis/OrderDetailModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { ordersService, type OrderListItem, type OrderStatus } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: unknown }).response === "object" &&
		(error as { response?: { data?: { message?: string } } }).response?.data?.message
	) {
		return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
	}
	return fallback;
};

export default function PesananMasukPage() {
	const router = useRouter();
	const [items, setItems] = useState<OrderListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);
	const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null);
	const [cancelTarget, setCancelTarget] = useState<OrderListItem | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const status: OrderStatus = useMemo(() => "PENDING", []);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = await ordersService.list({
				page: 1,
				limit: 50,
				status,
				search: search || undefined,
			});
			setItems(res.items);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat pesanan."));
		} finally {
			setLoading(false);
		}
	}, [search, status]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [load]);

	const rows = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return items;
		return items.filter(
			(order) =>
				order.orderNumber.toLowerCase().includes(query) ||
				order.storeNameSnapshot.toLowerCase().includes(query),
		);
	}, [items, search]);

	const handleVerify = async (order: OrderListItem) => {
		setActionId(order.id);
		setError("");
		setSuccess("");
		try {
			await ordersService.verify(order.id);
			setSelectedOrder(null);
			router.push(`/fakturis/pembuatan-invoice?orderId=${order.id}`);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal verifikasi pesanan."));
		} finally {
			setActionId(null);
		}
	};

	const openCancelModal = (order: OrderListItem) => {
		setSelectedOrder(null);
		setCancelTarget(order);
		setCancelReason("");
	};

	const handleCancel = async () => {
		if (!cancelTarget || !cancelReason.trim()) return;

		setActionId(cancelTarget.id);
		setError("");
		setSuccess("");
		try {
			await ordersService.cancel(cancelTarget.id, cancelReason.trim());
			setSuccess(`Pesanan ${cancelTarget.orderNumber} berhasil dibatalkan.`);
			setCancelTarget(null);
			setCancelReason("");
			await load();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal membatalkan pesanan."));
		} finally {
			setActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Pesanan Masuk"
			description="Daftar order dengan status PENDING yang menunggu keputusan fakturis. Order bisa ditolak dari sini, atau diteruskan ke workspace invoice penuh untuk diproses seperti alur FE1."
		>
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-1 gap-2">
						<input
							className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
							placeholder="Cari order number / nama toko..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Cari
						</button>
						<button
							type="button"
							onClick={() => {
								setSearch("");
								setTimeout(load, 0);
							}}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
						>
							Reset
						</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<h2 className="font-semibold text-slate-900">Daftar Pesanan ({rows.length})</h2>
					<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
						PENDING
					</span>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">No. Order</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3 text-right">Total</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">
									Memuat...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-4 text-slate-600">
									Tidak ada pesanan PENDING.
								</td>
							</tr>
						) : (
							rows.map((order) => (
								<tr key={order.id}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{order.orderNumber}
									</td>
									<td className="px-4 py-3 text-slate-700">{order.storeNameSnapshot}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(order.documentDate)}</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{formatRupiah(order.totalAmount)}
									</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setSelectedOrder(order)}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
											>
												Detail
											</button>
											<button
												type="button"
												onClick={() => handleVerify(order)}
												disabled={actionId === order.id}
												className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
											>
												Verifikasi
											</button>
											<button
												type="button"
												onClick={() => openCancelModal(order)}
												disabled={actionId === order.id}
												className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
											>
												Batal
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<OrderDetailModal
				order={selectedOrder}
				actionLabel={actionId === selectedOrder?.id ? "Membuka Workspace..." : "Terima & Proses"}
				secondaryActionLabel="Tolak"
				actionDisabled={Boolean(actionId)}
				onClose={() => setSelectedOrder(null)}
				onPrimaryAction={handleVerify}
				onSecondaryAction={openCancelModal}
			/>

			<CancelReasonModal
				isOpen={Boolean(cancelTarget)}
				title="Batalkan Pesanan"
				description={
					cancelTarget
						? `Pesanan ${cancelTarget.orderNumber} akan dibatalkan. Alasan ini dikirim ke backend sebagai cancelReason.`
						: ""
				}
				reason={cancelReason}
				submitting={Boolean(actionId)}
				onReasonChange={setCancelReason}
				onClose={() => {
					setCancelTarget(null);
					setCancelReason("");
				}}
				onConfirm={handleCancel}
			/>
		</FeaturePage>
	);
}
