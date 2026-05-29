"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CreateDeliveryOrderModal from "@/components/gudang/CreateDeliveryOrderModal";
import DeliveryOrderDetailModal from "@/components/gudang/DeliveryOrderDetailModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { deliveryOrderStatusLabel, toUiLabel } from "@/lib/ui-labels";
import {
	deliveryOrdersService,
	type DeliveryOrderListItem,
} from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";
import { warehouseInventoryService, type WarehouseInventoryItem } from "@/services/warehouse-inventory";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

type ShipmentFormState = {
	driverName: string;
};

type WorkbenchTab = "create-do" | "driver" | "history";
type HistoryStatusFilter = "ALL" | "SHIPPED" | "RECEIVED";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");
const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();
const isDeliveryOrderActive = (deliveryOrder: DeliveryOrderListItem) =>
	!["SHIPPED", "RECEIVED", "CANCELLED"].includes(deliveryOrder.status);
const latestDriverName = (deliveryOrder: DeliveryOrderListItem) =>
	normalizeText(deliveryOrder.shipments.at(-1)?.driverName ?? "");
const getHistoryStatusMeta = (status: DeliveryOrderListItem["status"]) => {
	if (status === "RECEIVED") {
		return {
			label: "Berhasil diterima",
			className: "border border-emerald-200 bg-emerald-50/80 text-emerald-700",
		};
	}
	return {
		label: "Sedang dikirim",
		className: "border border-sky-200 bg-sky-50/80 text-sky-700",
	};
};

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

function PengirimanPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const focusInvoiceId = searchParams.get("invoiceId");

	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [ordersById, setOrdersById] = useState<Record<string, OrderListItem>>({});
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrderListItem[]>([]);
	const [deliveryOrderMap, setDeliveryOrderMap] = useState<Record<string, DeliveryOrderListItem | null>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [warehouseFilter, setWarehouseFilter] = useState("ALL");
	const [driverWarehouseFilter, setDriverWarehouseFilter] = useState("ALL");
	const [activeTab, setActiveTab] = useState<WorkbenchTab>("create-do");
	const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("ALL");
	const [actionId, setActionId] = useState<string | null>(null);
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [shipmentForms, setShipmentForms] = useState<Record<string, ShipmentFormState>>({});
	const [sourceWarehouseSelections, setSourceWarehouseSelections] = useState<Record<string, string>>({});
	const [createTarget, setCreateTarget] = useState<InvoiceListItem | null>(null);
	const [selectedDeliveryOrder, setSelectedDeliveryOrder] =
		useState<DeliveryOrderListItem | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [invoiceItems, deliveryOrderItems, orderItems, warehouseItems, inventoryItems] = await Promise.all([
				invoicesService.listAll({ sortBy: "invoiceDate", sortOrder: "desc" }),
				deliveryOrdersService.listAll(),
				ordersService.listAll({ status: "PROCESSED" }),
				warehousesService.listAll(),
				warehouseInventoryService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
			]);
			const eligibleInvoices = invoiceItems.filter((invoice) => invoice.status !== "CANCELLED");
			setInvoices(eligibleInvoices);
			setDeliveryOrders(deliveryOrderItems);
			setOrdersById(Object.fromEntries(orderItems.map((item) => [item.id, item])));
			setWarehouses(warehouseItems);
			setInventory(
				inventoryItems.filter(
					(item) => item.condition === "GOOD" && item.quantity > 0,
				),
			);
			setDeliveryOrderMap(
				Object.fromEntries(
					eligibleInvoices.map((invoice) => [
						invoice.id,
						deliveryOrderItems.find((deliveryOrder) => deliveryOrder.invoiceId === invoice.id) ?? null,
					]),
				),
			);
			setShipmentForms((current) => {
				const next = { ...current };
				for (const deliveryOrder of deliveryOrderItems) {
					if (next[deliveryOrder.id]) continue;
					next[deliveryOrder.id] = {
						driverName: deliveryOrder.shipments.at(-1)?.driverName ?? "",
					};
				}
				return next;
			});
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat pengiriman dari invoice."));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [load]);

	const getOrderWarehouse = useCallback(
		(invoice: InvoiceListItem | null) => {
			if (!invoice) return null;
			return ordersById[invoice.orderId]?.sourceWarehouseId
				? warehouses.find((warehouse) => warehouse.id === ordersById[invoice.orderId]?.sourceWarehouseId) ?? null
				: null;
		},
		[ordersById, warehouses],
	);

	const saleInventoryMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const item of inventory) {
			if (item.condition !== "GOOD") continue;
			const key = `${item.warehouseId}:${item.productId}:${item.condition}`;
			map.set(key, (map.get(key) ?? 0) + item.quantity);
		}
		return map;
	}, [inventory]);

	const activeCommitmentMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const deliveryOrder of deliveryOrders) {
			if (!isDeliveryOrderActive(deliveryOrder)) continue;
			for (const item of deliveryOrder.items) {
				if (item.condition !== "GOOD") continue;
				const remainingQuantity = Math.max(0, item.orderedQuantity - item.shippedQuantity);
				if (remainingQuantity === 0) continue;
				const key = `${deliveryOrder.sourceWarehouseId}:${item.productId}:${item.condition}`;
				map.set(key, (map.get(key) ?? 0) + remainingQuantity);
			}
		}
		return map;
	}, [deliveryOrders]);

	const getAvailableSaleStock = useCallback(
		(warehouseId: string, productId: string, condition: "GOOD", excludeDeliveryOrderId?: string) => {
			const key = `${warehouseId}:${productId}:${condition}`;
			let committedQuantity = activeCommitmentMap.get(key) ?? 0;
			if (excludeDeliveryOrderId) {
				const excluded = deliveryOrders.find((deliveryOrder) => deliveryOrder.id === excludeDeliveryOrderId);
				if (excluded) {
					committedQuantity -= excluded.items.reduce((sum, item) => {
						if (item.condition !== condition || item.productId !== productId) return sum;
						return sum + Math.max(0, item.orderedQuantity - item.shippedQuantity);
					}, 0);
				}
			}
			return Math.max(0, (saleInventoryMap.get(key) ?? 0) - Math.max(0, committedQuantity));
		},
		[activeCommitmentMap, deliveryOrders, saleInventoryMap],
	);

	const eligibleWarehousesByInvoiceId = useMemo(() => {
		const result: Record<
			string,
			Array<{ id: string; name: string; shortfallCount: number; totalAvailable: number }>
		> = {};

		for (const invoice of invoices) {
			const order = ordersById[invoice.orderId];
			const orderItems = order?.items ?? [];
			if (!orderItems.length) {
				result[invoice.id] = [];
				continue;
			}

			result[invoice.id] = warehouses
				.map((warehouse) => {
					const shortfallCount = orderItems.reduce((count, item) => {
						const available =
							item.condition === "GOOD"
								? getAvailableSaleStock(warehouse.id, item.productId, item.condition)
								: 0;
						return count + (available < item.quantity ? 1 : 0);
					}, 0);
					const totalAvailable = orderItems.reduce((sum, item) => {
						const available =
							item.condition === "GOOD"
								? getAvailableSaleStock(warehouse.id, item.productId, item.condition)
								: 0;
						return sum + available;
					}, 0);
					return {
						id: warehouse.id,
						name: warehouse.name,
						shortfallCount,
						totalAvailable,
					};
				})
				.filter((warehouse) => warehouse.shortfallCount === 0)
				.sort((left, right) => right.totalAvailable - left.totalAvailable);
		}

		return result;
	}, [getAvailableSaleStock, invoices, ordersById, warehouses]);

	const getSelectedSourceWarehouseId = useCallback(
		(invoice: InvoiceListItem | null) => {
			if (!invoice) return "";
			const options = eligibleWarehousesByInvoiceId[invoice.id] ?? [];
			const selectedId = sourceWarehouseSelections[invoice.id];
			if (selectedId && options.some((item) => item.id === selectedId)) {
				return selectedId;
			}
			const preferredId = getOrderWarehouse(invoice)?.id;
			if (preferredId && options.some((item) => item.id === preferredId)) {
				return preferredId;
			}
			return options[0]?.id ?? "";
		},
		[eligibleWarehousesByInvoiceId, getOrderWarehouse, sourceWarehouseSelections],
	);

	const invoiceRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return invoices.filter((invoice) => {
			const warehouseName = getOrderWarehouse(invoice)?.name ?? "";
			const matchWarehouse =
				warehouseFilter === "ALL" ||
				getOrderWarehouse(invoice)?.id === warehouseFilter;
			if (!query) return matchWarehouse;
			const matchQuery = (
				invoice.invoiceNumber.toLowerCase().includes(query) ||
				invoice.storeNameSnapshot.toLowerCase().includes(query) ||
				(invoice.order?.orderNumber ?? "").toLowerCase().includes(query) ||
				warehouseName.toLowerCase().includes(query)
			);
			return matchQuery && matchWarehouse;
		});
	}, [getOrderWarehouse, invoices, search, warehouseFilter]);

	const deliveryOrderRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return deliveryOrders.filter((deliveryOrder) => {
			const driverName = latestDriverName(deliveryOrder);
			const matchWarehouse =
				warehouseFilter === "ALL" || deliveryOrder.sourceWarehouseId === warehouseFilter;
			const matchQuery =
				!query ||
				deliveryOrder.deliveryOrderNumber.toLowerCase().includes(query) ||
				deliveryOrder.storeNameSnapshot.toLowerCase().includes(query) ||
				driverName.toLowerCase().includes(query);
			return matchQuery && matchWarehouse;
		});
	}, [deliveryOrders, search, warehouseFilter]);

	const summary = useMemo(
		() => ({
			readyInvoices: invoiceRows.filter((invoice) => !deliveryOrderMap[invoice.id]).length,
			openDo: deliveryOrderRows.filter((item) => isDeliveryOrderActive(item)).length,
			shippedDo: deliveryOrderRows.filter((item) => item.status === "SHIPPED").length,
			totalDo: deliveryOrderRows.length,
		}),
		[deliveryOrderMap, deliveryOrderRows, invoiceRows],
	);

	const warehouseShipmentReport = useMemo(
		() =>
			warehouses
				.map((warehouse) => {
					const rows = deliveryOrderRows.filter((item) => item.sourceWarehouseId === warehouse.id);
					const shippedRows = rows.filter((item) => item.status === "SHIPPED");
					return {
						id: warehouse.id,
						name: warehouse.name,
						totalDo: rows.length,
						activeDo: rows.filter((item) => item.status !== "SHIPPED" && item.status !== "CANCELLED").length,
						shippedDo: shippedRows.length,
						totalItemsShipped: shippedRows.reduce(
							(sum, deliveryOrder) =>
								sum +
								deliveryOrder.items.reduce((itemSum, item) => itemSum + item.shippedQuantity, 0),
							0,
						),
					};
				})
				.filter((item) => item.totalDo > 0),
		[deliveryOrderRows, warehouses],
	);

	const driverShipmentReport = useMemo(() => {
		const report = new Map<
			string,
			{
				driverName: string;
				totalShipments: number;
				deliveryOrderIds: Set<string>;
				lastShippedAt: string | null;
			}
		>();

		for (const deliveryOrder of deliveryOrderRows) {
			for (const shipment of deliveryOrder.shipments) {
				const driverName = normalizeText(shipment.driverName ?? "");
				if (!driverName) continue;
				const current = report.get(driverName) ?? {
					driverName,
					totalShipments: 0,
					deliveryOrderIds: new Set<string>(),
					lastShippedAt: null,
				};
				current.totalShipments += 1;
				current.deliveryOrderIds.add(deliveryOrder.id);
				if (!current.lastShippedAt || shipment.shippedAt > current.lastShippedAt) {
					current.lastShippedAt = shipment.shippedAt;
				}
				report.set(driverName, current);
			}
		}

		return Array.from(report.values())
			.map((item) => ({
				driverName: item.driverName,
				totalShipments: item.totalShipments,
				totalDo: item.deliveryOrderIds.size,
				lastShippedAt: item.lastShippedAt,
			}))
			.sort((left, right) => {
			if (right.totalShipments !== left.totalShipments) {
				return right.totalShipments - left.totalShipments;
			}
			return left.driverName.localeCompare(right.driverName, "id");
			});
	}, [deliveryOrderRows]);

	const focusedInvoice = useMemo(
		() => (focusInvoiceId ? invoices.find((item) => item.id === focusInvoiceId) ?? null : null),
		[focusInvoiceId, invoices],
	);

	const focusedDeliveryOrder = useMemo(
		() => (focusInvoiceId ? deliveryOrderMap[focusInvoiceId] ?? null : null),
		[deliveryOrderMap, focusInvoiceId],
	);

	const focusInfoMessage = useMemo(() => {
		if (!focusedInvoice) return "";
		if (focusedDeliveryOrder) {
			return `Invoice ${focusedInvoice.invoiceNumber} sudah punya delivery order ${focusedDeliveryOrder.deliveryOrderNumber}. Dokumen dibuka untuk dilanjutkan oleh gudang.`;
		}
		return `Invoice ${focusedInvoice.invoiceNumber} baru difinalisasi fakturis dan siap diturunkan menjadi delivery order.`;
	}, [focusedDeliveryOrder, focusedInvoice]);

	const buildShipmentItems = (deliveryOrder: DeliveryOrderListItem) =>
		deliveryOrder.items
			.map((item) => ({
				productId: item.productId,
				condition: item.condition,
				quantity: item.orderedQuantity - item.shippedQuantity,
			}))
			.filter(
				(item): item is { productId: string; condition: "GOOD"; quantity: number } =>
					item.quantity > 0 && item.condition === "GOOD",
			);

	const selectedShipmentItems = selectedDeliveryOrder ? buildShipmentItems(selectedDeliveryOrder) : [];

	const createDoRows = useMemo(
		() => invoiceRows.filter((invoice) => !deliveryOrderMap[invoice.id]),
		[deliveryOrderMap, invoiceRows],
	);

	const driverWarehouseOptions = useMemo(
		() =>
			warehouses
				.map((warehouse) => ({
					id: warehouse.id,
					name: warehouse.name,
					count: deliveryOrderRows.filter(
						(deliveryOrder) =>
							isDeliveryOrderActive(deliveryOrder) &&
							deliveryOrder.sourceWarehouseId === warehouse.id,
					).length,
				}))
				.filter((warehouse) => warehouse.count > 0),
		[deliveryOrderRows, warehouses],
	);

	const effectiveDriverWarehouseFilter =
		driverWarehouseFilter === "ALL" ||
		driverWarehouseOptions.some((warehouse) => warehouse.id === driverWarehouseFilter)
			? driverWarehouseFilter
			: "ALL";

	const driverRows = useMemo(
		() =>
			deliveryOrderRows
				.filter((deliveryOrder) => isDeliveryOrderActive(deliveryOrder))
				.filter(
					(deliveryOrder) =>
						effectiveDriverWarehouseFilter === "ALL" ||
						deliveryOrder.sourceWarehouseId === effectiveDriverWarehouseFilter,
				)
				.sort((left, right) => String(right.documentDate).localeCompare(String(left.documentDate))),
		[deliveryOrderRows, effectiveDriverWarehouseFilter],
	);

	const historyRows = useMemo(
		() =>
			deliveryOrderRows
				.filter(
					(deliveryOrder) =>
						(deliveryOrder.status === "SHIPPED" ||
							deliveryOrder.status === "RECEIVED") &&
						(historyStatusFilter === "ALL" || deliveryOrder.status === historyStatusFilter),
				)
				.sort((left, right) => String(right.documentDate).localeCompare(String(left.documentDate))),
		[deliveryOrderRows, historyStatusFilter],
	);

	const tabItems: Array<{ id: WorkbenchTab; label: string; count: number }> = [
		{ id: "create-do", label: "Buat DO", count: createDoRows.length },
		{ id: "driver", label: "Isi Driver", count: driverRows.length },
		{ id: "history", label: "Riwayat", count: historyRows.length },
	];

	const getShipmentShortages = useCallback(
		(deliveryOrder: DeliveryOrderListItem) =>
			buildShipmentItems(deliveryOrder)
				.map((item) => {
					const available = getAvailableSaleStock(
						deliveryOrder.sourceWarehouseId,
						item.productId,
						item.condition,
						deliveryOrder.id,
					);
					return {
						productId: item.productId,
						productName:
							deliveryOrder.items.find(
								(row) => row.productId === item.productId && row.condition === item.condition,
							)?.product?.name ?? item.productId,
						condition: item.condition,
						required: item.quantity,
						available,
					};
				})
				.filter((item) => item.available < item.required),
		[getAvailableSaleStock],
	);

	const getShipmentBlockedReason = useCallback(
		(deliveryOrder: DeliveryOrderListItem | null) => {
			if (!deliveryOrder) return "";
			const shipmentItems = buildShipmentItems(deliveryOrder);
			if (shipmentItems.length === 0) {
				return "Tidak ada sisa barang yang perlu dikirim untuk delivery order ini.";
			}
			const driverName = normalizeText(shipmentForms[deliveryOrder.id]?.driverName ?? "");
			if (!driverName) {
				return "Nama driver wajib diisi sebelum tombol kirim bisa digunakan.";
			}
			const shortages = getShipmentShortages(deliveryOrder);
			if (shortages.length > 0) {
				const firstShortage = shortages[0];
				return `Stok ${firstShortage.productName} di ${
					warehouses.find((warehouse) => warehouse.id === deliveryOrder.sourceWarehouseId)?.name ??
					"gudang pengirim"
				} tidak mencukupi. Tersedia ${firstShortage.available}, dibutuhkan ${firstShortage.required}.`;
			}
			if (
				deliveryOrder.status === "SHIPPED" ||
				deliveryOrder.status === "CANCELLED" ||
				deliveryOrder.status === "RECEIVED"
			) {
				return "Delivery order ini sudah tidak bisa diproses kirim lagi.";
			}
			return "";
		},
		[getShipmentShortages, shipmentForms, warehouses],
	);

	const clearFocusedInvoice = () => {
		if (!focusInvoiceId) return;
		router.replace("/gudang/pengiriman");
	};

	const handleCreateDeliveryOrder = async (invoice: InvoiceListItem) => {
		const sourceWarehouseId = getSelectedSourceWarehouseId(invoice);
		if (!sourceWarehouseId) {
			setError("Belum ada gudang yang stok aktifnya cukup untuk memenuhi pesanan ini.");
			return;
		}

		setActionId(invoice.id);
		setError("");
		setSuccess("");
		try {
			await deliveryOrdersService.createFromInvoice(invoice.id, {
				sourceWarehouseId,
				notes:
					[
						`Gudang pengirim: ${
							warehouses.find((warehouse) => warehouse.id === sourceWarehouseId)?.name ?? "-"
						}`,
						notes[invoice.id]?.trim() || "",
					]
						.filter(Boolean)
						.join("\n") || undefined,
			});
			setCreateTarget(null);
			setActiveTab("driver");
			clearFocusedInvoice();
			setSuccess(`Delivery order dari invoice ${invoice.invoiceNumber} berhasil dibuat.`);
			await load();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal membuat delivery order dari invoice."));
		} finally {
			setActionId(null);
		}
	};

	const handleProcessDeliveryOrder = async (deliveryOrder: DeliveryOrderListItem) => {
		const shipmentForm = shipmentForms[deliveryOrder.id] ?? {
			driverName: "",
		};
		const shipmentBlockedReason = getShipmentBlockedReason(deliveryOrder);
		const items = buildShipmentItems(deliveryOrder);

		setActionId(deliveryOrder.id);
		setError("");
		setSuccess("");
		try {
			if (shipmentBlockedReason) {
				setError(shipmentBlockedReason);
				return;
			}
			if (items.length === 0) return;
			await deliveryOrdersService.ship(deliveryOrder.id, {
				driverName: normalizeText(shipmentForm.driverName),
				notes: notes[deliveryOrder.id]?.trim() || undefined,
				items,
			});
			setSuccess(`${deliveryOrder.deliveryOrderNumber} berhasil dikirim.`);
			setSelectedDeliveryOrder(null);
			setActiveTab("history");
			clearFocusedInvoice();
			await load();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal menjalankan pengiriman."));
		} finally {
			setActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Pengiriman"
			description="Meja kerja gudang untuk menerima invoice final dari fakturis, memilih gudang pengirim yang stoknya cukup, lalu langsung memproses kirim sampai barang keluar dari gudang."
		>
			<section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
				Nama driver wajib diisi sebelum kirim. Gudang pengirim yang dipilih akan menjadi sumber pengurangan stok, sehingga pergerakan barang antar gudang tetap jelas dan transparan.
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Invoice Siap DO", value: summary.readyInvoices },
					{ label: "DO Aktif", value: summary.openDo },
					{ label: "DO Terkirim", value: summary.shippedDo },
					{ label: "Total DO", value: summary.totalDo },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			{focusInvoiceId ? (
				<div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
					Halaman ini dibuka dari riwayat transaksi fakturis untuk melanjutkan invoice ke gudang.
				</div>
			) : null}

			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="mb-4 flex flex-wrap gap-2">
					{tabItems.map((tab) => {
						const active = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
									active
										? "border-slate-900 bg-slate-900 text-white"
										: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
								}`}
							>
								{tab.label} <span className={active ? "text-slate-200" : "text-slate-500"}>{tab.count}</span>
							</button>
						);
					})}
				</div>
				<div className="flex flex-col gap-3 md:flex-row">
					<input
						className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari invoice, DO, order, toko, atau driver"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<select
						value={warehouseFilter}
						onChange={(event) => setWarehouseFilter(event.target.value)}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="ALL">Semua Gudang</option>
						{warehouses.map((warehouse) => (
							<option key={warehouse.id} value={warehouse.id}>
								{warehouse.name}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</section>

			<section className="grid gap-4 xl:grid-cols-2">
				<div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-lg font-semibold text-slate-900">Audit Per Gudang</h2>
						<p className="mt-1 text-sm text-slate-500">
							Ringkasan ini membantu melihat DO aktif dan barang terkirim dari masing-masing gudang sumber.
						</p>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Gudang</th>
								<th className="px-4 py-3 text-right">DO Aktif</th>
								<th className="px-4 py-3 text-right">DO Terkirim</th>
								<th className="px-4 py-3 text-right">Qty Terkirim</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{warehouseShipmentReport.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={4}>
										Belum ada data pengiriman untuk filter yang dipilih.
									</td>
								</tr>
							) : (
								warehouseShipmentReport.map((item) => (
									<tr key={item.id}>
										<td className="px-4 py-3 text-slate-900">
											<div className="font-medium">{item.name}</div>
											<div className="text-xs text-slate-500">{item.totalDo} total DO</div>
										</td>
										<td className="px-4 py-3 text-right text-slate-700">{item.activeDo}</td>
										<td className="px-4 py-3 text-right text-slate-700">{item.shippedDo}</td>
										<td className="px-4 py-3 text-right text-slate-900">{item.totalItemsShipped}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-lg font-semibold text-slate-900">Audit Per Driver</h2>
						<p className="mt-1 text-sm text-slate-500">
							Driver hanya muncul di area gudang agar tim bisa audit pengiriman tanpa masuk ke meja kerja fakturis.
						</p>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Driver</th>
								<th className="px-4 py-3 text-right">Shipment</th>
								<th className="px-4 py-3 text-right">DO</th>
								<th className="px-4 py-3">Terakhir Kirim</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{driverShipmentReport.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={4}>
										Belum ada driver yang tercatat untuk filter yang dipilih.
									</td>
								</tr>
							) : (
								driverShipmentReport.map((item) => (
									<tr key={item.driverName}>
										<td className="px-4 py-3 font-medium text-slate-900">{item.driverName}</td>
										<td className="px-4 py-3 text-right text-slate-700">{item.totalShipments}</td>
										<td className="px-4 py-3 text-right text-slate-700">{item.totalDo}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(item.lastShippedAt)}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
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
			{!success && focusInfoMessage ? (
				<div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
					{focusInfoMessage}
				</div>
			) : null}

			{activeTab === "create-do" ? (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-lg font-semibold text-slate-900">Buat Delivery Order</h2>
						<p className="mt-1 text-sm text-slate-500">
							Invoice final dari fakturis dipilih gudang pengirimnya lebih dulu. Pilihan gudang hanya muncul bila stok siapnya cukup.
						</p>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Invoice</th>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Gudang Siap</th>
								<th className="px-4 py-3">Nilai</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Memuat invoice siap DO...
									</td>
								</tr>
							) : createDoRows.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Tidak ada invoice final yang perlu dibuatkan DO untuk filter ini.
									</td>
								</tr>
							) : (
								createDoRows.map((invoice) => {
									const options = eligibleWarehousesByInvoiceId[invoice.id] ?? [];
									const selectedWarehouseId = getSelectedSourceWarehouseId(invoice);
									const selectedWarehouse = options.find((warehouse) => warehouse.id === selectedWarehouseId);
									const disabled = actionId === invoice.id || options.length === 0;
									const isFocused = focusInvoiceId === invoice.id;

									return (
										<tr key={invoice.id} className={isFocused ? "bg-indigo-50" : undefined}>
											<td className="px-4 py-3 align-top">
												<div className="font-medium text-slate-900">{invoice.invoiceNumber}</div>
												<div className="text-xs text-slate-500">
													{invoice.order?.orderNumber ?? "-"} | {dateOnly(invoice.invoiceDate)}
												</div>
											</td>
											<td className="px-4 py-3 align-top text-slate-700">
												<div>{invoice.storeNameSnapshot}</div>
												<div className="text-xs text-slate-500">{invoice.status}</div>
											</td>
											<td className="px-4 py-3 align-top text-slate-700">
												<div>{selectedWarehouse?.name ?? "Belum ada stok cukup"}</div>
												<div className="text-xs text-slate-500">
													{options.length > 0 ? `${options.length} gudang bisa dipilih` : "Cek stok atau transfer gudang dulu"}
												</div>
											</td>
											<td className="px-4 py-3 align-top text-slate-900">{formatRupiah(invoice.totalAmount)}</td>
											<td className="px-4 py-3 text-right align-top">
												<button
													type="button"
													onClick={() => setCreateTarget(invoice)}
													disabled={disabled}
													className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
												>
													{actionId === invoice.id ? "Membuat..." : "Buat DO"}
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</section>
			) : null}

			{activeTab === "driver" ? (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Isi Driver</h2>
							<p className="mt-1 text-sm text-slate-500">
								DO yang sudah dibuat masuk ke tahap ini. Driver wajib diisi sebelum DO diproses sebagai pengiriman.
							</p>
						</div>
						<div className="w-full lg:w-72">
							<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
								Filter Gudang
							</label>
							<select
								value={effectiveDriverWarehouseFilter}
								onChange={(event) => setDriverWarehouseFilter(event.target.value)}
								className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
							>
								<option value="ALL">Semua Gudang ({driverRows.length})</option>
								{driverWarehouseOptions.map((warehouse) => (
									<option key={warehouse.id} value={warehouse.id}>
										{warehouse.name} ({warehouse.count})
									</option>
								))}
							</select>
						</div>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Delivery Order</th>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Gudang</th>
								<th className="px-4 py-3">Driver</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Memuat DO aktif...
									</td>
								</tr>
							) : driverRows.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Tidak ada DO yang menunggu driver untuk filter ini.
									</td>
								</tr>
							) : (
								driverRows.map((deliveryOrder) => {
									const orderedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
									const shippedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.shippedQuantity, 0);
									const blockedReason = getShipmentBlockedReason(deliveryOrder);
									const driverName = shipmentForms[deliveryOrder.id]?.driverName ?? "";
									const warehouseName =
										warehouses.find((warehouse) => warehouse.id === deliveryOrder.sourceWarehouseId)?.name ??
										deliveryOrder.sourceWarehouseId;

									return (
										<tr key={deliveryOrder.id}>
											<td className="px-4 py-3 align-top">
												<div className="font-medium text-slate-900">{deliveryOrder.deliveryOrderNumber}</div>
												<div className="text-xs text-slate-500">
													{toUiLabel(deliveryOrder.status, deliveryOrderStatusLabel)} | {dateOnly(deliveryOrder.documentDate)}
												</div>
												<div className="text-xs text-slate-500">
													Terkirim {shippedTotal}/{orderedTotal}
												</div>
											</td>
											<td className="px-4 py-3 align-top text-slate-700">{deliveryOrder.storeNameSnapshot}</td>
											<td className="px-4 py-3 align-top text-slate-700">{warehouseName}</td>
											<td className="px-4 py-3 align-top">
												<input
													className="w-full min-w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm"
													placeholder="Nama driver"
													value={driverName}
													onChange={(event) =>
														setShipmentForms((prev) => ({
															...prev,
															[deliveryOrder.id]: { driverName: event.target.value },
														}))
													}
												/>
												{blockedReason ? (
													<div className="mt-1 text-xs text-amber-700">{blockedReason}</div>
												) : (
													<div className="mt-1 text-xs text-emerald-700">Driver terisi, DO siap dikirim.</div>
												)}
											</td>
											<td className="px-4 py-3 text-right align-top">
												<div className="flex justify-end gap-2">
													<button
														type="button"
														onClick={() => setSelectedDeliveryOrder(deliveryOrder)}
														className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
													>
														Detail
													</button>
													<button
														type="button"
														onClick={() => void handleProcessDeliveryOrder(deliveryOrder)}
														disabled={Boolean(blockedReason) || actionId === deliveryOrder.id}
														className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
													>
														{actionId === deliveryOrder.id ? "Mengirim..." : "Kirim"}
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</section>
			) : null}

			{activeTab === "history" ? (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Riwayat Pengiriman</h2>
							<p className="mt-1 text-sm text-slate-500">
								DO yang sudah diproses kirim dan DO yang sudah diterima toko ditampilkan sebagai riwayat operasional gudang.
							</p>
						</div>
						<select
							value={historyStatusFilter}
							onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 md:w-52"
						>
							<option value="ALL">Semua Status</option>
							<option value="SHIPPED">Sedang Dikirim</option>
							<option value="RECEIVED">Berhasil Diterima</option>
						</select>
					</div>
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Delivery Order</th>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Driver</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Memuat riwayat pengiriman...
									</td>
								</tr>
							) : historyRows.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-600" colSpan={5}>
										Belum ada DO terkirim atau diterima untuk filter ini.
									</td>
								</tr>
							) : (
								historyRows.map((deliveryOrder) => {
									const orderedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
									const shippedTotal = deliveryOrder.items.reduce((sum, item) => sum + item.shippedQuantity, 0);
									const driverName = latestDriverName(deliveryOrder) || "-";
									const statusMeta = getHistoryStatusMeta(deliveryOrder.status);

									return (
										<tr key={deliveryOrder.id}>
											<td className="px-4 py-3 align-top">
												<div className="font-medium text-slate-900">{deliveryOrder.deliveryOrderNumber}</div>
												<div className="text-xs text-slate-500">{dateOnly(deliveryOrder.documentDate)}</div>
												<div className="text-xs text-slate-500">Terkirim {shippedTotal}/{orderedTotal}</div>
											</td>
											<td className="px-4 py-3 align-top text-slate-700">{deliveryOrder.storeNameSnapshot}</td>
											<td className="px-4 py-3 align-top text-slate-700">{driverName}</td>
											<td className="px-4 py-3 align-top">
												<span
													className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur ${statusMeta.className}`}
												>
													{statusMeta.label}
												</span>
											</td>
											<td className="px-4 py-3 text-right align-top">
												<button
													type="button"
													onClick={() => setSelectedDeliveryOrder(deliveryOrder)}
													className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
												>
													Detail
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</section>
			) : null}

			<CreateDeliveryOrderModal
				invoice={createTarget ?? (focusedInvoice && !focusedDeliveryOrder ? focusedInvoice : null)}
				sourceWarehouseId={getSelectedSourceWarehouseId(createTarget ?? focusedInvoice ?? null)}
				sourceWarehouseOptions={
					createTarget
						? eligibleWarehousesByInvoiceId[createTarget.id] ?? []
						: focusedInvoice && !focusedDeliveryOrder
							? eligibleWarehousesByInvoiceId[focusedInvoice.id] ?? []
							: []
				}
				notes={
					createTarget
						? notes[createTarget.id] ?? ""
						: focusedInvoice && !focusedDeliveryOrder
							? notes[focusedInvoice.id] ?? ""
							: ""
				}
				submitting={Boolean(actionId)}
				onSourceWarehouseChange={(value) => {
					const target = createTarget ?? (focusedInvoice && !focusedDeliveryOrder ? focusedInvoice : null);
					if (!target) return;
					setSourceWarehouseSelections((prev) => ({ ...prev, [target.id]: value }));
				}}
				onNotesChange={(value) => {
					const target = createTarget ?? (focusedInvoice && !focusedDeliveryOrder ? focusedInvoice : null);
					if (!target) return;
					setNotes((prev) => ({ ...prev, [target.id]: value }));
				}}
				onClose={() => {
					setCreateTarget(null);
					clearFocusedInvoice();
				}}
				onConfirm={handleCreateDeliveryOrder}
			/>

			<DeliveryOrderDetailModal
				deliveryOrder={selectedDeliveryOrder ?? focusedDeliveryOrder}
				shippingWarehouseName={
					warehouses.find(
						(warehouse) => warehouse.id === (selectedDeliveryOrder ?? focusedDeliveryOrder)?.sourceWarehouseId,
					)?.name ??
					""
				}
				driverName={shipmentForms[(selectedDeliveryOrder ?? focusedDeliveryOrder)?.id ?? ""]?.driverName ?? ""}
				notes={
					selectedDeliveryOrder
						? notes[selectedDeliveryOrder.id] ?? ""
						: focusedDeliveryOrder
							? notes[focusedDeliveryOrder.id] ?? ""
							: ""
				}
				submitting={Boolean(actionId)}
				shipmentItems={
					selectedDeliveryOrder
						? selectedShipmentItems
						: focusedDeliveryOrder
							? buildShipmentItems(focusedDeliveryOrder)
							: []
				}
				shipmentBlockedReason={getShipmentBlockedReason(selectedDeliveryOrder ?? focusedDeliveryOrder)}
				onNotesChange={(value) => {
					const target = selectedDeliveryOrder ?? focusedDeliveryOrder;
					if (!target) return;
					setNotes((prev) => ({ ...prev, [target.id]: value }));
				}}
				onDriverNameChange={(value) => {
					const target = selectedDeliveryOrder ?? focusedDeliveryOrder;
					if (!target) return;
					setShipmentForms((prev) => ({
						...prev,
						[target.id]: {
							driverName: value,
						},
					}));
				}}
				onClose={() => {
					setSelectedDeliveryOrder(null);
					clearFocusedInvoice();
				}}
				onProcess={handleProcessDeliveryOrder}
			/>
		</FeaturePage>
	);
}

export default function PengirimanPage() {
	return (
		<Suspense fallback={<FeaturePage title="Pengiriman" description="Memuat meja kerja gudang..." />}>
			<PengirimanPageContent />
		</Suspense>
	);
}
