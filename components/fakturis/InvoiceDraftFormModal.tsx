"use client";

import Modal from "@/components/shared/Modal";
import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import { invoiceDraftsService, type InvoiceDraftDetail, type InvoiceDraftListItem } from "@/services/invoice-drafts";
import type { InvoiceListItem } from "@/services/invoices";
import type { OrderListItem } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

interface InvoiceDraftFormModalProps {
	order: OrderListItem | null;
	draft?: InvoiceDraftListItem | null;
	invoice?: InvoiceListItem | null;
	dueDate: string;
	notes: string;
	submitting?: boolean;
	onDueDateChange: (value: string) => void;
	onNotesChange: (value: string) => void;
	onClose: () => void;
	onCreateDraft: (order: OrderListItem) => void;
	onFinalizeDraft: (draft: InvoiceDraftListItem, order: OrderListItem) => void;
	onCancelDraft: (draft: InvoiceDraftListItem) => void;
	onCancelInvoice: (invoice: InvoiceListItem) => void;
}

export default function InvoiceDraftFormModal({
	order,
	draft,
	invoice,
	dueDate,
	notes,
	submitting = false,
	onDueDateChange,
	onNotesChange,
	onClose,
	onCreateDraft,
	onFinalizeDraft,
	onCancelDraft,
	onCancelInvoice,
}: InvoiceDraftFormModalProps) {
	const orderId = order?.id ?? null;
	const isLocked = Boolean(invoice) || (draft ? draft.status !== "DRAFT" : false);
	const [items, setItems] = useState<InvoiceDraftDetail["items"]>([]);
	const [loadingDraft, setLoadingDraft] = useState(false);
	const [draftError, setDraftError] = useState("");
	const [savingDraft, setSavingDraft] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const timer = window.setTimeout(() => {
			if (!orderId || !draft?.id) {
				setItems([]);
				setDraftError("");
				setLoadingDraft(false);
				return;
			}

			void (async () => {
				setLoadingDraft(true);
				setDraftError("");
				try {
					const res = await invoiceDraftsService.getById(draft.id);
					if (cancelled) return;
					setItems(res.items ?? []);
					if (!dueDate && res.dueDate) {
						onDueDateChange(String(res.dueDate).slice(0, 10));
					}
					if (!notes && res.notes) {
						onNotesChange(res.notes);
					}
				} catch (error: unknown) {
					if (cancelled) return;
					setDraftError(getApiErrorMessage(error, "Gagal memuat detail draft."));
				} finally {
					if (!cancelled) {
						setLoadingDraft(false);
					}
				}
			})();
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [draft?.id, dueDate, notes, onDueDateChange, onNotesChange, orderId]);

	const totalAmount = useMemo(
		() =>
			items.reduce((sum, item) => {
				const quantity = item.quantity ?? 0;
				const unitPrice = item.unitPriceSnapshot ?? 0;
				const discount = item.discountAmountSnapshot ?? 0;
				const tax = item.taxAmountSnapshot ?? 0;
				return sum + quantity * unitPrice - discount + tax;
			}, 0),
		[items],
	);

	const discountTotal = useMemo(
		() => items.reduce((sum, item) => sum + (item.discountAmountSnapshot ?? 0), 0),
		[items],
	);

	const taxTotal = useMemo(
		() => items.reduce((sum, item) => sum + (item.taxAmountSnapshot ?? 0), 0),
		[items],
	);

	const grossTotal = useMemo(
		() =>
			items.reduce(
				(sum, item) => sum + (item.quantity ?? 0) * (item.unitPriceSnapshot ?? 0),
				0,
			),
		[items],
	);

	const handleSaveDraft = async () => {
		if (!draft?.id) return;
		setSavingDraft(true);
		setDraftError("");
		try {
			const payload: Parameters<typeof invoiceDraftsService.update>[1] = {
				items: items.map((item) => {
					const quantity = Math.max(1, Math.floor(item.quantity || 1));
					const unitPriceSnapshot = Math.max(0, Math.floor(item.unitPriceSnapshot || 0));
					const baseAmount = quantity * unitPriceSnapshot;
					const discountAmountSnapshot = Math.min(
						Math.max(0, Math.floor(item.discountAmountSnapshot ?? 0)),
						baseAmount,
					);
					const taxAmountSnapshot = Math.max(0, Math.floor(item.taxAmountSnapshot ?? 0));
					return {
						id: item.id,
						quantity,
						unitPriceSnapshot,
						discountAmountSnapshot,
						taxAmountSnapshot,
					};
				}),
			};
			if (dueDate) payload.dueDate = new Date(dueDate).toISOString();
			if (notes.trim()) payload.notes = notes.trim();
			const updated = await invoiceDraftsService.update(draft.id, payload);
			setItems(updated.items ?? []);
			return true;
		} catch (error: unknown) {
			setDraftError(getApiErrorMessage(error, "Gagal menyimpan draft."));
			return false;
		} finally {
			setSavingDraft(false);
		}
	};

	const handleFinalize = async () => {
		if (!draft || !order) return;
		if (!isLocked && draft.status === "DRAFT" && items.length > 0) {
			const ok = await handleSaveDraft();
			if (!ok) return;
		}
		onFinalizeDraft(draft, order);
	};

	return (
		<Modal isOpen={Boolean(order)} onClose={onClose} title="Proses Invoice">
			{order ? (
				<div className="space-y-4 text-sm text-slate-700">
					<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
						<div>
							<p className="text-xs text-slate-500">Order</p>
							<p className="font-semibold text-slate-900">{order.orderNumber}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Tanggal</p>
							<p className="font-semibold text-slate-900">{dateOnly(order.documentDate)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Toko</p>
							<p className="font-semibold text-slate-900">{order.storeNameSnapshot}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Total</p>
							<p className="font-semibold text-slate-900">{formatRupiah(order.totalAmount)}</p>
						</div>
					</div>

					<div className="rounded-lg border border-slate-200 p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Status invoice
						</p>
						{invoice ? (
							<div className="mt-2">
								<p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
								<p className="text-slate-600">
									{invoice.status} - jatuh tempo {dateOnly(invoice.dueDate)}
								</p>
							</div>
						) : draft ? (
							<div className="mt-2">
								<p className="font-semibold text-slate-900">{draft.draftNumber}</p>
								<p className="text-slate-600">
									{draft.status} - jatuh tempo {dateOnly(draft.dueDate)}
								</p>
							</div>
						) : (
							<p className="mt-2 text-slate-600">Belum ada draft.</p>
						)}
						{isLocked ? (
							<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
								Dokumen ini sudah terkunci. Detail item, jatuh tempo, dan catatan tidak bisa diubah lagi
								dari form ini.
							</div>
						) : null}
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2">
							<span className="font-medium">Jatuh Tempo</span>
							<input
								type="date"
								className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
								value={dueDate}
								onChange={(event) => onDueDateChange(event.target.value)}
								disabled={submitting || isLocked || savingDraft}
							/>
						</label>
						<label className="space-y-2">
							<span className="font-medium">Catatan</span>
							<textarea
								className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
								value={notes}
								onChange={(event) => onNotesChange(event.target.value)}
								placeholder="Catatan invoice"
								disabled={submitting || isLocked || savingDraft}
							/>
						</label>
					</div>

					{draftError ? (
						<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{draftError}
						</div>
					) : null}

					{draft ? (
						<div className="rounded-lg border border-slate-200 p-4">
							<div className="flex items-center justify-between">
								<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Item Draft
								</p>
								<p className="text-xs text-slate-500">Total {formatRupiah(totalAmount)}</p>
							</div>

							{loadingDraft ? (
								<p className="mt-3 text-sm text-slate-500">Memuat item draft...</p>
							) : items.length === 0 ? (
								<p className="mt-3 text-sm text-slate-500">Belum ada item.</p>
							) : (
								<div className="mt-3 overflow-x-auto">
									<table className="min-w-full text-sm">
										<thead className="text-left text-xs uppercase tracking-wide text-slate-500">
											<tr>
												<th className="py-2 pr-4">Produk</th>
												<th className="py-2 pr-4">Kondisi</th>
												<th className="py-2 pr-4 text-right">Qty</th>
												<th className="py-2 pr-4 text-right">Harga</th>
												<th className="py-2 pr-4 text-right">Diskon</th>
												<th className="py-2 pr-4 text-right">Pajak</th>
												<th className="py-2 text-right">Subtotal</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100">
											{items.map((item, index) => (
												<tr key={item.id}>
													<td className="py-2 pr-4 text-slate-900">
														{item.productNameSnapshot}
													</td>
													<td className="py-2 pr-4 text-slate-700">{item.condition}</td>
													<td className="py-2 pr-4 text-right">
														{isLocked || draft.status !== "DRAFT" ? (
															<span className="text-slate-700">{item.quantity}</span>
														) : (
															<input
																type="number"
																min={1}
																value={item.quantity}
																onChange={(event) => {
																	const nextQty = Math.max(1, Number(event.target.value || 1));
																	setItems((prev) =>
																		prev.map((row, idx) => {
																			if (idx !== index) return row;
																			const baseAmount = nextQty * (row.unitPriceSnapshot ?? 0);
																			return {
																				...row,
																				quantity: nextQty,
																				discountAmountSnapshot: Math.min(
																					row.discountAmountSnapshot ?? 0,
																					baseAmount,
																				),
																			};
																		}),
																	);
																}}
																className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right"
																disabled={submitting || savingDraft}
															/>
														)}
													</td>
													<td className="py-2 pr-4 text-right">
														{isLocked || draft.status !== "DRAFT" ? (
															<span className="text-slate-700">{formatRupiah(item.unitPriceSnapshot)}</span>
														) : (
															<input
																type="number"
																min={0}
																value={item.unitPriceSnapshot}
																onChange={(event) => {
																	const nextPrice = Math.max(0, Number(event.target.value || 0));
																	setItems((prev) =>
																		prev.map((row, idx) => {
																			if (idx !== index) return row;
																			const baseAmount = (row.quantity ?? 0) * nextPrice;
																			return {
																				...row,
																				unitPriceSnapshot: nextPrice,
																				discountAmountSnapshot: Math.min(
																					row.discountAmountSnapshot ?? 0,
																					baseAmount,
																				),
																			};
																		}),
																	);
																}}
																className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right"
																disabled={submitting || savingDraft}
															/>
														)}
													</td>
													<td className="py-2 pr-4 text-right">
														{isLocked || draft.status !== "DRAFT" ? (
															<span className="text-slate-700">
																{formatRupiah(item.discountAmountSnapshot ?? 0)}
															</span>
														) : (
															<input
																type="number"
																min={0}
																value={item.discountAmountSnapshot ?? 0}
																onChange={(event) => {
																	const baseAmount = (item.quantity ?? 0) * (item.unitPriceSnapshot ?? 0);
																	const nextDiscount = Math.min(
																		Math.max(0, Number(event.target.value || 0)),
																		baseAmount,
																	);
																	setItems((prev) =>
																		prev.map((row, idx) =>
																			idx === index
																				? { ...row, discountAmountSnapshot: nextDiscount }
																				: row,
																		),
																	);
																}}
																className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right"
																disabled={submitting || savingDraft}
															/>
														)}
													</td>
													<td className="py-2 pr-4 text-right">
														{isLocked || draft.status !== "DRAFT" ? (
															<span className="text-slate-700">
																{formatRupiah(item.taxAmountSnapshot ?? 0)}
															</span>
														) : (
															<input
																type="number"
																min={0}
																value={item.taxAmountSnapshot ?? 0}
																onChange={(event) => {
																	const nextTax = Math.max(0, Number(event.target.value || 0));
																	setItems((prev) =>
																		prev.map((row, idx) =>
																			idx === index ? { ...row, taxAmountSnapshot: nextTax } : row,
																		),
																	);
																}}
																className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right"
																disabled={submitting || savingDraft}
															/>
														)}
													</td>
													<td className="py-2 text-right text-slate-900">
														{formatRupiah(
															(item.quantity ?? 0) * (item.unitPriceSnapshot ?? 0) -
																(item.discountAmountSnapshot ?? 0) +
																(item.taxAmountSnapshot ?? 0),
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					) : null}

					{draft ? (
						<div className="grid gap-3 md:grid-cols-4">
							<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
								<p className="text-xs uppercase tracking-wide text-slate-500">Gross</p>
								<p className="mt-2 font-semibold text-slate-900">{formatRupiah(grossTotal)}</p>
							</div>
							<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
								<p className="text-xs uppercase tracking-wide text-slate-500">Diskon</p>
								<p className="mt-2 font-semibold text-emerald-700">{formatRupiah(discountTotal)}</p>
							</div>
							<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
								<p className="text-xs uppercase tracking-wide text-slate-500">Pajak</p>
								<p className="mt-2 font-semibold text-slate-900">{formatRupiah(taxTotal)}</p>
							</div>
							<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
								<p className="text-xs uppercase tracking-wide text-slate-500">Net Invoice</p>
								<p className="mt-2 font-semibold text-slate-900">{formatRupiah(totalAmount)}</p>
							</div>
						</div>
					) : null}

					<div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
						<button
							type="button"
							onClick={onClose}
							disabled={submitting || savingDraft}
							className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Tutup
						</button>
						{invoice ? (
							<button
								type="button"
								onClick={() => onCancelInvoice(invoice)}
								disabled={
									submitting ||
									invoice.status === "PAID" ||
									invoice.status === "PARTIAL" ||
									invoice.status === "CANCELLED"
								}
								className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
							>
								Batalkan Invoice
							</button>
						) : draft ? (
							<>
								{!isLocked && draft.status === "DRAFT" ? (
									<button
										type="button"
										onClick={() => void handleSaveDraft()}
										disabled={submitting || savingDraft || items.length === 0}
										className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
									>
										{savingDraft ? "Menyimpan..." : "Simpan Draft"}
									</button>
								) : null}
								<button
									type="button"
									onClick={() => onCancelDraft(draft)}
									disabled={submitting || draft.status !== "DRAFT"}
									className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
								>
									Batal Draft
								</button>
								<button
									type="button"
									onClick={() => void handleFinalize()}
									disabled={submitting || savingDraft || draft.status !== "DRAFT"}
									className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
								>
									{submitting ? "Finalizing..." : "Finalize"}
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={() => onCreateDraft(order)}
								disabled={submitting}
								className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
							>
								{submitting ? "Membuat..." : "Buat Draft"}
							</button>
						)}
					</div>
				</div>
			) : null}
		</Modal>
	);
}
