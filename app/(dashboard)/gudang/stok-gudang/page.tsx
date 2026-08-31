"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PaginationControls from "@/components/shared/PaginationControls";
import { getApiErrorMessage } from "@/lib/api-errors";
import { type StockAdjustmentRecord, stockAdjustmentsService } from "@/services/stock-adjustments";
import { parseStoreReturnReason } from "@/services/store-returns";
import { parseWarehouseReceiptReason } from "@/services/warehouse-receipts";
import {
	type WarehouseTransferItem,
	warehouseTransfersService,
} from "@/services/warehouse-transfers";
import {
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";
import { type WarehouseListItem } from "@/services/warehouses";

type StockStatus = "Aman" | "Menipis" | "Kosong";

interface SellableStockRow {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	warehouseId: string;
	warehouseName: string;
	categoryName: string;
	brandName: string;
	sellableQuantity: number;
	lastUpdatedAt?: string;
	status: StockStatus;
}

interface AggregatedSellableStockRow {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	categoryName: string;
	brandName: string;
	totalWarehouses: number;
	sellableQuantity: number;
	lastUpdatedAt?: string;
	status: StockStatus;
	warehouseBreakdown: Array<{
		warehouseId: string;
		warehouseName: string;
		sellableQuantity: number;
		lastUpdatedAt?: string;
		status: StockStatus;
	}>;
}

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";
const looksLikeUuid = (value?: string | null) =>
	Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

const visibleSku = (sku?: string | null, fallbackId?: string | null) => {
	if (sku && !looksLikeUuid(sku)) return sku;
	if (fallbackId && !looksLikeUuid(fallbackId)) return fallbackId;
	return "";
};

const stockStatus = (quantity: number): StockStatus => {
	if (quantity <= 0) return "Kosong";
	if (quantity < 25) return "Menipis";
	return "Aman";
};

const stockStatusMeta: Record<StockStatus, { className: string; label: string }> = {
	Aman: {
		label: "Aman",
		className: "border border-emerald-200 bg-emerald-50/80 text-emerald-700",
	},
	Menipis: {
		label: "Menipis",
		className: "border border-amber-200 bg-amber-50/80 text-amber-700",
	},
	Kosong: {
		label: "Kosong",
		className: "border border-rose-200 bg-rose-50/80 text-rose-700",
	},
};

const StockStatusBadge = ({ status }: { status: StockStatus }) => {
	const meta = stockStatusMeta[status];
	return (
		<span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur ${meta.className}`}>
			{meta.label}
		</span>
	);
};

const isSellableCondition = (condition: string) => condition === "GOOD";

const conditionLabel = (condition?: string | null) => {
	if (condition === "DAMAGED" || condition === "DAMAGED") return "Rusak";
	if (condition === "GOOD") return "Bagus";
	return "-";
};

const visibleHistoryNote = (
	record: StockAdjustmentRecord,
	receiptMeta: ReturnType<typeof parseWarehouseReceiptReason>,
	returnMeta: ReturnType<typeof parseStoreReturnReason>,
) => {
	if (returnMeta) {
		return returnMeta.meta.verificationNote || returnMeta.note || "-";
	}

	if (receiptMeta) {
		return receiptMeta.note || "-";
	}

	return record.deliveryOrderShipment?.notes || record.reason || "-";
};

const historyStatusLabel = (record: StockAdjustmentRecord) => {
	if (record.type === "OUTBOUND") {
		return "Dikirim";
	}

	if (parseStoreReturnReason(record.reason)) {
		return "Retur";
	}

	if (parseWarehouseReceiptReason(record.reason)) {
		return "Pasokan Baru";
	}

	if (record.type === "RECEIPT") {
		return "Stok Masuk";
	}

	if (record.type === "DAMAGE") {
		return "Barang Rusak";
	}

	if (record.type === "CORRECTION") {
		return "Koreksi Stok";
	}

	return record.type;
};

const historyQuantity = (record: StockAdjustmentRecord) =>
	record.items.reduce((sum, item) => sum + item.quantity, 0);

const signedInventoryQuantity = (record: StockAdjustmentRecord) => {
	const quantity = historyQuantity(record);
	return record.type === "OUTBOUND" ? -quantity : quantity;
};

const formatSignedQuantity = (quantity: number) => {
	if (quantity > 0) return `+${quantity}`;
	if (quantity < 0) return `-${Math.abs(quantity)}`;
	return "0";
};

const transferStatusMeta: Record<string, { label: string; className: string }> = {
	PENDING: {
		label: "Menunggu",
		className: "border border-amber-200 bg-amber-50/80 text-amber-700",
	},
	IN_TRANSIT: {
		label: "Dalam Transfer",
		className: "border border-sky-200 bg-sky-50/80 text-sky-700",
	},
	COMPLETED: {
		label: "Selesai",
		className: "border border-emerald-200 bg-emerald-50/80 text-emerald-700",
	},
	CANCELLED: {
		label: "Dibatalkan",
		className: "border border-rose-200 bg-rose-50/80 text-rose-700",
	},
};

const TransferStatusBadge = ({ status }: { status: string }) => {
	const meta = transferStatusMeta[status] ?? {
		label: status,
		className: "border border-slate-200 bg-slate-50 text-slate-700",
	};

	return (
		<span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm ${meta.className}`}>
			{meta.label}
		</span>
	);
};

const visibleWarehouseName = (name?: string | null) => name || "-";

export default function StokGudangPage() {
	const router = useRouter();
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [stockHistory, setStockHistory] = useState<StockAdjustmentRecord[]>([]);
	const [warehouseTransfers, setWarehouseTransfers] = useState<WarehouseTransferItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [warehouseId, setWarehouseId] = useState("ALL");
	const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
	const [selectedRow, setSelectedRow] = useState<AggregatedSellableStockRow | null>(null);
	const [selectedHistoryWarehouseId, setSelectedHistoryWarehouseId] = useState<string | null>(null);
	const [showGlobalInventoryHistory, setShowGlobalInventoryHistory] = useState(false);
	const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<StockAdjustmentRecord | null>(null);
	const [page, setPage] = useState(1);
	const [historyPage, setHistoryPage] = useState(1);
	const [transferHistoryPage, setTransferHistoryPage] = useState(1);
	const pageSize = 10;
	const historyPageSize = 5;
	const transferHistoryPageSize = 5;
	const maxHistoryPages = 3;
	const maxTransferHistoryPages = 3;

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [inventoryResult, stockHistoryResult, transferResult] = await Promise.all([
				warehouseInventoryService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
				stockAdjustmentsService.listAll({ sortBy: "transactionDate", sortOrder: "desc" }),
				warehouseTransfersService.listAll({ sortBy: "transferDate", sortOrder: "desc" }),
			]);

			const sellableInventory = inventoryResult.filter((item) => isSellableCondition(item.condition));
			setInventory(sellableInventory);

			// Extract unique warehouses from inventory instead of separate API call
			const warehouseMap = new Map<string, WarehouseListItem>();
			for (const item of inventoryResult) {
				if (item.warehouse && !warehouseMap.has(item.warehouse.id)) {
					warehouseMap.set(item.warehouse.id, item.warehouse);
				}
			}
			setWarehouses(Array.from(warehouseMap.values()).sort((a, b) => a.name.localeCompare(b.name, "id")));

			setStockHistory(
				stockHistoryResult.filter(
					(record) =>
						(record.type === "RECEIPT" || record.type === "OUTBOUND") &&
						record.items.some(
							(item) =>
								isSellableCondition(String(item.condition ?? "")) ||
								isSellableCondition(String(item.fromCondition ?? "")) ||
								isSellableCondition(String(item.toCondition ?? "")),
					),
				),
			);
			setWarehouseTransfers(transferResult);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat stok gudang."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, []);

	const stockRows = useMemo(() => {
		const grouped = new Map<string, SellableStockRow>();

		for (const item of inventory) {
			const key = `${item.warehouseId}:${item.productId}`;
			const current = grouped.get(key) ?? {
				id: key,
				productId: item.productId,
				productName: item.product?.name ?? "Produk",
				productSku: visibleSku(item.product?.sku),
				warehouseId: item.warehouseId,
				warehouseName: item.warehouse?.name ?? "-",
				categoryName: item.product?.category?.name ?? "-",
				brandName: item.product?.brand?.name ?? "-",
				sellableQuantity: 0,
				lastUpdatedAt: item.updatedAt,
				status: "Kosong" as StockStatus,
			};

			current.sellableQuantity += item.quantity;
			current.status = stockStatus(current.sellableQuantity);
			if ((item.updatedAt ?? "") > (current.lastUpdatedAt ?? "")) {
				current.lastUpdatedAt = item.updatedAt;
			}

			grouped.set(key, current);
		}

		return Array.from(grouped.values()).sort((left, right) => {
			const warehouseCompare = left.warehouseName.localeCompare(right.warehouseName, "id");
			if (warehouseCompare !== 0) return warehouseCompare;
			return left.productName.localeCompare(right.productName, "id");
		});
	}, [inventory]);

	const filteredStockRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return stockRows.filter((row) => {
			const matchWarehouse = warehouseId === "ALL" || row.warehouseId === warehouseId;
			const matchStatus = statusFilter === "ALL" || row.status === statusFilter;
			const matchQuery =
				!query ||
				row.productName.toLowerCase().includes(query) ||
				row.productSku.toLowerCase().includes(query) ||
				row.categoryName.toLowerCase().includes(query) ||
				row.brandName.toLowerCase().includes(query) ||
				row.warehouseName.toLowerCase().includes(query);
			return matchWarehouse && matchStatus && matchQuery;
		});
	}, [search, statusFilter, stockRows, warehouseId]);

	const aggregatedStockRows = useMemo(() => {
		const grouped = new Map<string, AggregatedSellableStockRow>();

		for (const row of filteredStockRows) {
			const current = grouped.get(row.productId) ?? {
				id: row.productId,
				productId: row.productId,
				productName: row.productName,
				productSku: row.productSku,
				categoryName: row.categoryName,
				brandName: row.brandName,
				totalWarehouses: 0,
				sellableQuantity: 0,
				lastUpdatedAt: row.lastUpdatedAt,
				status: "Kosong" as StockStatus,
				warehouseBreakdown: [],
			};

			current.totalWarehouses += 1;
			current.sellableQuantity += row.sellableQuantity;
			current.status = stockStatus(current.sellableQuantity);
			if ((row.lastUpdatedAt ?? "") > (current.lastUpdatedAt ?? "")) {
				current.lastUpdatedAt = row.lastUpdatedAt;
			}
			current.warehouseBreakdown.push({
				warehouseId: row.warehouseId,
				warehouseName: row.warehouseName,
				sellableQuantity: row.sellableQuantity,
				lastUpdatedAt: row.lastUpdatedAt,
				status: row.status,
			});
			grouped.set(row.productId, current);
		}

		return Array.from(grouped.values())
			.map((row) => ({
				...row,
				warehouseBreakdown: [...row.warehouseBreakdown].sort((left, right) =>
					left.warehouseName.localeCompare(right.warehouseName, "id"),
				),
			}))
			.sort((left, right) => left.productName.localeCompare(right.productName, "id"));
	}, [filteredStockRows]);

	const filteredStockHistory = useMemo(
		() =>
			stockHistory.filter((row) => {
				const query = search.trim().toLowerCase();
				const matchWarehouse = warehouseId === "ALL" || row.warehouseId === warehouseId;
				const matchQuery =
					!query ||
					(row.product?.name ?? "").toLowerCase().includes(query) ||
					(row.warehouse?.name ?? "").toLowerCase().includes(query) ||
					String(row.reason ?? "").toLowerCase().includes(query);
				return matchWarehouse && matchQuery;
			}),
		[search, stockHistory, warehouseId],
	);

	const activeWarehouse = useMemo(
		() => warehouses.find((warehouse) => warehouse.id === warehouseId) ?? null,
		[warehouseId, warehouses],
	);

	const headlineSummary = useMemo(
		() => ({
			totalRows: aggregatedStockRows.length,
			totalSellableQuantity: aggregatedStockRows.reduce((sum, row) => sum + row.sellableQuantity, 0),
			lowStockRows: aggregatedStockRows.filter((row) => row.status === "Menipis").length,
			emptyRows: aggregatedStockRows.filter((row) => row.status === "Kosong").length,
		}),
		[aggregatedStockRows],
	);

	const selectedHistoryRows = useMemo(
		() =>
			selectedRow
				? filteredStockHistory.filter((row) => row.productId === selectedRow.productId)
				: [],
		[filteredStockHistory, selectedRow],
	);

	const activeHistoryWarehouseId = selectedRow
		? warehouseId === "ALL"
			? selectedHistoryWarehouseId
			: warehouseId
		: null;

	const activeHistoryWarehouse = useMemo(
		() =>
			activeHistoryWarehouseId
				? selectedRow?.warehouseBreakdown.find((row) => row.warehouseId === activeHistoryWarehouseId) ?? null
				: null,
		[activeHistoryWarehouseId, selectedRow],
	);
	const shouldShowTransferHistory = Boolean(selectedRow && warehouseId !== "ALL" && activeHistoryWarehouseId);

	const selectedInventoryHistoryRows = useMemo(() => {
		if (!selectedRow) return [];

		const rows = activeHistoryWarehouseId
			? selectedHistoryRows.filter((row) => row.warehouseId === activeHistoryWarehouseId)
			: selectedHistoryRows;
		let nextStock = activeHistoryWarehouse?.sellableQuantity ?? selectedRow.sellableQuantity;

		return [...rows]
			.sort((left, right) => String(right.transactionDate ?? "").localeCompare(String(left.transactionDate ?? "")))
			.map((row) => {
				const quantity = signedInventoryQuantity(row);
				const stockQuantityAfter = nextStock;
				nextStock -= quantity;
				return {
					row,
					quantity,
					stockQuantityAfter,
				};
			});
	}, [activeHistoryWarehouse, activeHistoryWarehouseId, selectedHistoryRows, selectedRow]);

	const totalHistoryPages = useMemo(
		() =>
			Math.max(
				1,
				Math.min(
					maxHistoryPages,
					Math.ceil(selectedInventoryHistoryRows.length / historyPageSize),
				),
			),
		[selectedInventoryHistoryRows.length],
	);

	const currentHistoryPage = Math.min(historyPage, totalHistoryPages);

	const paginatedInventoryHistoryRows = useMemo(() => {
		const limitedRows = selectedInventoryHistoryRows.slice(0, historyPageSize * maxHistoryPages);
		const startIndex = (currentHistoryPage - 1) * historyPageSize;
		return limitedRows.slice(startIndex, startIndex + historyPageSize);
	}, [currentHistoryPage, selectedInventoryHistoryRows]);

	const historyPageSummary = useMemo(() => {
		const totalVisible = Math.min(selectedInventoryHistoryRows.length, historyPageSize * maxHistoryPages);
		if (totalVisible === 0) {
			return { start: 0, end: 0, totalVisible };
		}
		const start = (currentHistoryPage - 1) * historyPageSize + 1;
		const end = Math.min(currentHistoryPage * historyPageSize, totalVisible);
		return { start, end, totalVisible };
	}, [currentHistoryPage, selectedInventoryHistoryRows.length]);

	const selectedTransferHistoryRows = useMemo(() => {
		if (!selectedRow || !shouldShowTransferHistory || !activeHistoryWarehouseId) return [];

		return warehouseTransfers
			.flatMap((transfer) =>
				transfer.details
					.filter(
						(detail) =>
							detail.productId === selectedRow.productId &&
							isSellableCondition(String(detail.condition ?? "")) &&
							(transfer.sourceWarehouseId === activeHistoryWarehouseId ||
								transfer.destinationWarehouseId === activeHistoryWarehouseId),
					)
					.map((detail) => {
						const isInbound = transfer.destinationWarehouseId === activeHistoryWarehouseId;
						return {
							transfer,
							detail,
							direction: isInbound ? "Masuk" : "Keluar",
							quantity: isInbound ? detail.quantity : -detail.quantity,
						};
					}),
			)
			.sort((left, right) =>
				String(right.transfer.transferDate ?? "").localeCompare(String(left.transfer.transferDate ?? "")),
			);
	}, [activeHistoryWarehouseId, selectedRow, shouldShowTransferHistory, warehouseTransfers]);

	const totalTransferHistoryPages = useMemo(
		() =>
			Math.max(
				1,
				Math.min(
					maxTransferHistoryPages,
					Math.ceil(selectedTransferHistoryRows.length / transferHistoryPageSize),
				),
			),
		[selectedTransferHistoryRows.length],
	);

	const currentTransferHistoryPage = Math.min(transferHistoryPage, totalTransferHistoryPages);

	const paginatedTransferHistoryRows = useMemo(() => {
		const limitedRows = selectedTransferHistoryRows.slice(
			0,
			transferHistoryPageSize * maxTransferHistoryPages,
		);
		const startIndex = (currentTransferHistoryPage - 1) * transferHistoryPageSize;
		return limitedRows.slice(startIndex, startIndex + transferHistoryPageSize);
	}, [currentTransferHistoryPage, selectedTransferHistoryRows]);

	const transferHistoryPageSummary = useMemo(() => {
		const totalVisible = Math.min(
			selectedTransferHistoryRows.length,
			transferHistoryPageSize * maxTransferHistoryPages,
		);
		if (totalVisible === 0) {
			return { start: 0, end: 0, totalVisible };
		}
		const start = (currentTransferHistoryPage - 1) * transferHistoryPageSize + 1;
		const end = Math.min(currentTransferHistoryPage * transferHistoryPageSize, totalVisible);
		return { start, end, totalVisible };
	}, [currentTransferHistoryPage, selectedTransferHistoryRows.length]);

	const totalPages = useMemo(
		() => Math.max(1, Math.ceil(aggregatedStockRows.length / pageSize)),
		[aggregatedStockRows.length, pageSize],
	);

	const currentPage = Math.min(page, totalPages);

	const paginatedStockRows = useMemo(() => {
		const startIndex = (currentPage - 1) * pageSize;
		return aggregatedStockRows.slice(startIndex, startIndex + pageSize);
	}, [aggregatedStockRows, currentPage, pageSize]);

	const selectedHistoryReceiptMeta = useMemo(
		() => parseWarehouseReceiptReason(selectedHistoryRecord?.reason),
		[selectedHistoryRecord],
	);
	const selectedHistoryReturnMeta = useMemo(
		() => parseStoreReturnReason(selectedHistoryRecord?.reason),
		[selectedHistoryRecord],
	);

	const historyDetailActionLabel =
		selectedHistoryRecord?.type === "RECEIPT" ? "Buka Penerimaan Barang" : "Buka Pengiriman";
	const historyDetailHref =
		selectedHistoryRecord?.type === "RECEIPT"
			? `/gudang/penerimaan-barang${
					selectedHistoryReceiptMeta?.meta.batchId
						? `?batchId=${encodeURIComponent(selectedHistoryReceiptMeta.meta.batchId)}`
						: ""
				}`
			: "/gudang/pengiriman";

	const selectedHistoryDetailItems = useMemo(() => {
		if (!selectedHistoryRecord) return [];

		const shipmentItems = selectedHistoryRecord.deliveryOrderShipment?.items ?? [];
		if (selectedHistoryRecord.type === "OUTBOUND" && shipmentItems.length > 0) {
			return shipmentItems.map((item) => ({
					id: item.id,
					productName:
						item.deliveryOrderItem?.product?.name ??
						selectedHistoryRecord.product?.name ??
						"Produk",
					productSku:
						visibleSku(
							item.deliveryOrderItem?.product?.sku,
							selectedHistoryRecord.product?.sku,
						),
					condition: conditionLabel(item.deliveryOrderItem?.condition),
					quantity: item.quantity,
				}));
		}

		return selectedHistoryRecord.items.map((item) => ({
			id: item.id,
			productName: selectedHistoryRecord.product?.name ?? "Produk",
			productSku: visibleSku(selectedHistoryRecord.product?.sku),
			condition: conditionLabel(item.condition ?? item.toCondition ?? item.fromCondition),
			quantity: item.quantity,
		}));
	}, [selectedHistoryRecord]);

	return (
		<FeaturePage
			title="Stok Barang"
			description="Halaman ini fokus pada stok baik yang siap dijual. Barang rusak dan alur lain tetap dipantau pada halaman masing-masing agar pembacaan inventaris gudang tetap bersih."
		>
			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Baris Barang", value: headlineSummary.totalRows },
					{ label: "Qty Siap Jual", value: headlineSummary.totalSellableQuantity },
					{ label: "Stok Menipis", value: headlineSummary.lowStockRows },
					{ label: "Stok Kosong", value: headlineSummary.emptyRows },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
					<input
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari barang, SKU, kategori, brand, atau gudang"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={statusFilter}
						onChange={(event) => {
							setStatusFilter(event.target.value as "ALL" | StockStatus);
							setPage(1);
						}}
					>
						<option value="ALL">Semua Status</option>
						<option value="Aman">Aman</option>
						<option value="Menipis">Menipis</option>
						<option value="Kosong">Kosong</option>
					</select>
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => {
							setWarehouseId("ALL");
							setPage(1);
							setHistoryPage(1);
							setTransferHistoryPage(1);
						}}
						className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
							warehouseId === "ALL"
								? "bg-indigo-600 text-white"
								: "border border-slate-300 text-slate-700 hover:bg-slate-50"
						}`}
					>
						Semua Gudang
					</button>
					{warehouses.map((warehouse) => (
						<button
							key={warehouse.id}
							type="button"
							onClick={() => {
								setWarehouseId(warehouse.id);
								setPage(1);
								setHistoryPage(1);
								setTransferHistoryPage(1);
							}}
							className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
								warehouseId === warehouse.id
									? "bg-indigo-600 text-white"
									: "border border-slate-300 text-slate-700 hover:bg-slate-50"
							}`}
						>
							{warehouse.name}
						</button>
					))}
				</div>
			</section>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">
						{warehouseId === "ALL"
							? "Inventaris Seluruh Gudang"
							: `Inventaris ${activeWarehouse?.name ?? "Gudang"}`}
					</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Barang</th>
							<th className="px-4 py-3">Kategori</th>
							<th className="px-4 py-3">Brand</th>
							<th className="px-4 py-3 text-right">Stok Barang</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Memuat stok aktif...
								</td>
							</tr>
						) : aggregatedStockRows.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Tidak ada stok aktif yang cocok dengan filter ini.
								</td>
							</tr>
						) : (
							paginatedStockRows.map((row) => (
								<tr key={row.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{row.productName}</div>
										{row.productSku ? (
											<div className="text-xs text-slate-500">{row.productSku}</div>
										) : null}
									</td>
									<td className="px-4 py-3 text-slate-700">{row.categoryName}</td>
									<td className="px-4 py-3 text-slate-700">{row.brandName}</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">
										{row.sellableQuantity}
									</td>
									<td className="px-4 py-3">
										<StockStatusBadge status={row.status} />
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => {
												setSelectedRow(row);
												setSelectedHistoryWarehouseId(
													warehouseId === "ALL" ? null : warehouseId,
												);
												setShowGlobalInventoryHistory(false);
												setHistoryPage(1);
												setTransferHistoryPage(1);
											}}
											className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
										>
											Detail
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
				<PaginationControls
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={aggregatedStockRows.length}
					currentItemCount={paginatedStockRows.length}
					pageSize={pageSize}
					itemLabel="barang"
					onPageChange={setPage}
				/>
			</section>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => {
					setSelectedRow(null);
					setSelectedHistoryWarehouseId(null);
					setShowGlobalInventoryHistory(false);
					setHistoryPage(1);
					setTransferHistoryPage(1);
					setSelectedHistoryRecord(null);
				}}
				title={selectedRow ? `Detail Inventaris ${selectedRow.productName}` : "Detail Inventaris"}
				maxWidthClassName="max-w-6xl"
			>
				{selectedRow ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Barang</p>
								<p className="font-semibold text-slate-900">{selectedRow.productName}</p>
								{selectedRow.productSku ? (
									<p className="text-xs text-slate-500">{selectedRow.productSku}</p>
								) : null}
							</div>
							<div>
								<p className="text-xs text-slate-500">Konteks Gudang</p>
								<p className="font-semibold text-slate-900">
									{warehouseId === "ALL" ? "Seluruh Gudang" : activeWarehouse?.name ?? "Gudang"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Stok Barang</p>
								<p className="font-semibold text-slate-900">{selectedRow.sellableQuantity}</p>
							</div>
						</div>

						{warehouseId === "ALL" ? (
							<div className="overflow-hidden rounded-lg border border-slate-200">
								<div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
									<h3 className="font-semibold text-slate-900">Sebaran Inventaris Per Gudang</h3>
									<p className="mt-1 text-xs text-slate-500">
										Tekan salah satu gudang untuk melihat histori inventaris barang pada gudang tersebut.
									</p>
								</div>
								<table className="min-w-full divide-y divide-slate-200">
									<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
										<tr>
											<th className="px-4 py-3">Gudang</th>
											<th className="px-4 py-3 text-right">Stok Barang</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3 text-right">Histori</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{selectedRow.warehouseBreakdown.map((row) => (
											<tr
												key={`${selectedRow.id}-${row.warehouseId}`}
												className={
													selectedHistoryWarehouseId === row.warehouseId
														? "bg-slate-50"
														: undefined
												}
											>
												<td className="px-4 py-3 font-medium text-slate-900">{row.warehouseName}</td>
												<td className="px-4 py-3 text-right font-semibold text-slate-900">
													{row.sellableQuantity}
												</td>
												<td className="px-4 py-3">
													<StockStatusBadge status={row.status} />
												</td>
												<td className="px-4 py-3 text-right">
													<button
														type="button"
														onClick={() => {
															setSelectedHistoryWarehouseId(row.warehouseId);
															setShowGlobalInventoryHistory(true);
															setHistoryPage(1);
															setTransferHistoryPage(1);
															setSelectedHistoryRecord(null);
														}}
														className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
													>
														{selectedHistoryWarehouseId === row.warehouseId && showGlobalInventoryHistory
															? "Terpilih"
															: "Lihat"}
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}

						{warehouseId === "ALL" ? (
							<div className="overflow-hidden rounded-lg border border-slate-200">
								<div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-start md:justify-between">
									<div>
										<h3 className="font-semibold text-slate-900">Histori Inventaris</h3>
										<p className="mt-1 text-xs text-slate-500">
											{activeHistoryWarehouse
												? `Menampilkan barang masuk dan barang keluar untuk ${activeHistoryWarehouse.warehouseName}.`
												: "Menampilkan barang masuk dan barang keluar untuk seluruh gudang."}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										{activeHistoryWarehouse ? (
											<button
												type="button"
												onClick={() => {
													setSelectedHistoryWarehouseId(null);
													setHistoryPage(1);
													setTransferHistoryPage(1);
													setSelectedHistoryRecord(null);
												}}
												className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
											>
												Semua Gudang
											</button>
										) : null}
										<button
											type="button"
											onClick={() => {
												setShowGlobalInventoryHistory((current) => !current);
												setHistoryPage(1);
												setSelectedHistoryRecord(null);
											}}
											className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
										>
											{showGlobalInventoryHistory ? "Tutup" : "Lihat"}
										</button>
									</div>
								</div>
								{showGlobalInventoryHistory ? (
									<>
								<div className="overflow-x-auto">
									<table className="min-w-full divide-y divide-slate-200">
										<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
											<tr>
												<th className="px-4 py-3">Tanggal</th>
												<th className="px-4 py-3">Gudang</th>
												<th className="px-4 py-3">Aktivitas</th>
												<th className="px-4 py-3 text-right">Stok Barang</th>
												<th className="px-4 py-3 text-right">Qty</th>
												<th className="px-4 py-3 text-right">Aksi</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100">
											{selectedInventoryHistoryRows.length === 0 ? (
												<tr>
													<td colSpan={6} className="px-4 py-4 text-slate-600">
														Belum ada histori inventaris untuk barang ini
														{activeHistoryWarehouse ? ` pada ${activeHistoryWarehouse.warehouseName}` : ""}.
													</td>
												</tr>
											) : (
												paginatedInventoryHistoryRows.map(({ row, quantity, stockQuantityAfter }) => {
													return (
														<tr key={row.id}>
															<td className="px-4 py-3 text-slate-700">{dateOnly(row.transactionDate)}</td>
															<td className="px-4 py-3 text-slate-700">
																{row.warehouse?.name ?? "-"}
															</td>
															<td className="px-4 py-3 text-slate-700">{historyStatusLabel(row)}</td>
															<td className="px-4 py-3 text-right font-semibold text-slate-900">
																{stockQuantityAfter}
															</td>
															<td
																className={`px-4 py-3 text-right font-semibold ${
																	quantity < 0 ? "text-rose-700" : "text-emerald-700"
																}`}
															>
																{formatSignedQuantity(quantity)}
															</td>
															<td className="px-4 py-3 text-right">
																<button
																	type="button"
																	onClick={() => setSelectedHistoryRecord(row)}
																	className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
								</div>
								{selectedInventoryHistoryRows.length > 0 ? (
									<PaginationControls
										currentPage={currentHistoryPage}
										totalPages={totalHistoryPages}
										totalItems={historyPageSummary.totalVisible}
										currentItemCount={paginatedInventoryHistoryRows.length}
										pageSize={historyPageSize}
										itemLabel="histori"
										onPageChange={setHistoryPage}
									/>
								) : null}
									</>
								) : null}
							</div>
						) : null}

						{shouldShowTransferHistory ? (
							<div className="overflow-hidden rounded-lg border border-slate-200">
								<div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
									<h3 className="font-semibold text-slate-900">Histori Transfer Antar Gudang</h3>
									<p className="mt-1 text-xs text-slate-500">
										Menampilkan transfer barang untuk{" "}
										{activeHistoryWarehouse?.warehouseName ?? activeWarehouse?.name ?? "gudang terpilih"}.
									</p>
								</div>
								<div className="overflow-x-auto">
									<table className="min-w-full divide-y divide-slate-200">
										<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
											<tr>
												<th className="px-4 py-3">Tanggal</th>
												<th className="px-4 py-3">Gudang Asal</th>
												<th className="px-4 py-3 text-center">Arah</th>
												<th className="px-4 py-3">Gudang Tujuan</th>
												<th className="px-4 py-3 text-right">Qty</th>
												<th className="px-4 py-3">Status</th>
												<th className="px-4 py-3">Catatan</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100">
											{selectedTransferHistoryRows.length === 0 ? (
												<tr>
													<td colSpan={7} className="px-4 py-4 text-slate-600">
														Belum ada histori transfer antar gudang untuk barang ini pada gudang terpilih.
													</td>
												</tr>
											) : (
												paginatedTransferHistoryRows.map(({ transfer, detail, direction, quantity }) => (
													<tr key={`${transfer.id}-${detail.id}`}>
														<td className="px-4 py-3 text-slate-700">{dateOnly(transfer.transferDate)}</td>
														<td className="px-4 py-3 text-slate-700">
															{visibleWarehouseName(transfer.sourceWarehouse?.name)}
														</td>
														<td className="px-4 py-3 text-center">
															<span
																className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
																	direction === "Masuk"
																		? "bg-emerald-50 text-emerald-700"
																		: "bg-rose-50 text-rose-700"
																}`}
															>
																{direction}
															</span>
														</td>
														<td className="px-4 py-3 text-slate-700">
															{visibleWarehouseName(transfer.destinationWarehouse?.name)}
														</td>
														<td
															className={`px-4 py-3 text-right font-semibold ${
																quantity < 0 ? "text-rose-700" : "text-emerald-700"
															}`}
														>
															{formatSignedQuantity(quantity)}
														</td>
														<td className="px-4 py-3">
															<TransferStatusBadge status={transfer.status} />
														</td>
														<td className="max-w-xs px-4 py-3 text-slate-600">
															<span className="line-clamp-2">{transfer.notes || "-"}</span>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
								{selectedTransferHistoryRows.length > 0 ? (
									<PaginationControls
										currentPage={currentTransferHistoryPage}
										totalPages={totalTransferHistoryPages}
										totalItems={transferHistoryPageSummary.totalVisible}
										currentItemCount={paginatedTransferHistoryRows.length}
										pageSize={transferHistoryPageSize}
										itemLabel="transfer"
										onPageChange={setTransferHistoryPage}
									/>
								) : null}
							</div>
						) : null}

					</div>
				) : null}
			</Modal>

			<Modal
				isOpen={Boolean(selectedHistoryRecord)}
				onClose={() => setSelectedHistoryRecord(null)}
				title={selectedHistoryRecord ? `Detail Status ${historyStatusLabel(selectedHistoryRecord)}` : "Detail Status"}
			>
				{selectedHistoryRecord ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Barang</p>
								<p className="font-semibold text-slate-900">
									{selectedHistoryRecord.product?.name ?? "Produk"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Gudang</p>
								<p className="font-semibold text-slate-900">
									{selectedHistoryRecord.warehouse?.name ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status</p>
								<p className="font-semibold text-slate-900">{historyStatusLabel(selectedHistoryRecord)}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Qty</p>
								<p className="font-semibold text-slate-900">{historyQuantity(selectedHistoryRecord)}</p>
							</div>
						</div>

						{selectedHistoryReturnMeta ? (
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Referensi Retur</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryReturnMeta.meta.requestNumber}
									</p>
								</div>
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Toko</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryReturnMeta.meta.storeName}
									</p>
								</div>
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Order</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryReturnMeta.meta.orderNumber}
									</p>
								</div>
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Status Retur</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryReturnMeta.meta.status}
									</p>
								</div>
							</div>
						) : selectedHistoryRecord.type === "RECEIPT" ? (
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Referensi Penerimaan</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryReceiptMeta?.meta.referenceNumber ?? "-"}
									</p>
								</div>
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Supplier</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryReceiptMeta?.meta.supplier ?? "-"}
									</p>
								</div>
							</div>
						) : (
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Nomor DO</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryRecord.deliveryOrderShipment?.deliveryOrder?.deliveryOrderNumber ?? "-"}
									</p>
								</div>
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Toko Tujuan</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryRecord.deliveryOrderShipment?.deliveryOrder?.storeNameSnapshot ?? "-"}
									</p>
								</div>
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Driver</p>
									<p className="mt-1 font-semibold text-slate-900">
										{selectedHistoryRecord.deliveryOrderShipment?.driverName ?? "-"}
									</p>
								</div>
								<div className="rounded-lg border border-slate-200 p-4">
									<p className="text-xs text-slate-500">Tanggal Kirim</p>
									<p className="mt-1 font-semibold text-slate-900">
										{dateOnly(selectedHistoryRecord.deliveryOrderShipment?.shippedAt)}
									</p>
								</div>
							</div>
						)}

						<div className="overflow-hidden rounded-lg border border-slate-200">
							<div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
								<h3 className="font-semibold text-slate-900">Detail Barang</h3>
								<p className="mt-1 text-xs text-slate-500">
									{selectedHistoryRecord.type === "OUTBOUND"
										? `Qty pada histori mengacu ke barang "${selectedHistoryRecord.product?.name ?? "Produk"}". Detail di bawah menampilkan semua barang dalam pengiriman/invoice yang sama.`
										: "Detail di bawah menampilkan barang pada transaksi stok yang dipilih."}
								</p>
							</div>
							<table className="min-w-full divide-y divide-slate-200">
								<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-4 py-3">Barang</th>
										<th className="px-4 py-3 text-right">Qty</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{selectedHistoryDetailItems.map((item) => (
										<tr
											key={item.id}
											className={
												selectedHistoryRecord.type === "OUTBOUND" &&
												item.productName === (selectedHistoryRecord.product?.name ?? "Produk")
													? "bg-indigo-50/60"
													: undefined
											}
										>
											<td className="px-4 py-3">
												<div className="flex flex-wrap items-center gap-2">
													<span className="font-medium text-slate-900">{item.productName}</span>
													{selectedHistoryRecord.type === "OUTBOUND" &&
													item.productName === (selectedHistoryRecord.product?.name ?? "Produk") ? (
														<span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
															Barang histori
														</span>
													) : null}
												</div>
												{item.productSku ? (
													<div className="text-xs text-slate-500">{item.productSku}</div>
												) : null}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-slate-900">
												{item.quantity}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="rounded-lg border border-slate-200 p-4">
							<p className="text-xs text-slate-500">Catatan</p>
							<p className="mt-1 text-slate-700">
								{visibleHistoryNote(
									selectedHistoryRecord,
									selectedHistoryReceiptMeta,
									selectedHistoryReturnMeta,
								)}
							</p>
						</div>

						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => router.push(historyDetailHref)}
								className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
							>
								{historyDetailActionLabel}
							</button>
						</div>
					</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
