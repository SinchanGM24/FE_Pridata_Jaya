"use client";

import { useEffect, useMemo, useState } from "react";
import CreateDeliveryOrderModal from "@/components/gudang/CreateDeliveryOrderModal";
import DeliveryOrderDetailModal from "@/components/gudang/DeliveryOrderDetailModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { ExportTriggerButton } from "@/components/reports/ExportTriggerButton";
import {
	deliveryOrdersService,
	type DeliveryOrderListItem,
} from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";

type FulfillmentStep = "pick" | "pack" | "ship";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

export default function PengirimanPage() {
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrderListItem[]>([]);
	const [deliveryOrderMap, setDeliveryOrderMap] = useState<Record<string, DeliveryOrderListItem | null>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [createTarget, setCreateTarget] = useState<InvoiceListItem | null>(null);
	const [selectedDeliveryOrder, setSelectedDeliveryOrder] =
		useState<DeliveryOrderListItem | null>(null);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [invoiceResult, deliveryOrderResult] = await Promise.all([
				invoicesService.list({ page: 1, limit: 100 }),
				deliveryOrdersService.list({ page: 1, limit: 100 }),
			]);
			const eligibleInvoices = invoiceResult.items.filter(
				(invoice) => invoice.status !== "CANCELLED",
			);
			setInvoices(eligibleInvoices);
			setDeliveryOrders(deliveryOrderResult.items);

			const doEntries = await Promise.all(
				eligibleInvoices.map(async (invoice) => {
					try {
						const deliveryOrder = await deliveryOrdersService.getByInvoiceId(invoice.id);
						return [invoice.id, deliveryOrder] as const;
					} catch {
						return [invoice.id, null] as const;
					}
				}),
			);

			setDeliveryOrderMap(Object.fromEntries(doEntries));
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat pengiriman dari invoice.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const invoiceRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return invoices.filter((invoice) => {
			if (!query) return true;
			return (
				invoice.invoiceNumber.toLowerCase().includes(query) ||
				invoice.storeNameSnapshot.toLowerCase().includes(query) ||
				(invoice.order?.orderNumber ?? "").toLowerCase().includes(query)
			);
		});
	}, [invoices, search]);

	const deliveryOrderRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return deliveryOrders.filter((deliveryOrder) => {
			if (!query) return true;
			return (
				deliveryOrder.deliveryOrderNumber.toLowerCase().includes(query) ||
				deliveryOrder.storeNameSnapshot.toLowerCase().includes(query)
			);
		});
	}, [deliveryOrders, search]);

	const buildPickingItems = (deliveryOrder: DeliveryOrderListItem) =>
		deliveryOrder.items
			.map((item) => ({
				productId: item.productId,
				condition: item.condition,
				quantity: item.orderedQuantity - item.pickedQuantity,
			}))
			.filter(
				(item): item is { productId: string; condition: "NEW" | "GOOD"; quantity: number } =>
					item.quantity > 0 && (item.condition === "NEW" || item.condition === "GOOD"),
			);

	const buildPackingItems = (deliveryOrder: DeliveryOrderListItem) =>
		deliveryOrder.items
			.map((item) => ({
				productId: item.productId,
				condition: item.condition,
				quantity: item.pickedQuantity - item.packedQuantity,
			}))
			.filter(
				(item): item is { productId: string; condition: "NEW" | "GOOD"; quantity: number } =>
					item.quantity > 0 && (item.condition === "NEW" || item.condition === "GOOD"),
			);

	const buildShipmentItems = (deliveryOrder: DeliveryOrderListItem) =>
		deliveryOrder.items
			.map((item) => ({
				productId: item.productId,
				condition: item.condition,
				quantity: item.packedQuantity - item.shippedQuantity,
			}))
			.filter(
				(item): item is { productId: string; condition: "NEW" | "GOOD"; quantity: number } =>
					item.quantity > 0 && (item.condition === "NEW" || item.condition === "GOOD"),
			);

	const selectedPickingItems = selectedDeliveryOrder ? buildPickingItems(selectedDeliveryOrder) : [];
	const selectedPackingItems = selectedDeliveryOrder ? buildPackingItems(selectedDeliveryOrder) : [];
	const selectedShipmentItems = selectedDeliveryOrder ? buildShipmentItems(selectedDeliveryOrder) : [];

	const handleCreateDeliveryOrder = async (invoice: InvoiceListItem) => {
		setActionId(invoice.id);
		setError("");
		setSuccess("");
		try {
			await deliveryOrdersService.createFromInvoice(invoice.id, {
				notes: notes[invoice.id]?.trim() || undefined,
			});
			setCreateTarget(null);
			setSuccess(`Delivery order dari invoice ${invoice.invoiceNumber} berhasil dibuat.`);
			await load();
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal membuat delivery order dari invoice.");
		} finally {
			setActionId(null);
		}
	};

	const handleProcessDeliveryOrder = async (
		step: FulfillmentStep,
		deliveryOrder: DeliveryOrderListItem,
	) => {
		setActionId(deliveryOrder.id);
		setError("");
		setSuccess("");
		try {
			if (step === "pick") {
				const items = buildPickingItems(deliveryOrder);
				if (items.length === 0) return;
				await deliveryOrdersService.pick(deliveryOrder.id, items);
				setSuccess(`${deliveryOrder.deliveryOrderNumber} berhasil dipicking.`);
			}
			if (step === "pack") {
				const items = buildPackingItems(deliveryOrder);
				if (items.length === 0) return;
				await deliveryOrdersService.pack(deliveryOrder.id, items);
				setSuccess(`${deliveryOrder.deliveryOrderNumber} berhasil dipacking.`);
			}
			if (step === "ship") {
				const items = buildShipmentItems(deliveryOrder);
				if (items.length === 0) return;
				await deliveryOrdersService.ship(deliveryOrder.id, {
					notes: notes[deliveryOrder.id]?.trim() || undefined,
					items,
				});
				setSuccess(`${deliveryOrder.deliveryOrderNumber} berhasil dikirim.`);
			}
			setSelectedDeliveryOrder(null);
			await load();
		} catch (err: any) {
			const messageMap: Record<FulfillmentStep, string> = {
				pick: "Gagal menjalankan picking.",
				pack: "Gagal menjalankan packing.",
				ship: "Gagal menjalankan shipment.",
			};
			setError(err?.response?.data?.message || messageMap[step]);
		} finally {
			setActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Pengiriman"
			description="Meja kerja gudang untuk mengubah invoice final menjadi delivery order lalu memproses picking, packing, dan shipping sampai pesanan keluar dari gudang."
		>
			<div className="flex justify-end">
				<ExportTriggerButton
					reportType="shipments"
					filters={{ search: search || undefined }}
					filterSummary={[
						search ? `Pencarian: ${search}` : "Semua pengiriman",
					]
						.filter(Boolean)
						.join(" • ")}
				/>
			</div>
			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row">
					<input
						className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari invoice, DO, order, atau toko"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</section>

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

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Bentuk Delivery Order Dari Invoice</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Total</th>
							<th className="px-4 py-3">Delivery Order</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Memuat invoice final...
								</td>
							</tr>
						) : invoiceRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Tidak ada invoice final yang siap diturunkan ke pengiriman.
								</td>
							</tr>
						) : (
							invoiceRows.map((invoice) => {
								const deliveryOrder = deliveryOrderMap[invoice.id];
								const disabled = actionId === invoice.id;

								return (
									<tr key={invoice.id}>
										<td className="px-4 py-3 align-top">
											<div className="font-medium text-slate-900">{invoice.invoiceNumber}</div>
											<div className="text-slate-500">{invoice.order?.orderNumber ?? "-"}</div>
											<div className="text-xs text-slate-500">{dateOnly(invoice.invoiceDate)}</div>
										</td>
										<td className="px-4 py-3 align-top text-slate-700">
											<div>{invoice.storeNameSnapshot}</div>
											<div className="text-xs text-slate-500">{invoice.status}</div>
										</td>
										<td className="px-4 py-3 align-top text-slate-900">
											{formatRupiah(invoice.totalAmount)}
										</td>
										<td className="px-4 py-3 align-top">
											{deliveryOrder ? (
												<div>
													<div className="font-medium text-slate-900">
														{deliveryOrder.deliveryOrderNumber}
													</div>
													<div className="text-slate-600">{deliveryOrder.status}</div>
													<div className="text-xs text-slate-500">
														{deliveryOrder.items.length} item
													</div>
												</div>
											) : (
												<span className="text-slate-500">Belum dibuat</span>
											)}
										</td>
										<td className="px-4 py-3 text-right align-top">
											{deliveryOrder ? (
												<button
													type="button"
													onClick={() => setSelectedDeliveryOrder(deliveryOrder)}
													className="rounded-lg border border-emerald-300 px-4 py-2 text-emerald-700 hover:bg-emerald-50"
												>
													Lihat DO
												</button>
											) : (
												<button
													type="button"
													onClick={() => setCreateTarget(invoice)}
													disabled={disabled}
													className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
												>
													{disabled ? "Membuat..." : "Buat DO"}
												</button>
											)}
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</section>

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Progress Delivery Order</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">Delivery Order</th>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Progress</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={4}>
									Memuat delivery order...
								</td>
							</tr>
						) : deliveryOrderRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={4}>
									Belum ada delivery order.
								</td>
							</tr>
						) : (
							deliveryOrderRows.map((deliveryOrder) => {
								const orderedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
								const pickedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.pickedQuantity, 0);
								const packedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.packedQuantity, 0);
								const shippedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.shippedQuantity, 0);

								return (
									<tr key={deliveryOrder.id}>
										<td className="px-4 py-3 align-top">
											<div className="font-medium text-slate-900">{deliveryOrder.deliveryOrderNumber}</div>
											<div className="text-slate-500">{dateOnly(deliveryOrder.documentDate)}</div>
											<div className="text-xs text-slate-500">
												{deliveryOrder.items.length} item, {deliveryOrder.shipments.length} shipment
											</div>
										</td>
										<td className="px-4 py-3 align-top text-slate-700">
											{deliveryOrder.storeNameSnapshot}
										</td>
										<td className="px-4 py-3 align-top text-slate-700">
											<div className="font-medium">{deliveryOrder.status}</div>
											<div className="mt-1 text-xs text-slate-500">Pick {pickedTotal}/{orderedTotal}</div>
											<div className="text-xs text-slate-500">Pack {packedTotal}/{orderedTotal}</div>
											<div className="text-xs text-slate-500">Ship {shippedTotal}/{orderedTotal}</div>
										</td>
										<td className="px-4 py-3 text-right align-top">
											<button
												type="button"
												onClick={() => setSelectedDeliveryOrder(deliveryOrder)}
												className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
											>
												Proses
											</button>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</section>

			<CreateDeliveryOrderModal
				invoice={createTarget}
				notes={createTarget ? notes[createTarget.id] ?? "" : ""}
				submitting={Boolean(actionId)}
				onNotesChange={(value) => {
					if (!createTarget) return;
					setNotes((prev) => ({ ...prev, [createTarget.id]: value }));
				}}
				onClose={() => setCreateTarget(null)}
				onConfirm={handleCreateDeliveryOrder}
			/>

			<DeliveryOrderDetailModal
				deliveryOrder={selectedDeliveryOrder}
				notes={selectedDeliveryOrder ? notes[selectedDeliveryOrder.id] ?? "" : ""}
				submitting={Boolean(actionId)}
				pickingItems={selectedPickingItems}
				packingItems={selectedPackingItems}
				shipmentItems={selectedShipmentItems}
				onNotesChange={(value) => {
					if (!selectedDeliveryOrder) return;
					setNotes((prev) => ({ ...prev, [selectedDeliveryOrder.id]: value }));
				}}
				onClose={() => setSelectedDeliveryOrder(null)}
				onProcess={handleProcessDeliveryOrder}
			/>
		</FeaturePage>
	);
}
