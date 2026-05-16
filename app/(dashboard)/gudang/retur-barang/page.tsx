"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	returnsService,
	type ProductCondition,
	type ReturnListItem,
} from "@/services/returns";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

const dateOnly = (v?: string | null) => String(v || "").slice(0, 10) || "-";
const RETURN_CONDITIONS: ProductCondition[] = ["NEW", "GOOD", "DAMAGED", "DEFECTIVE"];

type ReceiveItemForm = {
	returnItemId: string;
	receivedQuantity: number;
	condition: ProductCondition;
	warehouseNotes: string;
};

const getErrorMessage = (err: unknown, fallback: string) => {
	if (typeof err === "object" && err !== null && "response" in err) {
		const response = (err as { response?: { data?: { message?: unknown } } }).response;
		if (typeof response?.data?.message === "string") return response.data.message;
	}
	if (err instanceof Error && err.message) return err.message;
	return fallback;
};

const qtyRequested = (ret: ReturnListItem) =>
	(ret.items ?? []).reduce((sum, item) => sum + (Number(item.requestedQuantity) || 0), 0);

const qtyReceived = (ret: ReturnListItem) =>
	(ret.items ?? []).reduce((sum, item) => sum + (Number(item.receivedQuantity) || 0), 0);

export default function ReturBarangPage() {
	const [returns, setReturns] = useState<ReturnListItem[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const [selectedReturnId, setSelectedReturnId] = useState("");
	const [warehouseId, setWarehouseId] = useState("");
	const [warehouseNotes, setWarehouseNotes] = useState("");
	const [itemForms, setItemForms] = useState<ReceiveItemForm[]>([]);

	const selectedReturn = useMemo(
		() => returns.find((ret) => ret.id === selectedReturnId) ?? null,
		[returns, selectedReturnId],
	);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [returnsResult, warehousesResult] = await Promise.all([
				returnsService.list({ page: 1, limit: 50, sortBy: "createdAt", sortOrder: "desc" }),
				warehousesService.list({ page: 1, limit: 100 }),
			]);
			setReturns(returnsResult.items);
			setWarehouses(warehousesResult.items);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Gagal memuat data retur barang."));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);

	const summary = useMemo(() => ({
		total: returns.length,
		requested: returns.filter((ret) => ret.status === "REQUESTED").length,
		receivedByWarehouse: returns.filter((ret) => ret.status === "RECEIVED_BY_WAREHOUSE").length,
		totalRequestedQty: returns.reduce((sum, ret) => sum + qtyRequested(ret), 0),
	}), [returns]);

	const selectReturn = (ret: ReturnListItem) => {
		if (ret.status !== "REQUESTED") return;
		setSelectedReturnId(ret.id);
		setWarehouseId("");
		setWarehouseNotes("");
		setItemForms((ret.items ?? []).map((item) => ({
			returnItemId: item.id,
			receivedQuantity: Number(item.requestedQuantity) || 0,
			condition: item.condition ?? "GOOD",
			warehouseNotes: item.warehouseNotes ?? "",
		})));
		setError("");
		setSuccess("");
	};

	const updateItemForm = (returnItemId: string, patch: Partial<ReceiveItemForm>) => {
		setItemForms((items) => items.map((item) => (
			item.returnItemId === returnItemId ? { ...item, ...patch } : item
		)));
	};

	const resetForm = () => {
		setSelectedReturnId("");
		setWarehouseId("");
		setWarehouseNotes("");
		setItemForms([]);
	};

	const handleSubmit = async () => {
		if (!selectedReturn) {
			setError("Pilih retur yang akan diterima.");
			return;
		}
		if (selectedReturn.status !== "REQUESTED") {
			setError("Retur hanya bisa diterima saat status REQUESTED.");
			return;
		}
		if (!warehouseId) {
			setError("Gudang penerima wajib dipilih.");
			return;
		}
		if (itemForms.length === 0 || itemForms.some((item) => item.receivedQuantity < 0)) {
			setError("Qty diterima tidak valid.");
			return;
		}

		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await returnsService.receive(selectedReturn.id, {
				warehouseId,
				warehouseNotes: warehouseNotes.trim() || undefined,
				items: itemForms.map((item) => ({
					returnItemId: item.returnItemId,
					receivedQuantity: item.receivedQuantity,
					condition: item.condition,
					warehouseNotes: item.warehouseNotes.trim() || undefined,
				})),
			});
			setSuccess("Retur berhasil diterima gudang.");
			resetForm();
			await load();
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Gagal menerima retur barang."));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FeaturePage
			title="Retur Barang"
			description="Terima retur barang dari toko ke gudang berdasarkan pengajuan retur."
		>
			{success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
			{error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Total Retur", value: summary.total },
					{ label: "Requested", value: summary.requested },
					{ label: "Diterima Gudang", value: summary.receivedByWarehouse },
					{ label: "Total Qty Diminta", value: summary.totalRequestedQty },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<h2 className="font-semibold text-slate-900">Daftar Retur</h2>
					<button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">Refresh</button>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">No Retur</th>
								<th className="px-4 py-3">Invoice</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3 text-right">Qty Diminta</th>
								<th className="px-4 py-3 text-right">Qty Diterima</th>
								<th className="px-4 py-3">Tanggal</th>
								<th className="px-4 py-3">Alasan</th>
								<th className="px-4 py-3">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr><td colSpan={8} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
							) : returns.length === 0 ? (
								<tr><td colSpan={8} className="px-4 py-4 text-slate-600">Belum ada pengajuan retur.</td></tr>
							) : returns.map((ret) => (
								<tr key={ret.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{ret.returnNumber}</td>
									<td className="px-4 py-3 text-slate-700">{ret.invoice?.invoiceNumber ?? ret.invoiceId}</td>
									<td className="px-4 py-3 text-slate-700">{ret.status}</td>
									<td className="px-4 py-3 text-right text-slate-900">{qtyRequested(ret)}</td>
									<td className="px-4 py-3 text-right text-slate-900">{qtyReceived(ret)}</td>
									<td className="px-4 py-3 text-slate-700">{dateOnly(ret.requestedAt ?? ret.createdAt)}</td>
									<td className="px-4 py-3 text-xs text-slate-500">{ret.reason || "-"}</td>
									<td className="px-4 py-3">
										<button type="button" onClick={() => selectReturn(ret)} disabled={ret.status !== "REQUESTED" || submitting} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Terima</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{selectedReturn ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Terima Retur {selectedReturn.returnNumber}</h2>
							<p className="mt-1 text-sm text-slate-500">Invoice: {selectedReturn.invoice?.invoiceNumber ?? selectedReturn.invoiceId}</p>
						</div>
						<button type="button" onClick={resetForm} disabled={submitting} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">Batal</button>
					</div>

					<div className="mt-5 grid gap-4 md:grid-cols-2">
						<label className="space-y-1.5 text-sm text-slate-700">
							<span>Gudang Penerima</span>
							<select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={loading || submitting}>
								<option value="">Pilih gudang</option>
								{warehouses.map((wh) => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
							</select>
						</label>
						<label className="space-y-1.5 text-sm text-slate-700">
							<span>Catatan Gudang</span>
							<textarea className="w-full rounded-xl border border-slate-300 px-3 py-2" rows={2} value={warehouseNotes} onChange={(e) => setWarehouseNotes(e.target.value)} disabled={submitting} />
						</label>
					</div>

					<div className="mt-5 space-y-3">
						{(selectedReturn.items ?? []).map((item) => {
							const form = itemForms.find((formItem) => formItem.returnItemId === item.id);
							return (
								<div key={item.id} className="rounded-xl border border-slate-200 p-4">
									<div className="font-medium text-slate-900">{item.product?.name ?? item.productId ?? "Produk"}</div>
									<div className="mt-1 text-xs text-slate-500">ID: {item.productId ?? item.product?.id ?? "-"} • Diminta: {item.requestedQuantity}</div>
									<div className="mt-3 grid gap-3 md:grid-cols-3">
										<label className="space-y-1 text-sm text-slate-700">
											<span>Qty Diterima</span>
											<input type="number" min={0} className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form?.receivedQuantity ?? 0} onChange={(e) => updateItemForm(item.id, { receivedQuantity: Number(e.target.value) })} disabled={submitting} />
										</label>
										<label className="space-y-1 text-sm text-slate-700">
											<span>Kondisi</span>
											<select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form?.condition ?? "GOOD"} onChange={(e) => updateItemForm(item.id, { condition: e.target.value as ProductCondition })} disabled={submitting}>
												{RETURN_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
											</select>
										</label>
										<label className="space-y-1 text-sm text-slate-700">
											<span>Catatan Item</span>
											<input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form?.warehouseNotes ?? ""} onChange={(e) => updateItemForm(item.id, { warehouseNotes: e.target.value })} disabled={submitting} />
										</label>
									</div>
								</div>
							);
						})}
					</div>

					<div className="mt-5 flex justify-end">
						<button type="button" onClick={handleSubmit} disabled={submitting || loading} className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">{submitting ? "Menyimpan..." : "Terima Retur"}</button>
					</div>
				</section>
			) : null}
		</FeaturePage>
	);
}
