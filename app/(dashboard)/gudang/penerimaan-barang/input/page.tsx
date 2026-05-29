"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/shared/Modal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatLocalDateTimeInput, toIsoFromLocalInput } from "@/lib/datetime";
import { productsService, type Product } from "@/services/products";
import { stockAdjustmentsService } from "@/services/stock-adjustments";
import {
	buildWarehouseReceiptReason,
	type WarehouseReceiptMeta,
} from "@/services/warehouse-receipts";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

interface ReceiptLineForm {
	productId: string;
	qtyReceived: string;
	qtyGood: string;
	qtyDamaged: string;
}

const emptyLine = (): ReceiptLineForm => ({
	productId: "",
	qtyReceived: "0",
	qtyGood: "0",
	qtyDamaged: "0",
});

const createBatchId = () => `rcv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function PenerimaanBarangInputPage() {
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [itemModalOpen, setItemModalOpen] = useState(false);
	const [newItemName, setNewItemName] = useState("");
	const [form, setForm] = useState({
		warehouseId: "",
		referenceNumber: "",
		supplier: "",
		receivedAt: formatLocalDateTimeInput(),
		note: "",
		items: [emptyLine()],
	});

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [warehouseItems, productItems] = await Promise.all([
				warehousesService.listAll(),
				productsService.listAll({ sortBy: "name", sortOrder: "asc" }),
			]);
			setWarehouses(warehouseItems);
			setProducts(productItems);
			if (warehouseItems[0]?.id && !form.warehouseId) {
				setForm((current) => ({ ...current, warehouseId: warehouseItems[0].id }));
			}
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat referensi penerimaan barang."));
		} finally {
			setLoading(false);
		}
	}, [form.warehouseId]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);

		return () => window.clearTimeout(timer);
	}, [load]);

	const selectedProductIds = useMemo(
		() => form.items.map((item) => item.productId).filter(Boolean),
		[form.items],
	);

	const updateLine = (index: number, nextLine: Partial<ReceiptLineForm>) => {
		setForm((current) => ({
			...current,
			items: current.items.map((line, lineIndex) => {
				if (lineIndex !== index) {
					return line;
				}

				const merged = { ...line, ...nextLine };
				const qtyReceived = Math.max(0, Number(merged.qtyReceived) || 0);
				let qtyGood = Math.max(0, Number(merged.qtyGood) || 0);
				let qtyDamaged = Math.max(0, Number(merged.qtyDamaged) || 0);

				if ("qtyReceived" in nextLine) {
					qtyGood = Math.min(qtyGood, qtyReceived);
					qtyDamaged = Math.max(0, qtyReceived - qtyGood);
				}

				if ("qtyGood" in nextLine) {
					qtyGood = Math.min(qtyGood, qtyReceived);
					qtyDamaged = Math.max(0, qtyReceived - qtyGood);
				}

				if ("qtyDamaged" in nextLine) {
					qtyDamaged = Math.min(qtyDamaged, qtyReceived);
					qtyGood = Math.max(0, qtyReceived - qtyDamaged);
				}

				return {
					...merged,
					qtyReceived: String(qtyReceived),
					qtyGood: String(qtyGood),
					qtyDamaged: String(qtyDamaged),
				};
			}),
		}));
	};

	const addLine = () => {
		setForm((current) => ({
			...current,
			items: [...current.items, emptyLine()],
		}));
	};

	const removeLine = (index: number) => {
		setForm((current) => ({
			...current,
			items: current.items.length === 1
				? [emptyLine()]
				: current.items.filter((_, lineIndex) => lineIndex !== index),
		}));
	};

	const handleCreateItem = async () => {
		const name = sanitizeText(newItemName);
		if (!name) {
			setError("Nama item gudang wajib diisi.");
			return;
		}

		setSubmitting(true);
		setError("");
		try {
			const product = await productsService.create({ name });
			setProducts((current) => [product, ...current].sort((left, right) => left.name.localeCompare(right.name)));
			setNewItemName("");
			setItemModalOpen(false);
			setSuccess("Item gudang baru berhasil ditambahkan dari alur penerimaan.");
		} catch (createError: unknown) {
			setError(getApiErrorMessage(createError, "Gagal menambahkan item gudang."));
		} finally {
			setSubmitting(false);
		}
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const referenceNumber = sanitizeText(form.referenceNumber);
		const supplier = sanitizeText(form.supplier);
		const note = sanitizeText(form.note);

		if (!form.warehouseId || !referenceNumber || !supplier) {
			setError("Gudang, nomor referensi, dan supplier wajib diisi.");
			return;
		}

		const normalizedItems = form.items.map((item) => ({
			productId: item.productId,
			qtyReceived: Math.max(0, Number(item.qtyReceived) || 0),
			qtyGood: Math.max(0, Number(item.qtyGood) || 0),
			qtyDamaged: Math.max(0, Number(item.qtyDamaged) || 0),
		}));

		if (normalizedItems.some((item) => !item.productId)) {
			setError("Semua baris penerimaan harus memilih produk.");
			return;
		}

		if (new Set(normalizedItems.map((item) => item.productId)).size !== normalizedItems.length) {
			setError("Produk duplikat dalam satu dokumen penerimaan tidak diperbolehkan.");
			return;
		}

		if (normalizedItems.some((item) => item.qtyReceived <= 0)) {
			setError("Jumlah diterima setiap item harus lebih dari 0.");
			return;
		}

		if (normalizedItems.some((item) => item.qtyGood + item.qtyDamaged !== item.qtyReceived)) {
			setError("Qty Bagus + Qty Rusak harus sama dengan Qty Diterima.");
			return;
		}

		const batchId = createBatchId();
		const receivedAt = toIsoFromLocalInput(form.receivedAt);
		const meta: WarehouseReceiptMeta = {
			batchId,
			referenceNumber,
			supplier,
			warehouseId: form.warehouseId,
			receivedAt,
		};

		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await Promise.all(
				normalizedItems.flatMap((item) => {
					const requests: Array<Promise<unknown>> = [];
					if (item.qtyGood > 0) {
						requests.push(
							stockAdjustmentsService.receiveStock({
								warehouseId: form.warehouseId,
								productId: item.productId,
								receivedAt,
								reason: buildWarehouseReceiptReason(meta, note),
								items: [{ condition: "GOOD", quantity: item.qtyGood }],
							}),
						);
					}
					if (item.qtyDamaged > 0) {
						requests.push(
							stockAdjustmentsService.receiveStock({
								warehouseId: form.warehouseId,
								productId: item.productId,
								receivedAt,
								reason: buildWarehouseReceiptReason(meta, note),
								items: [{ condition: "DAMAGED", quantity: item.qtyDamaged }],
							}),
						);
					}
					return requests;
				}),
			);

			setSuccess("Penerimaan barang berhasil dicatat dengan pola multi-item seperti FE1.");
			setForm({
				warehouseId: form.warehouseId,
				referenceNumber: "",
				supplier: "",
				receivedAt: formatLocalDateTimeInput(),
				note: "",
				items: [emptyLine()],
			});
		} catch (submitError: unknown) {
			setError(getApiErrorMessage(submitError, "Gagal menyimpan penerimaan barang."));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FeaturePage
			title="Input Penerimaan Barang"
			description="Form penerimaan multi-item dengan split qty bagus dan rusak, agar meja kerja gudang FE2 lebih dekat dengan pola FE1."
		>
			<div className="flex justify-end">
				<Link
					href="/gudang/penerimaan-barang"
					className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
				>
					Kembali ke Daftar
				</Link>
			</div>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<form className="space-y-5" onSubmit={handleSubmit}>
					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-slate-700">
							<span>Gudang Tujuan</span>
							<select
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={form.warehouseId}
								onChange={(event) =>
									setForm((current) => ({ ...current, warehouseId: event.target.value }))
								}
								disabled={loading || submitting}
							>
								<option value="">Pilih gudang</option>
								{warehouses.map((warehouse) => (
									<option key={warehouse.id} value={warehouse.id}>
										{warehouse.name}
									</option>
								))}
							</select>
							{!loading && warehouses.length === 0 ? (
								<p className="text-xs text-amber-700">Belum ada data gudang aktif untuk dipilih.</p>
							) : null}
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Tanggal & Jam Masuk</span>
							<input
								type="datetime-local"
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={form.receivedAt}
								onChange={(event) =>
									setForm((current) => ({ ...current, receivedAt: event.target.value }))
								}
								disabled={submitting}
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>No Referensi</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								placeholder="Nomor PO / Surat Jalan"
								value={form.referenceNumber}
								onChange={(event) =>
									setForm((current) => ({ ...current, referenceNumber: event.target.value }))
								}
								disabled={submitting}
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Supplier</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								placeholder="Nama supplier"
								value={form.supplier}
								onChange={(event) =>
									setForm((current) => ({ ...current, supplier: event.target.value }))
								}
								disabled={submitting}
							/>
						</label>
					</div>

					<label className="space-y-2 text-sm text-slate-700">
						<span>Catatan Dokumen</span>
						<textarea
							className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2"
							placeholder="Catatan tambahan penerimaan barang"
							value={form.note}
							onChange={(event) =>
								setForm((current) => ({ ...current, note: event.target.value }))
							}
							disabled={submitting}
						/>
					</label>

					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-lg font-semibold text-slate-900">Detail Item</h2>
								<p className="text-sm text-slate-600">
									Setiap baris bisa membagi jumlah diterima menjadi barang bagus dan rusak.
								</p>
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setItemModalOpen(true)}
									className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								>
									Tambah Item Gudang
								</button>
								<button
									type="button"
									onClick={addLine}
									className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
								>
									Tambah Baris
								</button>
							</div>
						</div>

						<div className="overflow-hidden rounded-2xl border border-slate-200">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-3 py-2">Produk</th>
										<th className="px-3 py-2">Qty Diterima</th>
										<th className="px-3 py-2">Qty Bagus</th>
										<th className="px-3 py-2">Qty Rusak</th>
										<th className="px-3 py-2 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{form.items.map((item, index) => (
										<tr key={`receipt-line-${index}`}>
											<td className="px-3 py-2">
												<select
													className="w-full rounded-lg border border-slate-300 px-3 py-2"
													value={item.productId}
													onChange={(event) =>
														updateLine(index, { productId: event.target.value })
													}
													disabled={submitting}
												>
													<option value="">Pilih produk</option>
													{products.map((product) => (
														<option
															key={product.id}
															value={product.id}
															disabled={
																selectedProductIds.includes(product.id) &&
																product.id !== item.productId
															}
														>
															{product.name}
														</option>
													))}
												</select>
												{!loading && products.length === 0 ? (
													<p className="mt-1 text-xs text-amber-700">
														Belum ada produk. Tambahkan item gudang terlebih dahulu.
													</p>
												) : null}
											</td>
											<td className="px-3 py-2">
												<input
													type="number"
													min={0}
													className="w-24 rounded-lg border border-slate-300 px-3 py-2"
													value={item.qtyReceived}
													onChange={(event) =>
														updateLine(index, { qtyReceived: event.target.value })
													}
													disabled={submitting}
												/>
											</td>
											<td className="px-3 py-2">
												<input
													type="number"
													min={0}
													className="w-24 rounded-lg border border-slate-300 px-3 py-2"
													value={item.qtyGood}
													onChange={(event) =>
														updateLine(index, { qtyGood: event.target.value })
													}
													disabled={submitting}
												/>
											</td>
											<td className="px-3 py-2">
												<input
													type="number"
													min={0}
													className="w-24 rounded-lg border border-slate-300 px-3 py-2"
													value={item.qtyDamaged}
													onChange={(event) =>
														updateLine(index, { qtyDamaged: event.target.value })
													}
													disabled={submitting}
												/>
											</td>
											<td className="px-3 py-2 text-right">
												<button
													type="button"
													onClick={() => removeLine(index)}
													className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
												>
													Hapus
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={loading || submitting}
							className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{submitting ? "Menyimpan..." : "Catat Penerimaan"}
						</button>
					</div>
				</form>
			</section>

			<Modal
				isOpen={itemModalOpen}
				onClose={() => setItemModalOpen(false)}
				title="Tambah Item Gudang"
			>
				<div className="space-y-4">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2"
						placeholder="Nama item gudang"
						value={newItemName}
						onChange={(event) => setNewItemName(event.target.value)}
						disabled={submitting}
					/>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setItemModalOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={() => void handleCreateItem()}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
							disabled={submitting}
						>
							{submitting ? "Menyimpan..." : "Simpan Item"}
						</button>
					</div>
				</div>
			</Modal>
		</FeaturePage>
	);
}
