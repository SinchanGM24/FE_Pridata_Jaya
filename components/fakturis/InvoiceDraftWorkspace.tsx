"use client";

import { useEffect, useMemo, useState } from "react";
import AddInvoiceItemModal from "@/components/fakturis/AddInvoiceItemModal";
import DeleteInvoiceItemConfirmModal from "@/components/fakturis/DeleteInvoiceItemConfirmModal";
import FinalizeInvoiceConfirmModal from "@/components/fakturis/FinalizeInvoiceConfirmModal";
import { invoiceDraftStatusLabel, invoiceStatusLabel, toUiLabel } from "@/lib/ui-labels";
import { catalogProductsService, type CatalogProduct } from "@/services/catalog-products";
import {
	invoiceDraftsService,
	type InvoiceDraftDetail,
	type InvoiceDraftListItem,
} from "@/services/invoice-drafts";
import type { InvoiceListItem } from "@/services/invoices";
import type { OrderListItem } from "@/services/orders";
import { warehouseInventoryService } from "@/services/warehouse-inventory";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "-");

const clampPercent = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

const formatPercentValue = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

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

type LocalInvoiceItem = InvoiceDraftDetail["items"][number] & {
	isNew?: boolean;
	clientId?: string;
	discountPercent?: string;
};

type RemovedItemHistory = {
	item: LocalInvoiceItem;
	index: number;
};

const getItemDiscountPercent = (item: LocalInvoiceItem) => clampPercent(Number(item.discountPercent ?? 0));

const calculateLineAmounts = (item: LocalInvoiceItem, globalDiscountPercent: number, taxPercent: number) => {
	const quantity = Math.max(1, Math.floor(item.quantity || 1));
	const unitPriceSnapshot = Math.max(0, Math.floor(item.unitPriceSnapshot || 0));
	const grossAmount = quantity * unitPriceSnapshot;
	const itemDiscountAmount = Math.min(
		grossAmount,
		Math.round((grossAmount * getItemDiscountPercent(item)) / 100),
	);
	const afterItemDiscount = Math.max(0, grossAmount - itemDiscountAmount);
	const globalDiscountAmount = Math.min(
		afterItemDiscount,
		Math.round((afterItemDiscount * globalDiscountPercent) / 100),
	);
	const discountAmountSnapshot = itemDiscountAmount + globalDiscountAmount;
	const taxableAmount = Math.max(0, afterItemDiscount - globalDiscountAmount);
	const taxAmountSnapshot = Math.round((taxableAmount * taxPercent) / 100);
	const subtotal = taxableAmount + taxAmountSnapshot;

	return {
		quantity,
		unitPriceSnapshot,
		grossAmount,
		itemDiscountAmount,
		globalDiscountAmount,
		discountAmountSnapshot,
		taxAmountSnapshot,
		subtotal,
	};
};

interface InvoiceDraftWorkspaceProps {
	order: OrderListItem;
	draft?: InvoiceDraftListItem | null;
	invoice?: InvoiceListItem | null;
	notes: string;
	submitting?: boolean;
	onNotesChange: (value: string) => void;
	onBack: () => void;
	onFinalizeDraft: (draft: InvoiceDraftListItem, order: OrderListItem) => void;
	onCancelInvoice: (invoice: InvoiceListItem) => void;
}

export default function InvoiceDraftWorkspace({
	order,
	draft,
	invoice,
	notes,
	submitting = false,
	onNotesChange,
	onBack,
	onFinalizeDraft,
	onCancelInvoice,
}: InvoiceDraftWorkspaceProps) {
	const isLocked = Boolean(invoice) || (draft ? draft.status !== "DRAFT" : false);
	const canMutateDraft = Boolean(draft && draft.status === "DRAFT" && !isLocked);
	const [items, setItems] = useState<LocalInvoiceItem[]>([]);
	const [loadingDraft, setLoadingDraft] = useState(Boolean(draft?.id));
	const [draftError, setDraftError] = useState("");
	const [savingDraft, setSavingDraft] = useState(false);
	const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
	const [loadingCatalog, setLoadingCatalog] = useState(true);
	const [addItemOpen, setAddItemOpen] = useState(false);
	const [addItemSearch, setAddItemSearch] = useState("");
	const [selectedProductId, setSelectedProductId] = useState("");
	const [addQuantity, setAddQuantity] = useState("1");
	const [stockHints, setStockHints] = useState<Record<string, Partial<Record<"GOOD", number>>>>({});
	const [deleteTarget, setDeleteTarget] = useState<RemovedItemHistory | null>(null);
	const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
	const [removedItemsHistory, setRemovedItemsHistory] = useState<RemovedItemHistory[]>([]);
	const [removedPersistedItemIds, setRemovedPersistedItemIds] = useState<string[]>([]);
	const [globalDiscountPercent, setGlobalDiscountPercent] = useState("0");
	const [globalTaxPercent, setGlobalTaxPercent] = useState("0");

	const discountPercent = useMemo(() => clampPercent(Number(globalDiscountPercent)), [globalDiscountPercent]);
	const taxPercent = useMemo(() => clampPercent(Number(globalTaxPercent)), [globalTaxPercent]);

	useEffect(() => {
		if (!draft?.id) return;

		let mounted = true;
		invoiceDraftsService
			.getById(draft.id)
			.then((res) => {
				if (!mounted) return;
				const loadedItems = (res.items ?? []).map((item) => {
					const grossAmount =
						Math.max(1, Math.floor(item.quantity || 1)) * Math.max(0, Math.floor(item.unitPriceSnapshot || 0));
					const discountPercent =
						grossAmount > 0 ? formatPercentValue(((item.discountAmountSnapshot ?? 0) / grossAmount) * 100) : "0";
					return { ...item, discountPercent, isNew: false };
				});
				const grossAmount = loadedItems.reduce(
					(sum, item) => sum + Math.max(1, Math.floor(item.quantity || 1)) * Math.max(0, Math.floor(item.unitPriceSnapshot || 0)),
					0,
				);
				const discountAmount = loadedItems.reduce((sum, item) => sum + (item.discountAmountSnapshot ?? 0), 0);
				const taxableAmount = Math.max(0, grossAmount - discountAmount);
				const taxAmount = loadedItems.reduce((sum, item) => sum + (item.taxAmountSnapshot ?? 0), 0);

				setItems(loadedItems);
				setGlobalDiscountPercent("0");
				setGlobalTaxPercent(taxableAmount > 0 ? formatPercentValue((taxAmount / taxableAmount) * 100) : "0");
				setRemovedItemsHistory([]);
				setRemovedPersistedItemIds([]);
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
	}, [draft?.id, notes, onNotesChange]);

	useEffect(() => {
		let mounted = true;
		Promise.all([
			catalogProductsService.listAllPublished({ sortBy: "marketingName", sortOrder: "asc" }),
			warehouseInventoryService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
		])
			.then(([catalogRows, inventoryRows]) => {
				if (!mounted) return;
				setCatalogProducts(catalogRows);
				const nextHints: Record<string, Partial<Record<"GOOD", number>>> = {};
				inventoryRows
					.filter(
						(row) =>
							row.warehouseId === order.sourceWarehouseId &&
							row.condition === "GOOD",
					)
					.forEach((row) => {
						const current = nextHints[row.productId] ?? {};
						current[row.condition as "GOOD"] = row.quantity;
						nextHints[row.productId] = current;
					});
				setStockHints(nextHints);
			})
			.catch(() => {
				if (!mounted) return;
				setCatalogProducts([]);
				setStockHints({});
			})
			.finally(() => {
				if (!mounted) return;
				setLoadingCatalog(false);
			});

		return () => {
			mounted = false;
		};
	}, [order.sourceWarehouseId]);

	const totalAmount = useMemo(
		() => items.reduce((sum, item) => sum + calculateLineAmounts(item, discountPercent, taxPercent).subtotal, 0),
		[discountPercent, items, taxPercent],
	);

	const taxTotal = useMemo(
		() =>
			items.reduce(
				(sum, item) => sum + calculateLineAmounts(item, discountPercent, taxPercent).taxAmountSnapshot,
				0,
			),
		[discountPercent, items, taxPercent],
	);

	const itemDiscountTotal = useMemo(
		() =>
			items.reduce(
				(sum, item) => sum + calculateLineAmounts(item, discountPercent, taxPercent).itemDiscountAmount,
				0,
			),
		[discountPercent, items, taxPercent],
	);

	const globalDiscountTotal = useMemo(
		() =>
			items.reduce(
				(sum, item) => sum + calculateLineAmounts(item, discountPercent, taxPercent).globalDiscountAmount,
				0,
			),
		[discountPercent, items, taxPercent],
	);

	const grossTotal = useMemo(
		() =>
			items.reduce(
				(sum, item) => sum + (item.quantity ?? 0) * (item.unitPriceSnapshot ?? 0),
				0,
			),
		[items],
	);

	const filteredCatalogProducts = useMemo(() => {
		const keyword = addItemSearch.trim().toLowerCase();
		const existingProductIds = new Set(items.map((item) => item.productId));
		return catalogProducts.filter((product) => {
			const matchesSearch =
				!keyword ||
				product.marketingName.toLowerCase().includes(keyword) ||
				product.product.name.toLowerCase().includes(keyword);
			return matchesSearch && !existingProductIds.has(product.productId);
		});
	}, [addItemSearch, catalogProducts, items]);

	const resolveSellableCondition = (productId: string): "GOOD" => {
		const hints = stockHints[productId];
		if ((hints?.GOOD ?? 0) > 0) {
			return "GOOD";
		}
		return "GOOD";
	};

	const resolvedSelectedProductId = useMemo(() => {
		if (!filteredCatalogProducts.length) return "";
		const stillAvailable = filteredCatalogProducts.some((product) => product.productId === selectedProductId);
		return stillAvailable ? selectedProductId : filteredCatalogProducts[0].productId;
	}, [filteredCatalogProducts, selectedProductId]);

	const handleSaveDraft = async () => {
		if (!draft?.id) return false;
		setSavingDraft(true);
		setDraftError("");
		try {
			const payload: Parameters<typeof invoiceDraftsService.update>[1] = {};
			const existingItems = items.filter((item) => !item.isNew);
			const newItems = items.filter((item) => item.isNew);

			if (existingItems.length > 0) {
				payload.items = existingItems.map((item) => {
					const quantity = Math.max(1, Math.floor(item.quantity || 1));
					const { unitPriceSnapshot, discountAmountSnapshot, taxAmountSnapshot } = calculateLineAmounts(
						item,
						discountPercent,
						taxPercent,
					);
					return {
						id: item.id,
						quantity,
						unitPriceSnapshot,
						discountAmountSnapshot,
						taxAmountSnapshot,
					};
				});
			}

			if (newItems.length > 0) {
				payload.itemsToAdd = newItems.map((item) => {
					const { quantity, unitPriceSnapshot, discountAmountSnapshot, taxAmountSnapshot } =
						calculateLineAmounts(item, discountPercent, taxPercent);
					return {
						productId: item.productId,
						condition: item.condition as "GOOD",
						quantity,
						unitPriceSnapshot,
						discountAmountSnapshot,
						taxAmountSnapshot,
					};
				});
			}

			if (removedPersistedItemIds.length > 0) {
				payload.itemIdsToRemove = removedPersistedItemIds;
			}

			if (notes.trim()) payload.notes = notes.trim();
			const updated = await invoiceDraftsService.update(draft.id, payload);
			setItems((updated.items ?? []).map((item) => ({ ...item, isNew: false })));
			setRemovedPersistedItemIds([]);
			setRemovedItemsHistory([]);
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
		if (canMutateDraft && items.length > 0) {
			const ok = await handleSaveDraft();
			if (!ok) return;
		}
		onFinalizeDraft(draft, order);
	};

	const handleSaveDraftAndBack = async () => {
		const ok = await handleSaveDraft();
		if (ok) onBack();
	};

	const openFinalizeConfirmation = () => {
		setConfirmStep(1);
		setConfirmOpen(true);
	};

	const openAddItemModal = () => {
		setAddItemSearch("");
		setAddQuantity("1");
		if (filteredCatalogProducts[0]) {
			setSelectedProductId(filteredCatalogProducts[0].productId);
		}
		setAddItemOpen(true);
	};

	const handleConfirmAddItem = () => {
		const selectedProduct = catalogProducts.find((product) => product.productId === resolvedSelectedProductId);
		const quantity = Math.max(1, Number(addQuantity || 1));
		const resolvedCondition = resolveSellableCondition(resolvedSelectedProductId);

		if (!selectedProduct) {
			setDraftError("Pilih barang dari katalog aktif terlebih dahulu.");
			return;
		}

		const duplicate = items.some((item) => item.productId === selectedProduct.productId);
		if (duplicate) {
			setDraftError("Barang tersebut sudah ada di draft invoice.");
			return;
		}

		setItems((prev) => [
			...prev,
			{
				id: `temp-${Date.now()}-${selectedProduct.productId}-${resolvedCondition}`,
				clientId: `temp-${Date.now()}`,
				orderItemId: null,
				productId: selectedProduct.productId,
				productNameSnapshot: selectedProduct.product.name || selectedProduct.marketingName,
				condition: resolvedCondition,
				quantity,
				unitPriceSnapshot: selectedProduct.sellingPrice,
				discountAmountSnapshot: 0,
				taxAmountSnapshot: 0,
				subtotal: quantity * selectedProduct.sellingPrice,
				discountPercent: "0",
				isNew: true,
			},
		]);
		setDraftError("");
		setAddItemOpen(false);
	};

	const openDeleteConfirm = (item: LocalInvoiceItem, index: number) => {
		setDeleteTarget({ item, index });
		setDeleteStep(1);
	};

	const handleConfirmDeleteItem = () => {
		if (!deleteTarget) return;
		setItems((prev) => prev.filter((_, index) => index !== deleteTarget.index));
		if (!deleteTarget.item.isNew) {
			setRemovedPersistedItemIds((prev) =>
				prev.includes(deleteTarget.item.id) ? prev : [...prev, deleteTarget.item.id],
			);
		}
		setRemovedItemsHistory((prev) => [...prev, deleteTarget]);
		setDeleteTarget(null);
		setDeleteStep(1);
	};

	const handleUndoDelete = () => {
		if (!removedItemsHistory.length) return;
		const restoreTarget = removedItemsHistory[removedItemsHistory.length - 1];
		setItems((prev) => {
			const next = [...prev];
			const index = Math.min(restoreTarget.index, next.length);
			next.splice(index, 0, restoreTarget.item);
			return next;
		});
		if (!restoreTarget.item.isNew) {
			setRemovedPersistedItemIds((prev) => prev.filter((id) => id !== restoreTarget.item.id));
		}
		setRemovedItemsHistory((prev) => prev.slice(0, -1));
	};

	const updateItemAt = (index: number, updater: (item: LocalInvoiceItem) => LocalInvoiceItem) => {
		setItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)));
	};

	return (
		<div className="space-y-4">
			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<button
						type="button"
						onClick={onBack}
						className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
					>
						&lt; Kembali
					</button>
					{invoice ? (
						<span className="text-sm text-slate-600">
							{invoice.invoiceNumber} · {toUiLabel(invoice.status, invoiceStatusLabel)}
						</span>
					) : draft ? (
						<span className="text-sm text-slate-600">
							{draft.draftNumber} · {toUiLabel(draft.status, invoiceDraftStatusLabel)}
						</span>
					) : (
						<span className="text-sm text-slate-600">Belum ada draft invoice</span>
					)}
				</div>

				<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
					<p className="text-sm text-slate-700">
						<span className="font-semibold">No. Order:</span> {order.orderNumber}
					</p>
					<p className="text-sm text-slate-700">
						<span className="font-semibold">Toko:</span> {order.storeNameSnapshot}
					</p>
					<p className="text-sm text-slate-700">
						<span className="font-semibold">Tanggal Order:</span> {dateOnly(order.documentDate)}
					</p>
					<p className="text-sm text-slate-700">
						<span className="font-semibold">Nilai Pesanan:</span> {formatRupiah(order.totalAmount)}
					</p>
					{order.notes ? (
						<p className="text-sm text-slate-700 md:col-span-2">
							<span className="font-semibold">Catatan Order:</span> {order.notes}
						</p>
					) : null}
				</div>

				{isLocked ? (
					<div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
						Dokumen sudah terkunci. Perubahan item dan nilai tidak bisa dilakukan lagi.
					</div>
				) : null}
			</section>

			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label className="mb-1 block text-xs font-semibold text-slate-600">Nomor Dokumen</label>
						<input
							readOnly
							value={invoice?.invoiceNumber ?? draft?.draftNumber ?? "-"}
							className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs font-semibold text-slate-600">Status Dokumen</label>
						<input
							readOnly
							value={
								invoice
									? toUiLabel(invoice.status, invoiceStatusLabel)
									: draft
										? toUiLabel(draft.status, invoiceDraftStatusLabel)
										: "Belum dibuat"
							}
							className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
						/>
					</div>
					<div className="md:col-span-2">
						<label className="mb-1 block text-xs font-semibold text-slate-600">Catatan Invoice</label>
						<textarea
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							placeholder="Catatan untuk invoice / gudang / penagihan"
							disabled={submitting || isLocked || savingDraft}
							className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
						/>
					</div>
				</div>

				{draftError ? (
					<div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{draftError}
					</div>
				) : null}
			</section>

			<section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="font-semibold text-slate-800">Daftar Barang Invoice</h3>
					<div className="flex items-center gap-2">
						{canMutateDraft ? (
							<button
								type="button"
								onClick={openAddItemModal}
								disabled={loadingCatalog}
								className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
							>
								{loadingCatalog ? "Memuat katalog..." : "Tambah Item"}
							</button>
						) : null}
						{removedItemsHistory.length > 0 && canMutateDraft ? (
							<button
								type="button"
								onClick={handleUndoDelete}
								className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700"
							>
								Undo Hapus ({removedItemsHistory.length})
							</button>
						) : null}
					</div>
				</div>

				{draft ? (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-slate-50 text-left text-xs text-slate-500">
								<tr>
									<th className="px-3 py-2">Nama Barang</th>
									<th className="px-3 py-2">Jumlah</th>
									<th className="px-3 py-2">Harga</th>
									<th className="px-3 py-2">Diskon Item (%)</th>
									<th className="px-3 py-2">Total</th>
									<th className="px-3 py-2">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{loadingDraft ? (
									<tr>
										<td colSpan={6} className="px-3 py-4 text-slate-500">
											Memuat detail draft...
										</td>
									</tr>
								) : items.length === 0 ? (
									<tr>
										<td colSpan={6} className="px-3 py-4 text-slate-500">
											Belum ada item pada draft invoice.
										</td>
									</tr>
								) : (
									items.map((item, index) => {
										const { subtotal } = calculateLineAmounts(item, discountPercent, taxPercent);
										return (
											<tr key={item.clientId ?? item.id} className={item.isNew ? "bg-emerald-50/50" : ""}>
												<td className="px-3 py-2 text-slate-800">
													<div className="font-medium">{item.productNameSnapshot}</div>
													{item.isNew ? (
														<div className="text-[11px] text-emerald-700">Item tambahan baru</div>
													) : null}
												</td>
												<td className="px-3 py-2">
													{canMutateDraft ? (
														<input
															type="number"
															min={1}
															value={item.quantity}
															onChange={(event) => {
																const nextQty = Math.max(1, Number(event.target.value || 1));
																updateItemAt(index, (row) => ({ ...row, quantity: nextQty }));
															}}
															className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
															disabled={submitting || savingDraft}
														/>
													) : (
														<span className="text-slate-700">{item.quantity}</span>
													)}
												</td>
												<td className="px-3 py-2">
													<span className="text-slate-700">{formatRupiah(item.unitPriceSnapshot)}</span>
												</td>
												<td className="px-3 py-2">
													{canMutateDraft ? (
														<input
															type="number"
															min={0}
															max={100}
															step="0.01"
															value={item.discountPercent ?? "0"}
															onChange={(event) => {
																const nextDiscount = event.target.value;
																updateItemAt(index, (row) => ({ ...row, discountPercent: nextDiscount }));
															}}
															className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
															disabled={submitting || savingDraft}
														/>
													) : (
														<span className="text-emerald-700">
															{formatPercentValue(getItemDiscountPercent(item))}%
														</span>
													)}
												</td>
												<td className="px-3 py-2 text-slate-700">{formatRupiah(subtotal)}</td>
												<td className="px-3 py-2">
													{canMutateDraft ? (
														<button
															type="button"
															onClick={() => openDeleteConfirm(item, index)}
															className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700"
														>
															Hapus
														</button>
													) : (
														<span className="text-slate-400">Terkunci</span>
													)}
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				) : (
					<div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
						Draft invoice sedang disiapkan otomatis.
					</div>
				)}

				{draft ? (
					<div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
						<div>
							<label className="mb-1 block text-xs font-semibold text-slate-600">Diskon Invoice (%)</label>
							<input
								type="number"
								min={0}
								max={100}
								step="0.01"
								value={globalDiscountPercent}
								onChange={(event) => setGlobalDiscountPercent(event.target.value)}
								disabled={submitting || isLocked || savingDraft}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
							/>
						</div>
						<div>
							<label className="mb-1 block text-xs font-semibold text-slate-600">Pajak Invoice (%)</label>
							<input
								type="number"
								min={0}
								max={100}
								step="0.01"
								value={globalTaxPercent}
								onChange={(event) => setGlobalTaxPercent(event.target.value)}
								disabled={submitting || isLocked || savingDraft}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
							/>
						</div>
					</div>
				) : null}

				{draft ? (
					<div className="grid grid-cols-1 gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-5">
						<div>
							<p className="text-xs text-slate-500">Subtotal</p>
							<p className="font-semibold text-slate-700">{formatRupiah(grossTotal)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Diskon Item</p>
							<p className="font-semibold text-emerald-700">-{formatRupiah(itemDiscountTotal)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Diskon Invoice ({formatPercentValue(discountPercent)}%)</p>
							<p className="font-semibold text-emerald-700">-{formatRupiah(globalDiscountTotal)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Pajak ({formatPercentValue(taxPercent)}%)</p>
							<p className="font-semibold text-slate-700">{formatRupiah(taxTotal)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Total Akhir</p>
							<p className="font-semibold text-slate-800">{formatRupiah(totalAmount)}</p>
						</div>
					</div>
				) : null}

				<div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
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
							className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
						>
							Batalkan Invoice
						</button>
					) : draft ? (
						<>
							{canMutateDraft ? (
								<button
									type="button"
									onClick={() => void handleSaveDraftAndBack()}
									disabled={submitting || savingDraft || items.length === 0}
									className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
								>
									{savingDraft ? "Menyimpan..." : "Simpan Draft"}
								</button>
							) : null}
							<button
								type="button"
								onClick={openFinalizeConfirmation}
								disabled={submitting || savingDraft || draft.status !== "DRAFT"}
								className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
							>
								{submitting ? "Memfinalisasi..." : "Kirim ke Gudang"}
							</button>
						</>
					) : null}
				</div>
			</section>

			<AddInvoiceItemModal
				isOpen={addItemOpen}
				search={addItemSearch}
				selectedProductId={resolvedSelectedProductId}
				quantity={addQuantity}
				filteredProducts={filteredCatalogProducts}
				onClose={() => setAddItemOpen(false)}
				onSearchChange={setAddItemSearch}
				onSelectProductId={setSelectedProductId}
				onQuantityChange={setAddQuantity}
				onConfirm={handleConfirmAddItem}
			/>

			<DeleteInvoiceItemConfirmModal
				isOpen={Boolean(deleteTarget)}
				step={deleteStep}
				productName={deleteTarget?.item.productNameSnapshot}
				onClose={() => {
					setDeleteTarget(null);
					setDeleteStep(1);
				}}
				onNext={() => setDeleteStep(2)}
				onConfirm={handleConfirmDeleteItem}
			/>

			<FinalizeInvoiceConfirmModal
				isOpen={confirmOpen}
				step={confirmStep}
				draftNumber={draft?.draftNumber}
				storeName={order.storeNameSnapshot}
				itemCount={items.length}
				totalAmount={totalAmount}
				onClose={() => {
					setConfirmOpen(false);
					setConfirmStep(1);
				}}
				onNext={() => setConfirmStep(2)}
				onConfirm={() => {
					setConfirmOpen(false);
					setConfirmStep(1);
					void handleFinalize();
				}}
			/>
		</div>
	);
}
