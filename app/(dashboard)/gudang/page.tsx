"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dashboardService } from "@/services/dashboard";
import { deliveryOrdersService, type DeliveryOrderListItem } from "@/services/delivery-orders";
import { warehouseInventoryService, type WarehouseInventoryItem } from "@/services/warehouse-inventory";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

interface WarehouseStocksSummary {
	totalSkus: number;
	totalQuantity: number;
	lowStockCount: number;
	outOfStockCount: number;
}

export default function WarehouseDashboard() {
	const [stocks, setStocks] = useState<WarehouseStocksSummary | null>(null);
	const [warehouseCount, setWarehouseCount] = useState(0);
	const [inventoryRows, setInventoryRows] = useState(0);
	const [openShipments, setOpenShipments] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let mounted = true;
		const timer = window.setTimeout(() => {
			void (async () => {
				setLoading(true);
				setError("");
				try {
					const [stockSummary, warehouseResult, inventoryResult, deliveryOrderResult] = await Promise.all([
						dashboardService.getStocks(10) as Promise<WarehouseStocksSummary>,
						warehousesService.listAll(),
						warehouseInventoryService.listAll(),
						deliveryOrdersService.listAll(),
					]);

					if (!mounted) return;

					setStocks(stockSummary);
					setWarehouseCount((warehouseResult as WarehouseListItem[]).length);
					setInventoryRows((inventoryResult as WarehouseInventoryItem[]).length);
					setOpenShipments(
						(deliveryOrderResult as DeliveryOrderListItem[]).filter(
							(item) => item.status !== "SHIPPED" && item.status !== "CANCELLED",
						).length,
					);
				} catch {
					if (!mounted) return;
					setError("Gagal memuat ringkasan gudang.");
				} finally {
					if (mounted) setLoading(false);
				}
			})();
		}, 0);

		return () => {
			mounted = false;
			window.clearTimeout(timer);
		};
	}, []);

	return (
		<div>
			<h1 className="mb-2 text-3xl font-bold text-gray-900">Dashboard Gudang</h1>
			<p className="mb-6 text-gray-600">
				Pusat kerja gudang untuk memantau stok, penerimaan, dan pengiriman yang masih berjalan.
			</p>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
				<div className="rounded-lg bg-white p-6 shadow">
					<p className="text-sm text-gray-500">Total Gudang</p>
					<p className="text-3xl font-bold text-gray-900">{loading ? "-" : warehouseCount}</p>
				</div>
				<div className="rounded-lg bg-white p-6 shadow">
					<p className="text-sm text-gray-500">Baris Inventori</p>
					<p className="text-3xl font-bold text-gray-900">{loading ? "-" : inventoryRows}</p>
				</div>
				<div className="rounded-lg bg-white p-6 shadow">
					<p className="text-sm text-gray-500">Stok Menipis</p>
					<p className="text-3xl font-bold text-blue-600">{loading ? "-" : stocks ? stocks.lowStockCount : "-"}</p>
				</div>
				<div className="rounded-lg bg-white p-6 shadow">
					<p className="text-sm text-gray-500">DO Belum Selesai</p>
					<p className="text-3xl font-bold text-green-600">{loading ? "-" : openShipments}</p>
				</div>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
					<p className="text-sm text-slate-500">Ringkasan stok</p>
					<div className="mt-4 grid gap-4 md:grid-cols-3">
						<div className="rounded-xl border border-slate-200 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total SKU</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">
								{loading ? "-" : stocks ? stocks.totalSkus.toLocaleString() : "-"}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Habis Stok</p>
							<p className="mt-2 text-2xl font-semibold text-amber-600">
								{loading ? "-" : stocks ? stocks.outOfStockCount : "-"}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Kuantitas</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">
								{loading ? "-" : stocks ? stocks.totalQuantity.toLocaleString() : "-"}
							</p>
						</div>
					</div>
				</div>

				<div className="space-y-4">
					<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Aksi cepat</p>
						<div className="mt-3 flex flex-col gap-2">
							<Link href="/gudang/penerimaan-barang" className="rounded-md bg-indigo-600 px-3 py-2 text-center text-xs text-white">
								Catat Penerimaan
							</Link>
							<Link href="/gudang/stok-gudang" className="rounded-md border px-3 py-2 text-center text-xs">
								Lihat Stok Gudang
							</Link>
							<Link href="/gudang/pengiriman" className="rounded-md border px-3 py-2 text-center text-xs">
								Proses Pengiriman
							</Link>
							<Link href="/gudang/reconciliation" className="rounded-md border px-3 py-2 text-center text-xs">
								Mulai Rekonsiliasi
							</Link>
						</div>
					</div>
				</div>
			</div>

			<p className="text-gray-600">Kelola inventori, penerimaan, rekonsiliasi, dan pengiriman dari satu permukaan kerja.</p>
		</div>
	);
}
