"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

export default function ReconciliationPage() {
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	const load = async (options?: { withLoader?: boolean }) => {
		if (options?.withLoader !== false) {
			setLoading(true);
			setError("");
		}
		try {
			const result = await warehousesService.list({ page: 1, limit: 100 });
			setWarehouses(result.items);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat daftar gudang."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load({ withLoader: false });
		}, 0);

		return () => window.clearTimeout(timer);
	}, []);

	const filteredWarehouses = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return warehouses;
		return warehouses.filter((warehouse) => warehouse.name.toLowerCase().includes(query));
	}, [warehouses, search]);

	return (
		<FeaturePage
			title="Stock Reconciliation"
			description="Pilih gudang untuk membuat sesi rekonsiliasi stok. Snapshot dan editor tersedia di halaman gudang yang dipilih."
			actions={[{ label: "Refresh", onClick: () => void load() }]}
		>
			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<input
					className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-md"
					placeholder="Cari nama gudang"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
				/>
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
							<th className="px-4 py-3">Gudang</th>
							<th className="px-4 py-3">Lokasi</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={3}>
									Memuat gudang...
								</td>
							</tr>
						) : filteredWarehouses.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={3}>
									Gudang tidak ditemukan.
								</td>
							</tr>
						) : (
							filteredWarehouses.map((warehouse) => (
								<tr key={warehouse.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{warehouse.name}</div>
										<div className="text-xs text-slate-500">{warehouse.id}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{warehouse.city?.name
											? `${warehouse.city.name}${warehouse.city.province ? `, ${warehouse.city.province}` : ""}`
											: warehouse.address || "-"}
									</td>
									<td className="px-4 py-3 text-right">
										<Link
											href={`/gudang/reconciliation/warehouse/${warehouse.id}`}
											className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
										>
											Buka
										</Link>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</FeaturePage>
	);
}
