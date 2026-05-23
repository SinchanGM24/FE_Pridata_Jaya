"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { toUiLabel, transferStatusLabel } from "@/lib/ui-labels";
import { type StockAdjustmentRecord, stockAdjustmentsService } from "@/services/stock-adjustments";
import { parseWarehouseReceiptReason } from "@/services/warehouse-receipts";
import {
	type WarehouseTransferItem,
	warehouseTransfersService,
} from "@/services/warehouse-transfers";
import {
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

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

const stockStatus = (quantity: number): StockStatus => {
	if (quantity <= 0) return "Kosong";
	if (quantity < 25) return "Menipis";
	return "Aman";
};

const isSellableCondition = (condition: string) => condition === "GOOD";

const conditionLabel = (condition?: string | null) => {
	if (condition === "DAMAGED" || condition === "DAMAGED") return "Rusak";
	if (condition === "GOOD") return "Bagus";
	return "-";
};

const historyDirectionLabel = (record: StockAdjustmentRecord) =>
	record.type === "RECEIPT" ? "Tambah" : "Kurang";

const historyQuantity = (record: StockAdjustmentRecord) =>
	record.items.reduce((sum, item) => sum + item.quantity, 0);

export default function StokGudangPage() {
	const router = useRouter();
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [stockHistory, setStockHistory] = useState<StockAdjustmentRecord[]>([]);
	const [transferHistory, setTransferHistory] = useState<WarehouseTransferItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [warehouseId, setWarehouseId] = useState("ALL");
	const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
	const [selectedRow, setSelectedRow] = useState<AggregatedSellableStockRow | null>(null);
	const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<StockAdjustmentRecord | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [inventoryResult, warehouseResult, stockHistoryResult, transferHistoryResult] = await Promise.all([
				warehouseInventoryService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
				warehousesService.listAll(),
				stockAdjustmentsService.listAll({ sortBy: "transactionDate", sortOrder: "desc" }),
				warehouseTransfersService.listAll({ sortBy: "transferDate", sortOrder: "desc" }),
			]);

			setInventory(inventoryResult.filter((item) => isSellableCondition(item.condition)));
			setWarehouses(warehouseResult);
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
			setTransferHistory(transferHistoryResult);
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
				productName: item.product?.name ?? item.productId,
				productSku: item.product?.sku ?? "-",
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
					(row.product?.name ?? row.productId).toLowerCase().includes(query) ||
					(row.warehouse?.name ?? row.warehouseId).toLowerCase().includes(query) ||
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

	const selectedTransferRows = useMemo(
		() =>
			selectedRow
				? transferHistory.filter(
						(row) =>
							row.details.some((detail) => detail.productId === selectedRow.productId) &&
							(warehouseId === "ALL" ||
								row.sourceWarehouseId === warehouseId ||
								row.destinationWarehouseId === warehouseId),
					)
				: [],
		[selectedRow, transferHistory, warehouseId],
	);

	const selectedWarehouseMovementRows = useMemo(() => {
		if (!selectedRow || warehouseId === "ALL") {
			return [];
		}

		const inventoryEntries = selectedHistoryRows.map((row) => ({
			id: `history:${row.id}`,
			date: row.transactionDate,
			typeLabel: row.type === "RECEIPT" ? "Penerimaan" : "Pengiriman",
			fromLabel:
				row.type === "RECEIPT"
					? parseWarehouseReceiptReason(row.reason)?.meta.supplier ?? "Supplier / sumber masuk"
					: activeWarehouse?.name ?? row.warehouse?.name ?? row.warehouseId,
			toLabel:
				row.type === "RECEIPT"
					? activeWarehouse?.name ?? row.warehouse?.name ?? row.warehouseId
					: row.deliveryOrderShipment?.deliveryOrder?.storeNameSnapshot ??
						row.deliveryOrderShipment?.deliveryOrder?.deliveryOrderNumber ??
						"Toko tujuan",
			statusLabel: row.type === "RECEIPT" ? "Masuk" : "Keluar",
			quantity: historyQuantity(row),
			source: "inventory" as const,
			record: row,
		}));

		const transferEntries = selectedTransferRows.map((row) => {
			const matchedDetail = row.details.find((detail) => detail.productId === selectedRow.productId);
			return {
				id: `transfer:${row.id}`,
				date: row.transferDate,
				typeLabel: "Transfer Gudang",
				fromLabel: row.sourceWarehouse?.name ?? row.sourceWarehouseId,
				toLabel: row.destinationWarehouse?.name ?? row.destinationWarehouseId,
				statusLabel: toUiLabel(row.status, transferStatusLabel),
				quantity: matchedDetail?.quantity ?? 0,
				source: "transfer" as const,
				record: row,
			};
		});

		return [...inventoryEntries, ...transferEntries].sort((left, right) =>
			String(right.date ?? "").localeCompare(String(left.date ?? "")),
		);
	}, [activeWarehouse, selectedHistoryRows, selectedRow, selectedTransferRows, warehouseId]);

	const totalPages = useMemo(
		() => Math.max(1, Math.ceil(aggregatedStockRows.length / pageSize)),
		[aggregatedStockRows.length, pageSize],
	);

	const currentPage = Math.min(page, totalPages);

	const paginatedStockRows = useMemo(() => {
		const startIndex = (currentPage - 1) * pageSize;
		return aggregatedStockRows.slice(startIndex, startIndex + pageSize);
	}, [aggregatedStockRows, currentPage, pageSize]);

	const pageSummary = useMemo(() => {
		if (aggregatedStockRows.length === 0) {
			return { start: 0, end: 0 };
		}
		const start = (currentPage - 1) * pageSize + 1;
		const end = Math.min(currentPage * pageSize, aggregatedStockRows.length);
		return { start, end };
	}, [aggregatedStockRows.length, currentPage, pageSize]);

	const selectedHistoryReceiptMeta = useMemo(
		() => parseWarehouseReceiptReason(selectedHistoryRecord?.reason),
		[selectedHistoryRecord],
	);

	const historyDetailActionLabel =
		selectedHistoryRecord?.type === "RECEIPT" ? "Buka Penerimaan Barang" : "Buka Pengiriman";

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
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
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
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={String(pageSize)}
						onChange={(event) => {
							setPageSize(Number(event.target.value));
							setPage(1);
						}}
					>
						<option value="25">25 baris per halaman</option>
						<option value="50">50 baris per halaman</option>
						<option value="100">100 baris per halaman</option>
					</select>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 lg:justify-self-end"
					>
						Refresh
					</button>
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => {
							setWarehouseId("ALL");
							setPage(1);
						}}
						className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
							warehouseId === "ALL"
								? "bg-slate-900 text-white"
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
							}}
							className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
								warehouseId === warehouse.id
									? "bg-slate-900 text-white"
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
							<th className="px-4 py-3 text-right">
								{warehouseId === "ALL" ? "Cakupan Gudang" : "Gudang Aktif"}
							</th>
							<th className="px-4 py-3 text-right">Stok Bagus</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Update</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={8} className="px-4 py-4 text-slate-600">
									Memuat stok aktif...
								</td>
							</tr>
						) : aggregatedStockRows.length === 0 ? (
							<tr>
								<td colSpan={8} className="px-4 py-4 text-slate-600">
									Tidak ada stok aktif yang cocok dengan filter ini.
								</td>
							</tr>
						) : (
							paginatedStockRows.map((row) => (
								<tr key={row.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{row.productName}</div>
										<div className="text-xs text-slate-500">{row.productSku}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{row.categoryName}</td>
									<td className="px-4 py-3 text-slate-700">{row.brandName}</td>
									<td className="px-4 py-3 text-right text-slate-700">
										{warehouseId === "ALL" ? row.totalWarehouses : activeWarehouse?.name ?? "1"}
									</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">
										{row.sellableQuantity}
									</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
											{row.status}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(row.lastUpdatedAt)}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => setSelectedRow(row)}
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
				<div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
					<p>
						Menampilkan {pageSummary.start}-{pageSummary.end} dari {aggregatedStockRows.length} barang.
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setPage((current) => Math.max(1, current - 1))}
							disabled={currentPage <= 1}
							className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
							Halaman {currentPage} / {totalPages}
						</span>
						<button
							type="button"
							onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
							disabled={currentPage >= totalPages}
							className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</section>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => {
					setSelectedRow(null);
					setSelectedHistoryRecord(null);
				}}
				title={selectedRow ? `Detail Inventaris ${selectedRow.productName}` : "Detail Inventaris"}
			>
				{selectedRow ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Barang</p>
								<p className="font-semibold text-slate-900">{selectedRow.productName}</p>
								<p className="text-xs text-slate-500">{selectedRow.productSku}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Konteks Gudang</p>
								<p className="font-semibold text-slate-900">
									{warehouseId === "ALL" ? "Seluruh Gudang" : activeWarehouse?.name ?? "Gudang"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Stok Bagus</p>
								<p className="font-semibold text-slate-900">{selectedRow.sellableQuantity}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Update Terakhir</p>
								<p className="font-semibold text-slate-900">{dateOnly(selectedRow.lastUpdatedAt)}</p>
							</div>
						</div>

						{warehouseId === "ALL" ? (
							<div className="overflow-hidden rounded-lg border border-slate-200">
								<div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
									<h3 className="font-semibold text-slate-900">Sebaran Inventaris Per Gudang</h3>
								</div>
								<table className="min-w-full divide-y divide-slate-200">
									<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
										<tr>
											<th className="px-4 py-3">Gudang</th>
											<th className="px-4 py-3 text-right">Stok Bagus</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3">Update</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{selectedRow.warehouseBreakdown.map((row) => (
											<tr key={`${selectedRow.id}-${row.warehouseId}`}>
												<td className="px-4 py-3 font-medium text-slate-900">{row.warehouseName}</td>
												<td className="px-4 py-3 text-right font-semibold text-slate-900">
													{row.sellableQuantity}
												</td>
												<td className="px-4 py-3 text-slate-700">{row.status}</td>
												<td className="px-4 py-3 text-slate-700">{dateOnly(row.lastUpdatedAt)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}

						<div className="overflow-hidden rounded-lg border border-slate-200">
							<div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
								<h3 className="font-semibold text-slate-900">
									{warehouseId === "ALL" ? "Histori Inventaris" : "Histori Pergerakan Barang"}
								</h3>
							</div>
							<table className="min-w-full divide-y divide-slate-200">
								<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-4 py-3">Tanggal</th>
										{warehouseId === "ALL" ? <th className="px-4 py-3">Gudang</th> : null}
										<th className="px-4 py-3">Histori</th>
										{warehouseId !== "ALL" ? (
											<>
												<th className="px-4 py-3">Dari</th>
												<th className="px-4 py-3">Ke</th>
												<th className="px-4 py-3">Status</th>
											</>
										) : null}
										<th className="px-4 py-3 text-right">Qty</th>
										<th className="px-4 py-3 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{warehouseId === "ALL" ? (
										selectedHistoryRows.length === 0 ? (
											<tr>
												<td colSpan={5} className="px-4 py-4 text-slate-600">
													Belum ada histori inventaris untuk barang ini.
												</td>
											</tr>
										) : (
											selectedHistoryRows.map((row) => (
												<tr key={row.id}>
													<td className="px-4 py-3 text-slate-700">{dateOnly(row.transactionDate)}</td>
													<td className="px-4 py-3 text-slate-700">
														{row.warehouse?.name ?? row.warehouseId}
													</td>
													<td className="px-4 py-3 text-slate-700">{historyDirectionLabel(row)}</td>
													<td className="px-4 py-3 text-right font-semibold text-slate-900">
														{historyQuantity(row)}
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
											))
										)
									) : selectedWarehouseMovementRows.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-4 py-4 text-slate-600">
												Belum ada histori pergerakan untuk barang ini pada gudang ini.
											</td>
										</tr>
									) : (
										selectedWarehouseMovementRows.map((row) => (
											<tr key={row.id}>
												<td className="px-4 py-3 text-slate-700">{dateOnly(row.date)}</td>
												<td className="px-4 py-3 text-slate-700">{row.typeLabel}</td>
												<td className="px-4 py-3 text-slate-700">{row.fromLabel}</td>
												<td className="px-4 py-3 text-slate-700">{row.toLabel}</td>
												<td className="px-4 py-3 text-slate-700">{row.statusLabel}</td>
												<td className="px-4 py-3 text-right font-semibold text-slate-900">
													{row.quantity}
												</td>
												<td className="px-4 py-3 text-right">
													{row.source === "inventory" ? (
														<button
															type="button"
															onClick={() => setSelectedHistoryRecord(row.record)}
															className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
														>
															Detail
														</button>
													) : (
														<button
															type="button"
															onClick={() => router.push("/gudang/transfer-gudang")}
															className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
														>
															Buka Transfer
														</button>
													)}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
			</Modal>

			<Modal
				isOpen={Boolean(selectedHistoryRecord)}
				onClose={() => setSelectedHistoryRecord(null)}
				title={selectedHistoryRecord ? `Detail Histori ${historyDirectionLabel(selectedHistoryRecord)}` : "Detail Histori"}
			>
				{selectedHistoryRecord ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Barang</p>
								<p className="font-semibold text-slate-900">
									{selectedHistoryRecord.product?.name ?? selectedHistoryRecord.productId}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Gudang</p>
								<p className="font-semibold text-slate-900">
									{selectedHistoryRecord.warehouse?.name ?? selectedHistoryRecord.warehouseId}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Histori</p>
								<p className="font-semibold text-slate-900">{historyDirectionLabel(selectedHistoryRecord)}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Qty</p>
								<p className="font-semibold text-slate-900">{historyQuantity(selectedHistoryRecord)}</p>
							</div>
						</div>

						{selectedHistoryRecord.type === "RECEIPT" ? (
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
								<h3 className="font-semibold text-slate-900">Detail Kondisi Barang</h3>
							</div>
							<table className="min-w-full divide-y divide-slate-200">
								<thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-4 py-3">Kondisi</th>
										<th className="px-4 py-3 text-right">Qty</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{selectedHistoryRecord.items.map((item) => (
										<tr key={item.id}>
											<td className="px-4 py-3 text-slate-700">
												{conditionLabel(item.condition ?? item.toCondition ?? item.fromCondition)}
											</td>
											<td className="px-4 py-3 text-right font-semibold text-slate-900">{item.quantity}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="rounded-lg border border-slate-200 p-4">
							<p className="text-xs text-slate-500">Catatan</p>
							<p className="mt-1 text-slate-700">
								{selectedHistoryRecord.type === "RECEIPT"
									? selectedHistoryReceiptMeta?.note || selectedHistoryRecord.reason || "-"
									: selectedHistoryRecord.deliveryOrderShipment?.notes ||
										selectedHistoryRecord.reason ||
										"-"}
							</p>
						</div>

						<div className="flex justify-end">
							<button
								type="button"
								onClick={() =>
									router.push(
										selectedHistoryRecord.type === "RECEIPT"
											? "/gudang/penerimaan-barang"
											: "/gudang/pengiriman",
									)
								}
								className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
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
