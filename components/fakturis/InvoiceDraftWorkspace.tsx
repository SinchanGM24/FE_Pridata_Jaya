"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	invoiceDraftsService,
	type InvoiceDraftDetail,
	type InvoiceDraftListItem,
} from "@/services/invoice-drafts";
import type { InvoiceListItem } from "@/services/invoices";
import type { OrderListItem } from "@/services/orders";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof (error as { response?: unknown }).response === "object" &&
		(error as { response?: { data?: { message?: string } } }).response?.data?.message
	) {
		return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
	}
	return fallback;
};

interface InvoiceDraftWorkspaceProps {
	order: OrderListItem;
	draft?: InvoiceDraftListItem | null;
	invoice?: InvoiceListItem | null;
	dueDate: string;
	notes: string;
	submitting?: boolean;
	onDueDateChange: (value: string) => void;
	onNotesChange: (value: string) => void;
	onBack: () => void;
	onCreateDraft: (order: OrderListItem) => void;
	onFinalizeDraft: (draft: InvoiceDraftListItem, order: OrderListItem) => void;
	onCancelDraft: (draft: InvoiceDraftListItem) => void;
	onCancelInvoice: (invoice: InvoiceListItem) => void;
}

export default function InvoiceDraftWorkspace({
	order,
	draft,
	invoice,
	dueDate,
	notes,
	submitting = false,
	onDueDateChange,
	onNotesChange,
	onBack,
	onCreateDraft,
	onFinalizeDraft,
	onCancelDraft,
	onCancelInvoice,
}: InvoiceDraftWorkspaceProps) {
	const isLocked = Boolean(invoice) || (draft ? draft.status !== "DRAFT" : false);
	const [items, setItems] = useState<InvoiceDraftDetail["items"]>([]);
	const [loadingDraft, setLoadingDraft] = useState(Boolean(draft?.id));
	const [draftError, setDraftError] = useState("");
	const [savingDraft, setSavingDraft] = useState(false);

	useEffect(() => {
		if (!draft?.id) return;

		let mounted = true;
		invoiceDraftsService
			.getById(draft.id)
			.then((res) => {
				if (!mounted) return;
				setItems(res.items ?? []);
				if (!dueDate && res.dueDate) {
					onDueDateChange(String(res.dueDate).slice(0, 10));
				}
				if (!notes && res.notes) {
					onNotesChange(res.notes);
				}
			})
			.catch((error: unknown) => {
				if (!mounted) return;
				setDraftError(getErrorMessage(error, "Gagal memuat detail draft."));
			})
			.finally(() => {
				if (!mounted) return;
				setLoadingDraft(false);
			});

		return () => {
			mounted = false;
		};
	}, [draft?.id, dueDate, notes, onDueDateChange, onNotesChange]);

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
		if (!draft?.id) return false;
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
			setDraftError(getErrorMessage(error, "Gagal menyimpan draft."));
			return false;
		} finally {
			setSavingDraft(false);
		}
	};

	const handleFinalize = async () => {
		if (!draft) return;
		if (!isLocked && draft.status === "DRAFT" && items.length > 0) {
			const ok = await handleSaveDraft();
			if (!ok) return;
		}
		onFinalizeDraft(draft, order);
	};

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-2">
						<button
							type="button"
							onClick={onBack}
							className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
						>
							← Kembali ke daftar invoice
						</button>
						<div>
							<h2 className="text-2xl font-semibold text-slate-950">Workspace Invoice Fakturis</h2>
							<p className="mt-1 max-w-3xl text-sm text-slate-600">
								Alur ini mengikuti gaya kerja `FE1`: pesanan masuk dibuka ke halaman invoice penuh,
								kuantitas bisa disesuaikan, lalu hasil final akan tercatat di riwayat transaksi dan siap
								ditindaklanjuti gudang dari menu pengiriman.
							</p>
						</div>
					</div>

					<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 lg:max-w-sm">
						<p className="font-semibold">Status hilir BE2 tetap dijaga</p>
						<p className="mt-1">
							Order diproses lewat status resmi `PROCESSED`, invoice dibuat dari draft resmi, dan gudang
							melanjutkan dari invoice final melalui delivery order.
						</p>
					</div>
				</div>

				<div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
					<div className="grid gap-4 md:grid-cols-2">
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Order</p>
							<p className="mt-2 text-lg font-semibold text-slate-900">{order.orderNumber}</p>
							<p className="mt-1 text-sm text-slate-500">Tanggal {dateOnly(order.documentDate)}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Toko</p>
							<p className="mt-2 text-lg font-semibold text-slate-900">{order.storeNameSnapshot}</p>
							<p className="mt-1 text-sm text-slate-500">Status order {order.status}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nilai Pesanan</p>
							<p className="mt-2 text-lg font-semibold text-slate-900">{formatRupiah(order.totalAmount)}</p>
							<p className="mt-1 text-sm text-slate-500">Bisa disesuaikan saat menyusun draft invoice.</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan Order</p>
							<p className="mt-2 text-sm font-medium text-slate-900">{order.notes || "-"}</p>
						</div>
					</div>

					<div className="rounded-2xl border border-slate-200 p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
							Status Dokumen
						</p>
						{invoice ? (
							<div className="mt-3 space-y-1">
								<p className="text-lg font-semibold text-slate-900">{invoice.invoiceNumber}</p>
								<p className="text-sm text-slate-600">
									Invoice final dengan status {invoice.status}. Jatuh tempo {dateOnly(invoice.dueDate)}.
								</p>
								<Link
									href="/fakturis/riwayat-transaksi"
									className="inline-flex text-sm font-medium text-slate-900 underline underline-offset-4"
								>
									Buka riwayat transaksi
								</Link>
							</div>
						) : draft ? (
							<div className="mt-3 space-y-1">
								<p className="text-lg font-semibold text-slate-900">{draft.draftNumber}</p>
								<p className="text-sm text-slate-600">
									Draft aktif dengan status {draft.status}. Jatuh tempo {dateOnly(draft.dueDate)}.
								</p>
							</div>
						) : (
							<p className="mt-3 text-sm text-slate-600">
								Belum ada draft. Buat draft untuk mulai menyesuaikan item invoice.
							</p>
						)}
						{isLocked ? (
							<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
								Dokumen sudah terkunci. Perubahan item dan nilai tidak bisa dilakukan lagi dari workspace
								ini.
							</div>
						) : null}
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="grid gap-4 lg:grid-cols-2">
					<label className="space-y-2">
						<span className="text-sm font-medium text-slate-900">Jatuh Tempo</span>
						<input
							type="date"
							className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
							value={dueDate}
							onChange={(event) => onDueDateChange(event.target.value)}
							disabled={submitting || isLocked || savingDraft}
						/>
					</label>
					<label className="space-y-2">
						<span className="text-sm font-medium text-slate-900">Catatan Invoice</span>
						<textarea
							className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							placeholder="Catatan untuk invoice / gudang / penagihan"
							disabled={submitting || isLocked || savingDraft}
						/>
					</label>
				</div>

				{draftError ? (
					<div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{draftError}
					</div>
				) : null}

				{draft ? (
					<div className="mt-6 rounded-2xl border border-slate-200">
						<div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
									Item Invoice
								</p>
								<p className="mt-1 text-sm text-slate-600">
									Sesuaikan qty, harga, diskon, dan pajak sebelum invoice difinalisasi.
								</p>
							</div>
							<p className="text-sm font-semibold text-slate-900">Net {formatRupiah(totalAmount)}</p>
						</div>

						{loadingDraft ? (
							<p className="px-4 py-4 text-sm text-slate-500">Memuat item draft...</p>
						) : items.length === 0 ? (
							<p className="px-4 py-4 text-sm text-slate-500">Belum ada item.</p>
						) : (
							<div className="overflow-x-auto">
								<table className="min-w-full text-sm">
									<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
										<tr>
											<th className="px-4 py-3">Produk</th>
											<th className="px-4 py-3">Kondisi</th>
											<th className="px-4 py-3 text-right">Qty</th>
											<th className="px-4 py-3 text-right">Harga</th>
											<th className="px-4 py-3 text-right">Diskon</th>
											<th className="px-4 py-3 text-right">Pajak</th>
											<th className="px-4 py-3 text-right">Subtotal</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{items.map((item, index) => (
											<tr key={item.id}>
												<td className="px-4 py-3 font-medium text-slate-900">
													{item.productNameSnapshot}
												</td>
												<td className="px-4 py-3 text-slate-700">{item.condition}</td>
												<td className="px-4 py-3 text-right">
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
															className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right"
															disabled={submitting || savingDraft}
														/>
													)}
												</td>
												<td className="px-4 py-3 text-right">
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
															className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right"
															disabled={submitting || savingDraft}
														/>
													)}
												</td>
												<td className="px-4 py-3 text-right">
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
															className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right"
															disabled={submitting || savingDraft}
														/>
													)}
												</td>
												<td className="px-4 py-3 text-right">
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
															className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right"
															disabled={submitting || savingDraft}
														/>
													)}
												</td>
												<td className="px-4 py-3 text-right font-medium text-slate-900">
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
					<div className="mt-6 grid gap-3 md:grid-cols-4">
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Gross</p>
							<p className="mt-2 font-semibold text-slate-900">{formatRupiah(grossTotal)}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Diskon</p>
							<p className="mt-2 font-semibold text-emerald-700">{formatRupiah(discountTotal)}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pajak</p>
							<p className="mt-2 font-semibold text-slate-900">{formatRupiah(taxTotal)}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Net Invoice</p>
							<p className="mt-2 font-semibold text-slate-900">{formatRupiah(totalAmount)}</p>
						</div>
					</div>
				) : null}

				<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
					<p className="text-sm text-slate-500">
						Setelah finalisasi, invoice akan muncul di{" "}
						<Link href="/fakturis/riwayat-transaksi" className="font-medium text-slate-900 underline">
							Riwayat Transaksi
						</Link>{" "}
						dan bisa diteruskan gudang dari menu `Pengiriman`.
					</p>

					<div className="flex flex-wrap justify-end gap-2">
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
								className="rounded-xl border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
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
										className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
									>
										{savingDraft ? "Menyimpan..." : "Simpan Draft"}
									</button>
								) : null}
								<button
									type="button"
									onClick={() => onCancelDraft(draft)}
									disabled={submitting || draft.status !== "DRAFT"}
									className="rounded-xl border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
								>
									Tolak / Batal Draft
								</button>
								<button
									type="button"
									onClick={() => void handleFinalize()}
									disabled={submitting || savingDraft || draft.status !== "DRAFT"}
									className="rounded-xl bg-slate-950 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
								>
									{submitting ? "Memfinalisasi..." : "Terima dan Finalisasi"}
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={() => onCreateDraft(order)}
								disabled={submitting}
								className="rounded-xl bg-slate-950 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
							>
								{submitting ? "Membuat..." : "Mulai Draft Invoice"}
							</button>
						)}
					</div>
				</div>
			</section>
		</div>
	);
}
