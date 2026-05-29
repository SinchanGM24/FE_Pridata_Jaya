"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDateTime } from "@/lib/datetime";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { ordersService, type OrderListItem } from "@/services/orders";
import {
	isReturnEligibleWithin24Hours,
	storeReturnsService,
	type StoreReturnItemCondition,
	type StoreReturnRequestItem,
} from "@/services/store-returns";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const RETURN_WINDOW_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 10;

interface TokoReturnsWorkspaceProps {
	storeId: string;
	storeName: string;
	actorMode: "toko" | "sales";
}

interface DraftReturnItem {
	productId: string;
	productName: string;
	qtyPurchased: number;
	qtyReturn: string;
	condition: StoreReturnItemCondition;
}

const buildReferenceDate = (order: OrderListItem, invoice?: InvoiceListItem | null) =>
	invoice?.deliveryOrder?.status === "RECEIVED" ? invoice.deliveryOrder.receivedAt : null;

const getRemainingHours = (referenceDate?: string | null) => {
	const referenceTime = new Date(String(referenceDate || "")).getTime();
	if (Number.isNaN(referenceTime)) {
		return 0;
	}

	return Math.max(
		0,
		Math.ceil((referenceTime + RETURN_WINDOW_MS - Date.now()) / (60 * 60 * 1000)),
	);
};

const mapDraftItems = (order: OrderListItem): DraftReturnItem[] =>
	(order.items ?? []).map((item) => ({
		productId: item.productId,
		productName: item.product?.name ?? item.productId,
		qtyPurchased: item.quantity,
		qtyReturn: "0",
		condition: "DAMAGED",
	}));

const statusLabel: Record<string, string> = {
	PENDING: "Menunggu Verifikasi Gudang",
	APPROVED_GOOD: "Disetujui - Barang Bagus",
	APPROVED_DAMAGED: "Disetujui - Barang Rusak",
	REJECTED: "Ditolak",
};

const tokoConditionLabel: Record<StoreReturnItemCondition, string> = {
	DAMAGED: "Rusak",
	GOOD: "Salah Kirim / Barang Masih Bagus",
};

const getStoreReturnSubmitErrorMessage = (error: unknown) => {
	const message = getApiErrorMessage(error, "Gagal mengajukan retur toko.");

	if (
		message === "Store return can only be requested before invoice payment is recorded" ||
		message === "STORE_RETURN_REQUIRES_UNPAID_INVOICE"
	) {
		return "Retur hanya bisa diajukan sebelum pembayaran invoice dicatat.";
	}

	return message;
};

export default function TokoReturnsWorkspace({
	actorMode,
}: TokoReturnsWorkspaceProps) {
	const [orders, setOrders] = useState<OrderListItem[]>([]);
	const [invoicesByOrderId, setInvoicesByOrderId] = useState<Record<string, InvoiceListItem>>({});
	const [records, setRecords] = useState<StoreReturnRequestItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [modalError, setModalError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [eligiblePage, setEligiblePage] = useState(1);
	const [historyPage, setHistoryPage] = useState(1);
	const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null);
	const [draftItems, setDraftItems] = useState<DraftReturnItem[]>([]);
	const [generalNote, setGeneralNote] = useState("");
	const [returnReason, setReturnReason] = useState("Jelaskan alasan retur dari toko");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [orderResult, invoiceResult, returnResult] = await Promise.all([
				actorMode === "sales"
					? ordersService.listAllForSales({
							sortBy: "documentDate",
							sortOrder: "desc",
						})
					: ordersService.listAllForToko({
							sortBy: "documentDate",
							sortOrder: "desc",
						}),
				actorMode === "sales"
					? invoicesService.listAllForSales({
							sortBy: "invoiceDate",
							sortOrder: "desc",
						})
					: invoicesService.listAllForToko({
							sortBy: "invoiceDate",
							sortOrder: "desc",
						}),
				actorMode === "sales"
					? storeReturnsService.listAll({
							sortBy: "submittedAt",
							sortOrder: "desc",
						})
					: storeReturnsService.listAllForToko({
							sortBy: "submittedAt",
							sortOrder: "desc",
						}),
			]);

			setOrders(orderResult.filter((item) => item.status === "PROCESSED"));
			setInvoicesByOrderId(Object.fromEntries(invoiceResult.map((item) => [item.orderId, item])));
			setRecords(returnResult);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data retur toko."));
		} finally {
			setLoading(false);
		}
	}, [actorMode]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);

		return () => window.clearTimeout(timer);
	}, [load]);

	const existingReturnMap = useMemo(() => {
		const map = new Map<string, boolean>();
		for (const item of records) {
			if (item.status !== "REJECTED") {
				map.set(item.orderId, true);
			}
		}
		return map;
	}, [records]);

	const eligibleOrders = useMemo(() => {
		const query = search.trim().toLowerCase();
		return orders
			.map((order) => {
				const invoice = invoicesByOrderId[order.id];
				const referenceDate = buildReferenceDate(order, invoice);
				return {
					order,
					invoice,
					referenceDate,
					eligible:
						Boolean(invoice) &&
						invoice?.status === "UNPAID" &&
						(invoice?.paidAmount ?? 0) <= 0 &&
						Boolean(referenceDate) &&
						isReturnEligibleWithin24Hours(referenceDate),
					hasExistingReturn: existingReturnMap.has(order.id),
				};
			})
			.filter((item) => item.eligible)
			.filter((item) => {
				if (!query) {
					return true;
				}

				return (
					item.order.orderNumber.toLowerCase().includes(query) ||
					item.order.storeNameSnapshot.toLowerCase().includes(query)
				);
			});
	}, [existingReturnMap, invoicesByOrderId, orders, search]);

	const groupedHistory = useMemo(
		() =>
			records
				.slice()
				.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
		[records],
	);

	const eligibleTotalPages = Math.max(1, Math.ceil(eligibleOrders.length / PAGE_SIZE));
	const eligibleCurrentPage = Math.min(eligiblePage, eligibleTotalPages);
	const paginatedEligibleOrders = useMemo(() => {
		const start = (eligibleCurrentPage - 1) * PAGE_SIZE;
		return eligibleOrders.slice(start, start + PAGE_SIZE);
	}, [eligibleCurrentPage, eligibleOrders]);

	const historyTotalPages = Math.max(1, Math.ceil(groupedHistory.length / PAGE_SIZE));
	const historyCurrentPage = Math.min(historyPage, historyTotalPages);
	const paginatedHistory = useMemo(() => {
		const start = (historyCurrentPage - 1) * PAGE_SIZE;
		return groupedHistory.slice(start, start + PAGE_SIZE);
	}, [groupedHistory, historyCurrentPage]);

	const submitReturn = async () => {
		if (!selectedOrder) {
			return;
		}

		const invoice = invoicesByOrderId[selectedOrder.id];
		if (!invoice) {
			setModalError("Invoice untuk order ini belum tersedia, retur belum bisa diajukan.");
			return;
		}

		const referenceDate = buildReferenceDate(selectedOrder, invoice);
		if (!referenceDate) {
			setModalError("Retur hanya bisa diajukan setelah toko mengonfirmasi barang diterima.");
			return;
		}

		if (!isReturnEligibleWithin24Hours(referenceDate)) {
			setModalError("Batas retur 24 jam untuk transaksi ini sudah lewat.");
			return;
		}

		if (existingReturnMap.has(selectedOrder.id)) {
			setModalError("Retur untuk order ini sudah pernah diajukan dan belum ditolak.");
			return;
		}

		if (invoice.status !== "UNPAID" || invoice.paidAmount > 0) {
			setModalError("Retur hanya bisa diajukan sebelum pembayaran invoice dicatat.");
			return;
		}

		const pickedItems = draftItems
			.map((item) => ({
				...item,
				quantity: Math.max(0, Math.floor(Number(item.qtyReturn) || 0)),
			}))
			.filter((item) => item.quantity > 0);

		if (pickedItems.length === 0) {
			setModalError("Pilih minimal satu item dengan qty retur lebih dari 0.");
			return;
		}

		for (const item of pickedItems) {
			if (item.quantity > item.qtyPurchased) {
				setModalError(`Qty retur ${item.productName} melebihi qty beli.`);
				return;
			}
		}

		setSubmitting(true);
		setModalError("");
		setSuccess("");

		try {
			await storeReturnsService.createForToko({
				invoiceId: invoice.id,
				reason: returnReason.trim(),
				note: generalNote.trim() || undefined,
				items: pickedItems.map((item) => ({
					productId: item.productId,
					quantity: item.quantity,
					requestedCondition: item.condition,
				})),
			});

			setSuccess("Pengajuan retur berhasil dikirim dan menunggu verifikasi gudang.");
			setSelectedOrder(null);
			setDraftItems([]);
			setGeneralNote("");
			await load();
		} catch (submitError: unknown) {
			setModalError(getStoreReturnSubmitErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Transaksi Eligible Retur</h2>
						<p className="mt-1 text-sm text-slate-600">
							Hanya transaksi yang sudah punya invoice, masih berada dalam jendela 24 jam,
							dan belum punya retur aktif.
						</p>
					</div>
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:w-72"
						placeholder="Cari nomor order"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setEligiblePage(1);
						}}
					/>
				</div>
				<div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Order</th>
								<th className="px-4 py-3">Tanggal Referensi</th>
								<th className="px-4 py-3 text-right">Nilai Invoice</th>
								<th className="px-4 py-3">Sisa Waktu</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td colSpan={5} className="px-4 py-4 text-slate-600">
										Memuat transaksi retur...
									</td>
								</tr>
							) : eligibleOrders.length === 0 ? (
								<tr>
									<td colSpan={5} className="px-4 py-4 text-slate-600">
										Tidak ada transaksi yang masih eligible retur.
									</td>
								</tr>
							) : (
								paginatedEligibleOrders.map(({ order, invoice, referenceDate, hasExistingReturn }) => (
									<tr key={order.id}>
										<td className="px-4 py-3">
											<div className="font-medium text-slate-900">{order.orderNumber}</div>
											<div className="text-xs text-slate-500">{order.storeNameSnapshot}</div>
										</td>
										<td className="px-4 py-3 text-slate-700">{formatAppDateTime(referenceDate)}</td>
										<td className="px-4 py-3 text-right text-slate-900">
											{formatRupiah(invoice?.totalAmount ?? order.totalAmount)}
										</td>
										<td className="px-4 py-3 text-amber-700">
											{getRemainingHours(referenceDate)} jam
										</td>
										<td className="px-4 py-3 text-right">
											<button
												type="button"
												disabled={hasExistingReturn}
												onClick={() => {
													setSelectedOrder(order);
													setDraftItems(mapDraftItems(order));
													setGeneralNote("");
													setModalError("");
													setReturnReason("Jelaskan alasan retur dari toko");
												}}
												className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
											>
												{hasExistingReturn ? "Sudah Diajukan" : "Ajukan Retur"}
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				<div className="mt-3 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
					<p>
						Halaman {eligibleCurrentPage} dari {eligibleTotalPages}
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setEligiblePage((value) => Math.max(1, value - 1))}
							disabled={eligibleCurrentPage <= 1}
							className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<button
							type="button"
							onClick={() => setEligiblePage((value) => Math.min(eligibleTotalPages, value + 1))}
							disabled={eligibleCurrentPage >= eligibleTotalPages}
							className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="font-semibold text-slate-900">Riwayat Pengajuan Retur</h2>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">No Request</th>
							<th className="px-4 py-3">Invoice</th>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Item</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Potong Piutang</th>
							<th className="px-4 py-3">Catatan</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Memuat riwayat retur...
								</td>
							</tr>
						) : groupedHistory.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-4 py-4 text-slate-600">
									Belum ada pengajuan retur.
								</td>
							</tr>
						) : (
							paginatedHistory.map((request) => (
								<tr key={request.id}>
									<td className="px-4 py-3 font-medium text-slate-900">
										{request.requestNumber}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{request.invoice?.invoiceNumber ?? request.invoiceId}
									</td>
									<td className="px-4 py-3 text-slate-700">{formatAppDateTime(request.submittedAt)}</td>
									<td className="px-4 py-3 text-slate-700">{request.items.length} item</td>
									<td className="px-4 py-3 text-slate-700">
										<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
											{statusLabel[request.status] ?? request.status}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{formatRupiah(request.receivableAdjustmentAmount)}
									</td>
									<td className="px-4 py-3 text-xs text-slate-500">
										{request.reviewNote || request.note || "-"}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
				<div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
					<p>
						Halaman {historyCurrentPage} dari {historyTotalPages}
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setHistoryPage((value) => Math.max(1, value - 1))}
							disabled={historyCurrentPage <= 1}
							className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<button
							type="button"
							onClick={() => setHistoryPage((value) => Math.min(historyTotalPages, value + 1))}
							disabled={historyCurrentPage >= historyTotalPages}
							className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</section>

			<Modal
				isOpen={Boolean(selectedOrder)}
				onClose={() => {
					setSelectedOrder(null);
					setDraftItems([]);
					setModalError("");
				}}
				title="Ajukan Retur Toko"
			>
				{selectedOrder ? (
					<div className="space-y-4">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
							<p className="font-semibold text-slate-900">{selectedOrder.orderNumber}</p>
							<p className="mt-1">
								Batas retur:{" "}
								{getRemainingHours(
									buildReferenceDate(selectedOrder, invoicesByOrderId[selectedOrder.id]),
								)}{" "}
								jam lagi
							</p>
						</div>
						<label className="block space-y-2 text-sm text-slate-700">
							<span>Alasan Umum</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={returnReason}
								onChange={(event) => setReturnReason(event.target.value)}
								placeholder="Contoh: barang rusak saat diterima, atau salah kirim ukuran/jenis"
							/>
						</label>
						<label className="block space-y-2 text-sm text-slate-700">
							<span>Catatan Umum</span>
							<textarea
								className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2"
								value={generalNote}
								onChange={(event) => setGeneralNote(event.target.value)}
							/>
						</label>
						<div className="overflow-hidden rounded-xl border border-slate-200">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
									<tr>
										<th className="px-3 py-2">Barang</th>
										<th className="px-3 py-2">Qty Beli</th>
										<th className="px-3 py-2">Qty Retur</th>
										<th className="px-3 py-2">Klasifikasi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{draftItems.map((item, index) => (
										<tr key={`${item.productId}-${index}`}>
											<td className="px-3 py-2 text-slate-700">{item.productName}</td>
											<td className="px-3 py-2 text-slate-700">{item.qtyPurchased}</td>
											<td className="px-3 py-2">
												<input
													type="number"
													min={0}
													max={item.qtyPurchased}
													className="w-20 rounded-lg border border-slate-300 px-2 py-1"
													value={item.qtyReturn}
													onChange={(event) =>
														setDraftItems((current) =>
															current.map((row, rowIndex) =>
																rowIndex === index
																	? { ...row, qtyReturn: event.target.value }
																	: row,
															),
														)
													}
												/>
											</td>
											<td className="px-3 py-2">
												<select
													className="rounded-lg border border-slate-300 px-2 py-1"
													value={item.condition}
													onChange={(event) =>
														setDraftItems((current) =>
															current.map((row, rowIndex) =>
																rowIndex === index
																	? {
																			...row,
																			condition: event.target.value as StoreReturnItemCondition,
																		}
																	: row,
															),
														)
													}
												>
													<option value="DAMAGED">{tokoConditionLabel.DAMAGED}</option>
													<option value="GOOD">{tokoConditionLabel.GOOD}</option>
												</select>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{modalError ? (
							<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								{modalError}
							</div>
						) : null}
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setSelectedOrder(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => void submitReturn()}
								disabled={submitting}
								className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
							>
								{submitting ? "Mengirim..." : "Kirim Pengajuan"}
							</button>
						</div>
					</div>
				) : null}
			</Modal>
		</>
	);
}
