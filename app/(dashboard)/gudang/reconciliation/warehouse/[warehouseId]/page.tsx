"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FeaturePage } from "@/components/shared/FeaturePage";
import ReconciliationSnapshotEditor from "@/components/gudang/ReconciliationSnapshotEditor";
import ReconciliationSessionsList from "@/components/gudang/ReconciliationSessionsList";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

export default function ReconciliationWarehousePage() {
	const { warehouseId } = useParams() as { warehouseId?: string };
	const router = useRouter();
	const [warehouse, setWarehouse] = useState<WarehouseListItem | null>(null);
	const [loadingWarehouse, setLoadingWarehouse] = useState(true);
	const [error, setError] = useState("");
	const [sessionsKey, setSessionsKey] = useState(0);

	useEffect(() => {
		if (!warehouseId) return;
		let mounted = true;
		setLoadingWarehouse(true);
		setError("");
		warehousesService
			.getById(warehouseId)
			.then((res) => {
				if (!mounted) return;
				setWarehouse(res);
			})
			.catch((err: any) => {
				if (!mounted) return;
				setError(err?.response?.data?.message || "Gagal memuat detail gudang.");
			})
			.finally(() => {
				if (!mounted) return;
				setLoadingWarehouse(false);
			});

		return () => {
			mounted = false;
		};
	}, [warehouseId]);

	const title = useMemo(() => {
		if (warehouse?.name) return `Reconciliation - ${warehouse.name}`;
		return "Stock Reconciliation";
	}, [warehouse?.name]);

	if (!warehouseId) {
		return (
			<FeaturePage
				title="Stock Reconciliation"
				description="WarehouseId tidak ditemukan pada URL."
				actions={[{ label: "Kembali", href: "/gudang/reconciliation" }]}
			/>
		);
	}

	return (
		<FeaturePage
			title={title}
			description="Edit snapshot fisik stok, lalu buat sesi rekonsiliasi. Konfirmasi atau batalkan sesi dari halaman detail session."
			actions={[{ label: "Kembali", href: "/gudang/reconciliation" }]}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{loadingWarehouse ? (
				<div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
					Memuat detail gudang...
				</div>
			) : null}

			<section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<ReconciliationSnapshotEditor
						warehouseId={warehouseId}
						onCreated={(session) => {
							setSessionsKey((prev) => prev + 1);
							if (session?.id) {
								router.push(`/gudang/reconciliation/${session.id}`);
							}
						}}
					/>
				</div>

				<div>
					<ReconciliationSessionsList key={sessionsKey} warehouseId={warehouseId} />
				</div>
			</section>
		</FeaturePage>
	);
}
