"use client";

import { useEffect, useMemo, useState } from "react";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";
import { ordersService, type CreateOrderPayload } from "@/services/orders";
import { tokoService } from "@/services/toko";
import {
	clearTokoCart,
	readTokoCart,
	type TokoCartItem,
	writeTokoCart,
} from "@/services/toko-cart";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

export default function StorePurchaseOrderPage() {
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [storeId, setStoreId] = useState("");
	const [cart, setCart] = useState<TokoCartItem[]>([]);
	const [warehouseId, setWarehouseId] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const [warehouseResult, dashboard] = await Promise.all([
					warehousesService.list({ page: 1, limit: 100 }),
					tokoService.getDashboard().catch(() => null),
				]);
				setWarehouses(warehouseResult.items);
				if (dashboard?.store?.storeId) setStoreId(dashboard.store.storeId);
			} catch (err: any) {
				setError(err?.response?.data?.message || "Gagal memuat data checkout.");
			} finally {
				setLoading(false);
			}
		};
		setCart(readTokoCart());
		load();
	}, []);

	const persistCart = (items: TokoCartItem[]) => {
		setCart(items);
		writeTokoCart(items);
	};

	const removeFromCart = (productId: string, condition: string) => {
		persistCart(
			cart.filter((item) => !(item.productId === productId && item.condition === condition)),
		);
	};

	const updateQty = (productId: string, condition: string, qty: number) => {
		persistCart(
			cart.map((item) =>
				item.productId === productId && item.condition === condition
					? { ...item, quantity: Math.max(1, Math.floor(qty || 1)) }
					: item,
			),
		);
	};

	const subtotal = useMemo(
		() => cart.reduce((sum, item) => sum + item.quantity * item.unitPriceSnapshot, 0),
		[cart],
	);
	const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
	const hasInvalidPrice = cart.some((item) => item.unitPriceSnapshot <= 0);

	const handleCheckout = async () => {
		if (!storeId) {
			setError("Data toko tidak ditemukan. Pastikan akun toko sudah login.");
			return;
		}
		if (!warehouseId) {
			setError("Pilih gudang sumber barang.");
			return;
		}
		if (cart.length === 0) {
			setError("Keranjang kosong.");
			return;
		}
		if (hasInvalidPrice) {
			setError("Ada produk tanpa harga jual. Lengkapi harga katalog di BE2 sebelum checkout.");
			return;
		}

		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			const payload: CreateOrderPayload = {
				storeId,
				sourceWarehouseId: warehouseId,
				notes: notes.trim() || undefined,
				items: cart.map((item) => ({
					productId: item.productId,
					condition: item.condition,
					quantity: item.quantity,
					unitPriceSnapshot: item.unitPriceSnapshot,
				})),
			};
			const order = await ordersService.createForToko(payload);
			setSuccess(`Order ${order.orderNumber} berhasil dibuat dan menunggu proses fakturis.`);
			clearTokoCart();
			setCart([]);
			setNotes("");
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal membuat order.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<TokoStorefrontShell title="Keranjang" cartCount={cartCount}>
			{success ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Invoice Sementara ({cart.length} item)</h2>
					{cart.length > 0 ? (
						<button
							type="button"
							onClick={() => {
								clearTokoCart();
								setCart([]);
							}}
							className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
						>
							Kosongkan
						</button>
					) : null}
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">Produk</th>
							<th className="px-4 py-3">Kondisi</th>
							<th className="px-4 py-3">Qty</th>
							<th className="px-4 py-3 text-right">Harga</th>
							<th className="px-4 py-3 text-right">Subtotal</th>
							<th className="px-4 py-3"></th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{cart.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-slate-500">
									Keranjang kosong. Pilih produk dari katalog terlebih dahulu.
								</td>
							</tr>
						) : (
							cart.map((item) => (
								<tr key={`${item.productId}-${item.condition}`}>
									<td className="px-4 py-3">
										<div className="flex items-center gap-3">
											<div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100">
												{item.imageUrl ? (
													<img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
												) : null}
											</div>
											<p className="font-medium text-slate-900">{item.productName}</p>
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{item.condition}</td>
									<td className="px-4 py-3">
										<input
											type="number"
											min={1}
											className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
											value={item.quantity}
											onChange={(event) =>
												updateQty(item.productId, item.condition, Number(event.target.value))
											}
										/>
									</td>
									<td className="px-4 py-3 text-right text-slate-700">
										{item.unitPriceSnapshot > 0 ? formatRupiah(item.unitPriceSnapshot) : "Belum ada harga"}
									</td>
									<td className="px-4 py-3 text-right font-medium text-slate-900">
										{formatRupiah(item.quantity * item.unitPriceSnapshot)}
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => removeFromCart(item.productId, item.condition)}
											className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
										>
											Hapus
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
					{cart.length > 0 ? (
						<tfoot>
							<tr className="border-t border-slate-200 bg-slate-50">
								<td colSpan={4} className="px-4 py-3 text-right font-medium text-slate-700">
									Total
								</td>
								<td className="px-4 py-3 text-right text-lg font-semibold text-slate-900">
									{formatRupiah(subtotal)}
								</td>
								<td></td>
							</tr>
						</tfoot>
					) : null}
				</table>
			</section>

			{cart.length > 0 ? (
				<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Checkout</h2>
					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<label className="space-y-1.5 text-sm text-slate-700">
							<span>Gudang Sumber</span>
							<select
								className="w-full rounded-lg border border-slate-300 px-3 py-2"
								value={warehouseId}
								onChange={(event) => setWarehouseId(event.target.value)}
								disabled={loading || submitting}
							>
								<option value="">Pilih gudang</option>
								{warehouses.map((warehouse) => (
									<option key={warehouse.id} value={warehouse.id}>
										{warehouse.name}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1.5 text-sm text-slate-700">
							<span>Catatan</span>
							<input
								className="w-full rounded-lg border border-slate-300 px-3 py-2"
								placeholder="Catatan order"
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								disabled={submitting}
							/>
						</label>
					</div>
					<div className="mt-4 flex items-center justify-between gap-3">
						<div className="text-sm text-slate-600">
							Total: <span className="font-semibold text-slate-900">{formatRupiah(subtotal)}</span>
						</div>
						<button
							type="button"
							onClick={handleCheckout}
							disabled={submitting || hasInvalidPrice}
							className="rounded-lg bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
						>
							{submitting ? "Memproses..." : "Ajukan ke Fakturis"}
						</button>
					</div>
				</section>
			) : null}
		</TokoStorefrontShell>
	);
}
