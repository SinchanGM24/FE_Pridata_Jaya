"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { ordersService, type CreateOrderPayload } from "@/services/orders";
import { tokoService } from "@/services/toko";
import {
	clearTokoCart,
	readTokoCart,
	setActiveTokoCartStore,
	type TokoCartItem,
	writeTokoCart,
} from "@/services/toko-cart";

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
	}).format(value);

const getErrorMessage = (error: unknown, fallback: string) =>
	(error as ErrorWithMessage)?.response?.data?.message || fallback;

export default function StorePurchaseOrderPage() {
	const router = useRouter();
	const [storeId, setStoreId] = useState("");
	const [storeName, setStoreName] = useState("Toko");
	const [storeVerificationStatus, setStoreVerificationStatus] = useState("");
	const [cart, setCart] = useState<TokoCartItem[]>([]);
	const [notes, setNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [cartHydrated, setCartHydrated] = useState(false);

	useEffect(() => {
		const syncCart = () => {
			setCart(readTokoCart());
			setCartHydrated(true);
		};

		const load = async () => {
			try {
				const dashboard = await tokoService.getDashboard().catch(() => null);
				if (dashboard?.store?.storeId) {
					setStoreId(dashboard.store.storeId);
					setActiveTokoCartStore(dashboard.store.storeId);
					setCart(readTokoCart());
					setStoreName(dashboard.store.storeName || "Toko");
					setStoreVerificationStatus(dashboard.store.verificationStatus || "");
				}
			} catch (err: unknown) {
				setError(getErrorMessage(err, "Gagal memuat data checkout."));
			}
		};

		syncCart();
		void load();
		window.addEventListener("toko-cart-updated", syncCart);
		return () => {
			window.removeEventListener("toko-cart-updated", syncCart);
		};
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
			window.setTimeout(() => {
				router.push("/toko/riwayat-transaksi");
			}, 1200);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Gagal membuat order."));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<TokoStorefrontShell title="Keranjang" cartCount={cartCount}>
			<section className="rounded-lg border border-sky-100 bg-sky-50 p-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-sm font-semibold text-slate-900">{storeName}</p>
						<p className="text-xs text-slate-600">
							Susun pesanan lalu ajukan ke fakturis untuk diproses menjadi invoice.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{storeVerificationStatus ? (
							<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
								Status toko: {storeVerificationStatus}
							</span>
						) : null}
						<Link
							href="/toko/katalog"
							className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
						>
							Tambah Produk
						</Link>
					</div>
				</div>
			</section>

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
					<h2 className="text-lg font-semibold text-slate-900">
						Invoice Sementara ({cart.length} item)
					</h2>
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
						{!cartHydrated ? (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-slate-500">
									Memuat keranjang...
								</td>
							</tr>
						) : cart.length === 0 ? (
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
													<Image
														src={item.imageUrl}
														alt={item.productName}
														width={48}
														height={48}
														unoptimized
														className="h-full w-full object-cover"
													/>
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
										{item.unitPriceSnapshot > 0
											? formatRupiah(item.unitPriceSnapshot)
											: "Belum ada harga"}
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
							<span className="ml-3 text-xs text-slate-500">
								Gudang sumber akan ditentukan saat proses delivery order oleh tim gudang.
							</span>
						</div>
						<button
							type="button"
							onClick={handleCheckout}
							disabled={submitting || hasInvalidPrice || !storeId}
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
