"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	reconciliationService,
	type ReconciliationCondition,
	type ReconciliationSessionSummary,
	type ReconciliationSnapshotItem,
} from "@/services/reconciliation";

interface Props {
	warehouseId: string;
	onCreated?: (session: ReconciliationSessionSummary) => void;
}

interface Item {
	productId: string;
	productName: string;
	condition: ReconciliationCondition;
	systemQuantity: number;
	physicalQuantity: number;
}

export default function ReconciliationSnapshotEditor({ warehouseId, onCreated }: Props) {
	const [items, setItems] = useState<Item[]>([]);
	const [warehouseName, setWarehouseName] = useState("");
	const [snapshotAt, setSnapshotAt] = useState("");
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!warehouseId) return;
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				setError(null);
				try {
					const res = await reconciliationService.getSnapshot(warehouseId);
					if (cancelled) return;
					setWarehouseName(res.warehouseName);
					setSnapshotAt(res.snapshotAt);
					const mapped: Item[] = (res.items ?? []).map((it: ReconciliationSnapshotItem) => ({
						productId: it.productId,
						productName: it.productName,
						condition: it.condition,
						systemQuantity: Number(it.systemQuantity ?? 0),
						physicalQuantity: Number(it.systemQuantity ?? 0),
					}));
					setItems(mapped);
				} catch (error: unknown) {
					if (cancelled) return;
					setError(getApiErrorMessage(error, "Gagal memuat snapshot stok gudang."));
				} finally {
					if (!cancelled) {
						setLoading(false);
					}
				}
			})();
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [warehouseId]);

	function updatePhysical(index: number, value: number) {
		const nextValue = Number.isFinite(value) && value >= 0 ? value : 0;
		setItems((current) =>
			current.map((item, itemIndex) =>
				itemIndex === index ? { ...item, physicalQuantity: nextValue } : item,
			),
		);
	}

	async function handleCreate() {
		setCreating(true);
		setError(null);
		try {
			const session = await reconciliationService.createSession(warehouseId, {
				items: items.map((item) => ({
					productId: item.productId,
					condition: item.condition,
					physicalQuantity: Number(item.physicalQuantity ?? 0),
				})),
			});
			if (onCreated) onCreated(session);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal membuat sesi rekonsiliasi."));
		} finally {
			setCreating(false);
		}
	}

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
				<div>
					<p className="text-sm font-semibold text-slate-800">Snapshot Stok</p>
					<p className="mt-1 text-xs text-slate-500">
						Cocokkan stok fisik dengan stok sistem sebelum membuat sesi rekonsiliasi.
					</p>
				</div>
				<div className="text-xs text-slate-500">
					<div>Gudang: {warehouseName || warehouseId}</div>
					<div>Snapshot: {snapshotAt ? new Date(snapshotAt).toLocaleString("id-ID") : "-"}</div>
				</div>
			</div>

			{loading ? <div className="mt-3 text-xs text-slate-500">Memuat snapshot...</div> : null}

			{!loading && items.length === 0 ? (
				<div className="mt-3 text-xs text-slate-500">Belum ada item inventori di gudang ini.</div>
			) : null}

			{!loading && items.length > 0 ? (
				<div className="mt-3 overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-slate-500">
							<tr>
								<th className="pb-2">Produk</th>
								<th className="pb-2">Kondisi</th>
								<th className="pb-2 text-right">Qty Sistem</th>
								<th className="pb-2 text-right">Qty Fisik</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item, index) => (
								<tr key={`${item.productId}-${item.condition}`} className="border-t border-slate-100">
									<td className="py-2">{item.productName}</td>
									<td className="py-2">{item.condition}</td>
									<td className="py-2 text-right">{item.systemQuantity}</td>
									<td className="py-2 text-right">
										<input
											type="number"
											min={0}
											value={item.physicalQuantity}
											onChange={(event) => updatePhysical(index, Number(event.target.value))}
											className="w-28 rounded-md border px-2 py-1 text-right text-sm"
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			{error ? <div className="mt-3 text-xs text-rose-600">{error}</div> : null}

			<div className="mt-4 flex justify-end">
				<button
					onClick={handleCreate}
					disabled={creating || loading || items.length === 0}
					className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white disabled:opacity-60"
				>
					{creating ? "Membuat..." : "Buat Sesi Rekonsiliasi"}
				</button>
			</div>
		</div>
	);
}
