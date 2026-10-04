"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback"; import PaginationControls from "@/components/shared/PaginationControls"; import { useDebouncedValue } from "@/hooks/useDebouncedValue"; import { usePagedList } from "@/hooks/usePagedList"; import { getApiErrorMessage } from "@/lib/api-errors"; import { logError } from "@/lib/log"; import { type StockRowView, type StockStatus, stockStatusParam, toStockRowView } from "@/lib/stock-levels";
import { withRunningBalance } from "@/lib/stock-history";
import { type StockAdjustmentRecord, stockAdjustmentsService } from "@/services/stock-adjustments";
import { parseWarehouseReceiptReason } from "@/services/warehouse-receipts";
import { warehouseTransfersService } from "@/services/warehouse-transfers";
import { type StockLevelFilters, type StockLevelSummary, warehouseInventoryService, } from "@/services/warehouse-inventory"; import { type WarehouseListItem, warehousesService } from "@/services/warehouses";

const PAGE_SIZE = 20;

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";
const looksLikeUuid = (value?: string | null) =>
	Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

const visibleSku = (sku?: string | null, fallbackId?: string | null) => {
	if (sku && !looksLikeUuid(sku)) return sku;
	if (fallbackId && !looksLikeUuid(fallbackId)) return fallbackId;
	return "";
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
) => {
	if (receiptMeta) {
		return receiptMeta.note || "-";
	}

	return record.deliveryOrderShipment?.notes || record.reason || "-";
};

/**
 * A return-driven stock receipt records its origin as `Return received: RET-...`.
 * This used to read a JSON marker that stock adjustments never carried, so the
 * "Retur" label and the reference panel below never actually appeared.
 */
const parseReturnStockReason = (reason?: string | null): { returnNumber: string } | null => {
	const match = /^Return received:\s*(\S+)/.exec(String(reason ?? "").trim());
	return match ? { returnNumber: match[1] } : null;
};

const historyStatusLabel = (record: StockAdjustmentRecord) => {
	if (record.type === "OUTBOUND") {
		return "Dikirim";
	}

	if (parseReturnStockReason(record.reason)) {
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

	// One record per side of a warehouse transfer (backend #75).
	if (record.type === "TRANSFER") {
		return record.items.some((item) => item.fromCondition && !item.toCondition) ? "Transfer Keluar" : "Transfer Masuk";
	}

	return record.type;
};

const historyQuantity = (record: StockAdjustmentRecord) =>
	record.items.reduce((sum, item) => sum + item.quantity, 0);

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

const HISTORY_PAGE_SIZE = 5;

function InventoryHistory({ productId, warehouseId, startStock, onSelect }: {
	productId: string;
	warehouseId: string | null;
	startStock: number;
	onSelect: (record: StockAdjustmentRecord) => void;
}) {
	const list = usePagedList(
		(page, limit) =>
			stockAdjustmentsService.list({
				productId,
				warehouseId: warehouseId ?? undefined,
				type: "RECEIPT,OUTBOUND",
				condition: "GOOD",
				sortBy: "transactionDate",
				sortOrder: "desc",
				page,
				limit,
			}),
		{ filterKey: `${productId}|${warehouseId ?? ""}`, errorMessage: "Gagal memuat histori inventaris.", pageSize: HISTORY_PAGE_SIZE },
	);
	const rows = useMemo(
		() => withRunningBalance(list.items, startStock, list.page),
		[list.items, startStock, list.page],
	);
	return (
		<>
			{list.error ? (
				<div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
					<span>{list.error}</span>
					<button type="button" onClick={list.reload} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium">Coba lagi</button>
				</div>
			) : null}
			{list.page > 1 ? (
				<p className="px-4 py-2 text-xs text-slate-500">Saldo berjalan hanya ditampilkan di halaman pertama.</p>
			) : null}
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
						{list.loading && list.items.length === 0 ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Memuat histori...</td></tr>
						) : rows.length === 0 ? (
							list.error ? null : (
								<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Belum ada histori inventaris untuk barang ini.</td></tr>
							)
						) : (
							rows.map(({ row, quantity, stockQuantityAfter }) => (
								<tr key={row.id}>
									<td className="px-4 py-3 text-slate-700">{dateOnly(row.transactionDate)}</td>
									<td className="px-4 py-3 text-slate-700">{row.warehouse?.name ?? "-"}</td>
									<td className="px-4 py-3 text-slate-700">{historyStatusLabel(row)}</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">{stockQuantityAfter ?? "—"}</td>
									<td className={`px-4 py-3 text-right font-semibold ${quantity < 0 ? "text-rose-700" : "text-emerald-700"}`}>
										{formatSignedQuantity(quantity)}
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => onSelect(row)}
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
			</div>
			<PaginationControls
				currentPage={list.page}
				totalPages={list.totalPages}
				totalItems={list.totalItems}
				currentItemCount={rows.length}
				pageSize={HISTORY_PAGE_SIZE}
				itemLabel="histori"
				loading={list.loading}
				onPageChange={list.setPage}
			/>
		</>
	);
}

function TransferHistory({ productId, warehouseId }: { productId: string; warehouseId: string }) {
	const list = usePagedList(
		(page, limit) =>
			warehouseTransfersService.list({ productId, warehouseId, condition: "GOOD", sortBy: "transferDate", sortOrder: "desc", page, limit }),
		{ filterKey: `${productId}|${warehouseId}`, errorMessage: "Gagal memuat histori transfer.", pageSize: HISTORY_PAGE_SIZE },
	);
	const rows = useMemo(
		() =>
			list.items.flatMap((transfer) =>
				transfer.details
					.filter((detail) => detail.productId === productId && isSellableCondition(String(detail.condition ?? "")))
					.map((detail) => {
						const isInbound = transfer.destinationWarehouseId === warehouseId;
						return { transfer, detail, direction: isInbound ? "Masuk" : "Keluar", quantity: isInbound ? detail.quantity : -detail.quantity };
					}),
			),
		[list.items, productId, warehouseId],
	);
	return (
		<>
			{list.error ? (
				<div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
					<span>{list.error}</span>
					<button type="button" onClick={list.reload} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium">Coba lagi</button>
				</div>
			) : null}
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
						{list.loading && list.items.length === 0 ? (
							<tr><td colSpan={7} className="px-4 py-4 text-slate-600">Memuat histori...</td></tr>
						) : rows.length === 0 ? (
							list.error ? null : (
								<tr><td colSpan={7} className="px-4 py-4 text-slate-600">Belum ada histori transfer antar gudang untuk barang ini pada gudang terpilih.</td></tr>
							)
						) : (
							rows.map(({ transfer, detail, direction, quantity }) => (
								<tr key={`${transfer.id}-${detail.id}`}>
									<td className="px-4 py-3 text-slate-700">{dateOnly(transfer.transferDate)}</td>
									<td className="px-4 py-3 text-slate-700">{visibleWarehouseName(transfer.sourceWarehouse?.name)}</td>
									<td className="px-4 py-3 text-center">
										<span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${direction === "Masuk" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
											{direction}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">{visibleWarehouseName(transfer.destinationWarehouse?.name)}</td>
									<td className={`px-4 py-3 text-right font-semibold ${quantity < 0 ? "text-rose-700" : "text-emerald-700"}`}>
										{formatSignedQuantity(quantity)}
									</td>
									<td className="px-4 py-3"><TransferStatusBadge status={transfer.status} /></td>
									<td className="max-w-xs px-4 py-3 text-slate-600"><span className="line-clamp-2">{transfer.notes || "-"}</span></td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<PaginationControls
				currentPage={list.page}
				totalPages={list.totalPages}
				totalItems={list.totalItems}
				currentItemCount={rows.length}
				pageSize={HISTORY_PAGE_SIZE}
				itemLabel="transfer"
				loading={list.loading}
				onPageChange={list.setPage}
			/>
		</>
	);
}

export default function StokGudangPage() {
	const router = useRouter();
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [warehouseError, setWarehouseError] = useState("");
	const [search, setSearch] = useState("");
	const [warehouseId, setWarehouseId] = useState("ALL");
	const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
	const [selectedRow, setSelectedRow] = useState<StockRowView | null>(null);
	const [selectedHistoryWarehouseId, setSelectedHistoryWarehouseId] = useState<string | null>(null);
	const [showGlobalInventoryHistory, setShowGlobalInventoryHistory] = useState(false);
	const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<StockAdjustmentRecord | null>(null);
	const debouncedSearch = useDebouncedValue(search.trim());

	const filters = useMemo<StockLevelFilters>(
		() => ({
			search: debouncedSearch || undefined,
			warehouseId: warehouseId === "ALL" ? undefined : warehouseId,
			stockStatus: stockStatusParam(statusFilter),
		}),
		[debouncedSearch, warehouseId, statusFilter],
	);

	const list = usePagedList<StockRowView>(
		async (page, limit) => {
			const result = await warehouseInventoryService.stockLevels({ ...filters, page, limit });
			return { items: result.items.map(toStockRowView), meta: result.meta };
		},
		{
			filterKey: `${debouncedSearch}|${warehouseId}|${statusFilter}`,
			errorMessage: "Gagal memuat stok gudang.",
			pageSize: PAGE_SIZE,
		},
	);

	const [summary, setSummary] = useState<StockLevelSummary | null>(null);
	const summaryRequest = useRef(0);
	useEffect(() => {
		const id = ++summaryRequest.current;
		warehouseInventoryService
			.stockLevelsSummary(filters)
			.then((next) => { if (id === summaryRequest.current) setSummary(next); })
			.catch((summaryError: unknown) => {
				if (id !== summaryRequest.current) return;
				setSummary(null); // kartu menampilkan "-"
				logError("Gagal memuat ringkasan stok gudang.", summaryError);
			});
		const request = summaryRequest;
		return () => { request.current++; };
	}, [filters]);

	const loadWarehouses = useCallback(() => {
		setWarehouseError("");
		warehousesService
			.listAll()
			.then((items) => setWarehouses([...items].sort((a, b) => a.name.localeCompare(b.name, "id"))))
			.catch((cause: unknown) => setWarehouseError(getApiErrorMessage(cause, "Gagal memuat daftar gudang.")));
	}, []);
	useEffect(() => {
		const timer = window.setTimeout(loadWarehouses, 0);
		return () => window.clearTimeout(timer);
	}, [loadWarehouses]);

	const activeWarehouse = useMemo(
		() => warehouses.find((warehouse) => warehouse.id === warehouseId) ?? null,
		[warehouseId, warehouses],
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

	const selectedHistoryReceiptMeta = useMemo(
		() => parseWarehouseReceiptReason(selectedHistoryRecord?.reason),
		[selectedHistoryRecord],
	);
	const selectedHistoryReturnMeta = useMemo(
		() => parseReturnStockReason(selectedHistoryRecord?.reason),
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
					{ label: "Baris Barang", value: summary?.totalRows ?? "–" },
					{ label: "Qty Siap Jual", value: summary?.totalSellableQuantity ?? "–" },
					{ label: summary ? `Stok Menipis (< ${summary.lowStockThreshold})` : "Stok Menipis", value: summary?.lowStockRows ?? "–" },
					{ label: "Stok Kosong", value: summary?.emptyRows ?? "–" },
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
						maxLength={100}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value as "ALL" | StockStatus)}
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
						onClick={() => setWarehouseId("ALL")}
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
							onClick={() => setWarehouseId(warehouse.id)}
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

			<PageFeedback error={list.error || warehouseError} onRetry={list.error ? list.reload : loadWarehouses} />

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
						{list.loading && list.items.length === 0 ? ( <tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Memuat stok aktif...
								</td>
							</tr>
						) : list.items.length === 0 ? ( list.error ? null : ( <tr> <td colSpan={6} className="px-4 py-4 text-slate-600"> Tidak ada stok aktif yang cocok dengan filter ini. </td> </tr> ) ) : ( list.items.map((row) => (
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
					currentPage={list.page} totalPages={list.totalPages} totalItems={list.totalItems} currentItemCount={list.items.length} pageSize={PAGE_SIZE} itemLabel="barang" loading={list.loading} onPageChange={list.setPage}
				/>
			</section>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => {
					setSelectedRow(null);
					setSelectedHistoryWarehouseId(null);
					setShowGlobalInventoryHistory(false);
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
												setSelectedHistoryRecord(null);
											}}
											className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
										>
											{showGlobalInventoryHistory ? "Tutup" : "Lihat"}
										</button>
									</div>
								</div>
								{showGlobalInventoryHistory ? (
									<InventoryHistory
										key={`${selectedRow.productId}:${activeHistoryWarehouseId ?? "ALL"}`}
										productId={selectedRow.productId}
										warehouseId={activeHistoryWarehouseId}
										startStock={activeHistoryWarehouse?.sellableQuantity ?? selectedRow.sellableQuantity}
										onSelect={setSelectedHistoryRecord}
									/>
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
								<TransferHistory
									key={`${selectedRow.productId}:${activeHistoryWarehouseId}`}
									productId={selectedRow.productId}
									warehouseId={activeHistoryWarehouseId!}
								/>
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
										{selectedHistoryReturnMeta.returnNumber}
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
								{visibleHistoryNote(selectedHistoryRecord, selectedHistoryReceiptMeta)}
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
