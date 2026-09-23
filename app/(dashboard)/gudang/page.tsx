"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FeaturePage } from "@/components/shared/FeaturePage";
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
				setLoading(true); setError("");
				try {
					const [stockSummary, warehouseResult, inventoryResult, deliveryOrderResult] = await Promise.all([
						dashboardService.getStocks(10) as Promise<WarehouseStocksSummary>, warehousesService.listAll(), warehouseInventoryService.listAll(), deliveryOrdersService.listAll(),
					]);
					if (!mounted) return;
					setStocks(stockSummary); setWarehouseCount((warehouseResult as WarehouseListItem[]).length); setInventoryRows((inventoryResult as WarehouseInventoryItem[]).length);
					setOpenShipments((deliveryOrderResult as DeliveryOrderListItem[]).filter((item) => item.status !== "SHIPPED" && item.status !== "CANCELLED").length);
				} catch { if (mounted) setError("Gagal memuat ringkasan gudang."); }
				finally { if (mounted) setLoading(false); }
			})();
		}, 0);
		return () => { mounted = false; window.clearTimeout(timer); };
	}, []);

	return <FeaturePage title="Dashboard Gudang" description="Pusat kerja gudang untuk memantau stok, penerimaan, pengiriman, dan transfer yang berjalan.">
		{error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
		<section className="grid gap-4 md:grid-cols-4">{[["Total Gudang", warehouseCount], ["Baris Inventori", inventoryRows], ["Stok Menipis", stocks?.lowStockCount ?? "-"], ["DO Belum Selesai", openShipments]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? "-" : value}</p></div>)}</section>
		<section className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"><p className="text-sm text-slate-500">Ringkasan stok</p><div className="mt-4 grid gap-4 md:grid-cols-3">{[["Total SKU", stocks?.totalSkus], ["Habis Stok", stocks?.outOfStockCount], ["Total Kuantitas", stocks?.totalQuantity]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "-" : value ?? "-"}</p></div>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Aksi cepat</p><div className="mt-3 flex flex-col gap-2"><Link href="/gudang/penerimaan-barang" className="rounded-xl bg-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white">Catat Penerimaan</Link><Link href="/gudang/stok-gudang" className="rounded-xl border px-3 py-2 text-center text-xs font-semibold">Lihat Stok Gudang</Link><Link href="/gudang/pengiriman" className="rounded-xl border px-3 py-2 text-center text-xs font-semibold">Proses Pengiriman</Link><Link href="/gudang/transfer-gudang" className="rounded-xl border px-3 py-2 text-center text-xs font-semibold">Transfer Gudang</Link></div></div></section>
	</FeaturePage>;
}
