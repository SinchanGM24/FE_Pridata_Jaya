"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import PageFeedback from "@/components/shared/PageFeedback";
import QuantityStepper from "@/components/shared/QuantityStepper";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";
import { formatRupiah } from "@/lib/format";
import { ordersService, type CreateOrderPayload } from "@/services/orders";
import { salesService } from "@/services/sales";
import {
	clearSalesTokoCart,
	readSalesTokoCart,
	type SalesTokoCartItem,
	writeSalesTokoCart,
	getSalesActingStoreProfile,
	type SalesActingStoreProfile,
} from "@/services/sales-toko-cart";
import { normalizeSellableCartCondition } from "@/services/toko-cart";

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
	) {
		return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
	}
	return fallback;
};

const conditionLabel = (condition: string) => {
	if (condition === "GOOD") return "Bagus";
	if (condition === "DAMAGED" || condition === "DAMAGED") return "Rusak";
	return condition;
};

export default function SalesStorePurchaseOrderPage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const [actingProfile, setActingProfile] = useState<SalesActingStoreProfile | null>(null);
	const [contextReady, setContextReady] = useState(false);
	const accessError =
		contextReady && actingProfile?.storeId !== storeId
			? "Anda belum memilih toko untuk bertindak. Silakan kembali dan pilih toko dari daftar kelolaan."
			: "";

	const [storeName, setStoreName] = useState("Toko");
	const [cart, setCart] = useState<SalesTokoCartItem[]>([]);
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [confirmClear, setConfirmClear] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	useEffect(() => {
		if (!storeId) return;
		const timeoutId = window.setTimeout(() => {
			const profile = getSalesActingStoreProfile();
			setActingProfile(profile);
			setContextReady(true);
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [storeId]);

	useEffect(() => {
		if (!storeId || !contextReady) return;
		const load = async () => {
			setLoading(true);
			setError("");
			try {
				const managedStores = await salesService.getManagedStores().catch(() => []);
				const matchedStore = managedStores.find((item) => item.storeId === storeId) ?? null;
				if (matchedStore?.storeName) setStoreName(matchedStore.storeName);
				if (!matchedStore) {
					setError("Toko tidak ditemukan dalam daftar kelolaan sales.");
				}
			} catch (error: unknown) {
				setError(getErrorMessage(error, "Gagal memuat keranjang sales."));
			} finally {
				setLoading(false);
			}
		};

		if (actingProfile?.storeId !== storeId) return;
		load();
		const cartTimeoutId = window.setTimeout(() => {
			setCart(readSalesTokoCart(storeId));
		}, 0);
		const syncCart = (event: Event) => {
			const detail = (event as CustomEvent)?.detail as { storeId?: string } | undefined;
			if (detail?.storeId && detail.storeId !== storeId) return;
			setCart(readSalesTokoCart(storeId));
		};
		window.addEventListener("sales-toko-cart-updated", syncCart);
		return () => {
			window.clearTimeout(cartTimeoutId);
			window.removeEventListener("sales-toko-cart-updated", syncCart);
		};
	}, [actingProfile?.storeId, contextReady, storeId]);

	const persistCart = (items: SalesTokoCartItem[]) => {
		setCart(items);
		writeSalesTokoCart(storeId, items);
	};

	const removeFromCart = (productId: string, condition: string) => {
		persistCart(cart.filter((item) => !(item.productId === productId && item.condition === condition)));
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
			setError("Toko tidak ditemukan pada URL.");
			return;
		}
		if (cart.length === 0) {
			setError("Keranjang kosong.");
			return;
		}
		if (hasInvalidPrice) {
			setError("Ada produk tanpa harga jual. Lengkapi harga katalog sebelum checkout.");
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
					condition: normalizeSellableCartCondition(item).condition,
					quantity: item.quantity,
					unitPriceSnapshot: item.unitPriceSnapshot,
				})),
			};
			const order = await ordersService.createForSales(payload);
			setSuccess(`Order ${order.orderNumber} berhasil dibuat untuk ${storeName}.`);
			clearSalesTokoCart(storeId);
			setCart([]);
			setNotes("");
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal membuat order sales."));
		} finally {
			setSubmitting(false);
		}
	};

	const cartColumns: ResponsiveColumn<SalesTokoCartItem>[] = [
		{ key: "productName", head: "Produk", role: "title" },
		{
			key: "subtotal",
			head: "Subtotal",
			role: "amount",
			align: "right",
			render: (item) => formatRupiah(item.quantity * item.unitPriceSnapshot),
		},
		{
			key: "condition",
			head: "Kondisi",
			render: (item) => conditionLabel(item.condition),
		},
		{
			key: "unitPriceSnapshot",
			head: "Harga",
			align: "right",
			render: (item) =>
				item.unitPriceSnapshot > 0 ? (
					formatRupiah(item.unitPriceSnapshot)
				) : (
					<Badge tone="danger">Belum ada harga</Badge>
				),
		},
		{
			key: "quantity",
			head: "Jumlah",
			render: (item) => (
				<QuantityStepper
					value={item.quantity}
					disabled={submitting}
					onChange={(next) => updateQty(item.productId, item.condition, next)}
				/>
			),
		},
		{
			key: "remove",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (item) => (
				<Button
					variant="danger"
					size="sm"
					disabled={submitting}
					onClick={() => removeFromCart(item.productId, item.condition)}
				>
					<Trash2 className="h-4 w-4" />
					Hapus
				</Button>
			),
		},
	];

	return (
		<TokoStorefrontShell
			title={`Keranjang ${storeName}`}
			basePath={`/sales/toko-kelolaan/${storeId}`}
			cartCount={cartCount}
			profileName={storeName}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingProfile?.salesName ?? null}
		>
			<PageFeedback
				error={accessError || error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>

			<section className="space-y-3">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-base font-semibold text-slate-900 sm:text-lg">
						Keranjang ({cartCount} pcs)
					</h2>
					{cart.length > 0 ? (
						<Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
							Kosongkan
						</Button>
					) : null}
				</div>

				<ResponsiveTable
					columns={cartColumns}
					data={cart}
					getRowKey={(item) => `${item.productId}-${item.condition}`}
					loading={loading}
					skeletonRows={2}
					emptyText="Keranjang kosong"
					emptyDescription="Tambahkan produk dari katalog toko ini terlebih dahulu."
					emptyAction={
						<Button href={`/sales/toko-kelolaan/${storeId}/katalog`} variant="commerce">
							Buka Katalog
						</Button>
					}
					summary={
						cart.length > 0 ? (
							<div className="hidden items-center justify-between gap-4 px-4 py-3 md:flex">
								<span className="text-sm font-medium text-slate-600">Total</span>
								<span className="text-lg font-bold text-slate-900">{formatRupiah(subtotal)}</span>
							</div>
						) : null
					}
				/>
			</section>

			{cart.length > 0 ? (
				<Card>
					<h2 className="text-base font-semibold text-slate-900 sm:text-lg">Checkout</h2>
					<label className="mt-4 block space-y-1.5">
						<span className="block text-sm font-medium text-slate-700">
							Catatan <span className="font-normal text-slate-400">(opsional)</span>
						</span>
						<input
							className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none md:max-w-md"
							placeholder="mis. minta kirim pagi"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							disabled={submitting}
						/>
					</label>
					{hasInvalidPrice ? (
						<p className="mt-3 text-sm text-rose-700">
							Ada produk tanpa harga jual. Hapus produk tersebut sebelum mengajukan pesanan.
						</p>
					) : null}
					<div className="mt-4 hidden items-center justify-between gap-3 md:flex">
						<div className="text-sm text-slate-600">
							Total:{" "}
							<span className="font-semibold text-slate-900">{formatRupiah(subtotal)}</span>
						</div>
						<Button
							variant="commerce"
							onClick={handleCheckout}
							disabled={submitting || hasInvalidPrice}
						>
							{submitting ? "Mengirim..." : "Kirim Pesanan"}
						</Button>
					</div>
				</Card>
			) : null}

			{cart.length > 0 ? <div aria-hidden className="h-16 md:hidden" /> : null}

			{/* Total + CTA di zona jempol, tepat di atas bottom tab bar. */}
			{cart.length > 0 ? (
				<div className="fixed inset-x-0 bottom-tabbar-gap z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<p className="type-label text-slate-500">Total</p>
							<p className="truncate text-base font-bold text-slate-900">
								{formatRupiah(subtotal)}
							</p>
						</div>
						<Button
							variant="commerce"
							onClick={handleCheckout}
							disabled={submitting || hasInvalidPrice}
						>
							{submitting ? "Mengirim..." : "Kirim Pesanan"}
						</Button>
					</div>
				</div>
			) : null}

			<ConfirmDialog
				isOpen={confirmClear}
				title="Kosongkan keranjang?"
				description={`${cart.length} item akan dihapus dari keranjang toko ini. Tindakan ini tidak bisa dibatalkan.`}
				confirmLabel="Ya, kosongkan"
				onConfirm={() => {
					clearSalesTokoCart(storeId);
					setCart([]);
				}}
				onClose={() => setConfirmClear(false)}
			/>
		</TokoStorefrontShell>
	);
}
