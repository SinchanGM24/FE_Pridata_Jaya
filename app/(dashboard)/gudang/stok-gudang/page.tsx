"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";
import { type StockAdjustmentRecord, stockAdjustmentsService } from "@/services/stock-adjustments";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

type StockStatus = "Tersedia" | "Hampir Habis" | "Habis";

interface DisplayStockRow {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	warehouseId: string;
	warehouseName: string;
	quantity: number;
	status: StockStatus;
	categoryName: string;
	conditionSummary: string;
}

const stockStatus = (quantity: number): StockStatus => {
	if (quantity <= 0) return "Habis";
	if (quantity < 25) return "Hampir Habis";
	return "Tersedia";
};

const formatDate = (value?: string | null) => String(value || "").slice(0, 10) || "-";

export default function StokGudangPage() {
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [warehouseId, setWarehouseId] = useState("ALL");
	const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
	const [selectedRow, setSelectedRow] = useState<DisplayStockRow | null>(null);
	const [historyRows, setHistoryRows] = useState<StockAdjustmentRecord[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyError, setHistoryError] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [inventoryResult, warehouseResult] = await Promise.all([
				warehouseInventoryService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
				warehousesService.listAll(),
			]);
			setInventory(inventoryResult);
			setWarehouses(warehouseResult);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat stok barang."));
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

	const rows = useMemo(() => {
		const sortRows = (items: DisplayStockRow[]) =>
			[...items].sort((left, right) => {
				const bySku = left.productSku.localeCompare(right.productSku);
				if (bySku !== 0) {
					return bySku;
				}
				return left.productName.localeCompare(right.productName);
			});

		if (warehouseId === "ALL") {
			const grouped = new Map<string, DisplayStockRow>();
			for (const item of inventory) {
				const key = item.productId;
				const existing = grouped.get(key);
				if (!existing) {
					grouped.set(key, {
						id: `all-${item.productId}`,
						productId: item.productId,
						productName: item.product?.name ?? item.productId,
						productSku: item.product?.sku ?? "-",
						warehouseId: "ALL",
						warehouseName: "Semua Gudang",
						quantity: item.quantity,
						status: stockStatus(item.quantity),
						categoryName: item.product?.category?.name ?? "-",
						conditionSummary: `${item.condition}:${item.quantity}`,
					});
					continue;
				}

				existing.quantity += item.quantity;
				existing.status = stockStatus(existing.quantity);
				existing.conditionSummary = `${existing.conditionSummary}, ${item.condition}:${item.quantity}`;
			}

			return sortRows(Array.from(grouped.values()));
		}

		return sortRows(
			inventory
				.filter((item) => item.warehouseId === warehouseId)
				.map((item) => ({
					id: item.id,
					productId: item.productId,
					productName: item.product?.name ?? item.productId,
					productSku: item.product?.sku ?? "-",
					warehouseId: item.warehouseId,
					warehouseName: item.warehouse?.name ?? "-",
					quantity: item.quantity,
					status: stockStatus(item.quantity),
					categoryName: item.product?.category?.name ?? "-",
					conditionSummary: `${item.condition}:${item.quantity}`,
				})),
		);
	}, [inventory, warehouseId]);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		return rows.filter((row) => {
			const matchQuery =
				!query ||
				row.productName.toLowerCase().includes(query) ||
				row.productSku.toLowerCase().includes(query) ||
				row.categoryName.toLowerCase().includes(query);
			const matchStatus = statusFilter === "ALL" || row.status === statusFilter;
			return matchQuery && matchStatus;
		});
	}, [rows, search, statusFilter]);

	const summary = useMemo(
		() => ({
			totalRows: filteredRows.length,
			totalQuantity: filteredRows.reduce((sum, row) => sum + row.quantity, 0),
			lowStock: filteredRows.filter((row) => row.status === "Hampir Habis").length,
			outOfStock: filteredRows.filter((row) => row.status === "Habis").length,
		}),
		[filteredRows],
	);

	const openHistory = async (row: DisplayStockRow) => {
		setSelectedRow(row);
		setHistoryRows([]);
		setHistoryError("");
		setHistoryLoading(true);
		try {
			const items = await stockAdjustmentsService.listAll({
				productId: row.productId,
				warehouseId: row.warehouseId === "ALL" ? undefined : row.warehouseId,
				sortBy: "transactionDate",
				sortOrder: "desc",
			});
			setHistoryRows(items);
		} catch (loadError: unknown) {
			setHistoryError(getApiErrorMessage(loadError, "Gagal memuat histori stok."));
		} finally {
			setHistoryLoading(false);
		}
	};

	return (
		<FeaturePage
			title="Stok Barang"
			description="Pola FE2 ini disederhanakan mengikuti FE1: halaman utama fokus ke stok aktif, sementara histori barang baru diambil saat dibuka agar pemanggilan data lebih hemat."
		>
			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Baris Stok", value: summary.totalRows },
					{ label: "Total Quantity", value: summary.totalQuantity },
					{ label: "Hampir Habis", value: summary.lowStock },
					{ label: "Habis", value: summary.outOfStock },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
					<input
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Cari kode, barang, kategori"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={warehouseId}
						onChange={(event) => setWarehouseId(event.target.value)}
					>
						<option value="ALL">Semua Gudang</option>
						{warehouses.map((warehouse) => (
							<option key={warehouse.id} value={warehouse.id}>
								{warehouse.name}
							</option>
						))}
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value as "ALL" | StockStatus)}
					>
						<option value="ALL">Semua Status</option>
						<option value="Tersedia">Tersedia</option>
						<option value="Hampir Habis">Hampir Habis</option>
						<option value="Habis">Habis</option>
					</select>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</section>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Barang</th>
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3">Kategori</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3 text-right">Qty</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Memuat stok barang...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Tidak ada stok yang cocok dengan filter saat ini.
								</td>
							</tr>
						) : (
							filteredRows.map((row) => (
								<tr key={row.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{row.productName}</div>
										<div className="text-xs text-slate-500">{row.productSku}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{row.warehouseName}</td>
									<td className="px-4 py-3 text-slate-700">{row.categoryName}</td>
									<td className="px-4 py-3">
										<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
											{row.status}
										</span>
									</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">{row.quantity}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => void openHistory(row)}
											className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
										>
											Lihat Histori
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<Modal
				isOpen={Boolean(selectedRow)}
				onClose={() => setSelectedRow(null)}
				title="Histori Stok Barang"
			>
				{selectedRow ? (
					<div className="space-y-4">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
							<p className="font-semibold text-slate-900">{selectedRow.productName}</p>
							<p>Gudang: {selectedRow.warehouseName}</p>
							<p>Kondisi: {selectedRow.conditionSummary}</p>
						</div>
						{historyError ? (
							<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								{historyError}
							</div>
						) : null}
						<div className="overflow-hidden rounded-xl border border-slate-200">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-3 py-2">Tanggal</th>
										<th className="px-3 py-2">Tipe</th>
										<th className="px-3 py-2">Perubahan</th>
										<th className="px-3 py-2">Catatan</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{historyLoading ? (
										<tr>
											<td colSpan={4} className="px-3 py-4 text-slate-600">
												Memuat histori stok...
											</td>
										</tr>
									) : historyRows.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-3 py-4 text-slate-600">
												Belum ada histori stok untuk item ini.
											</td>
										</tr>
									) : (
										historyRows.map((item) => (
											<tr key={item.id}>
												<td className="px-3 py-2 text-slate-700">{formatDate(item.transactionDate)}</td>
												<td className="px-3 py-2 text-slate-700">{item.type}</td>
												<td className="px-3 py-2 text-slate-700">
													{item.items
														.map((detail) => {
															const label =
																detail.condition ??
																detail.toCondition ??
																detail.fromCondition ??
																"-";
															return `${label} x ${detail.quantity}`;
														})
														.join(", ")}
												</td>
												<td className="px-3 py-2 text-slate-600">{item.reason || "-"}</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
			</Modal>
		</FeaturePage>
	);
}
