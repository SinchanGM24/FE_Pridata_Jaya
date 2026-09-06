"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import QuantityStepper from "@/components/shared/QuantityStepper";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDateTime } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import type { StatusTone } from "@/lib/ui-labels";
import { deliveryOrdersService } from "@/services/delivery-orders";
import { invoicesService, type InvoiceListItem } from "@/services/invoices";
import { meService } from "@/services/me";
import { ordersService, type OrderListItem } from "@/services/orders";
import { salesService } from "@/services/sales";
import {
	isReturnEligibleWithin24Hours,
	storeReturnsService,
	type StoreReturnItemCondition,
	type StoreReturnRequestItem,
} from "@/services/store-returns";

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
	qtyGood: string;
	qtyDamaged: string;
}

const buildReferenceDate = (_order: OrderListItem, invoice?: InvoiceListItem | null) =>
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
		productName: item.product?.name ?? "Produk",
		qtyPurchased: item.quantity,
		qtyGood: "0",
		qtyDamaged: "0",
	}));

const attachDeliveryOrdersToInvoices = async (
	invoices: InvoiceListItem[],
	actorMode: TokoReturnsWorkspaceProps["actorMode"],
) => {
	const enriched = await Promise.all(
		invoices.map(async (invoice) => {
			if (invoice.deliveryOrder) return invoice;
			try {
				const deliveryOrder =
					actorMode === "toko"
						? await deliveryOrdersService.getByInvoiceIdForToko(invoice.id)
						: await deliveryOrdersService.getByInvoiceId(invoice.id);
				return {
					...invoice,
					deliveryOrder: {
						id: deliveryOrder.id,
						deliveryOrderNumber: deliveryOrder.deliveryOrderNumber,
						status: deliveryOrder.status,
						receivedAt: deliveryOrder.receivedAt ?? null,
						receiptNotes: deliveryOrder.receiptNotes ?? null,
						shipments: deliveryOrder.shipments,
					},
				} satisfies InvoiceListItem;
			} catch {
				return invoice;
			}
		}),
	);

	return enriched;
};

const statusLabel: Record<string, string> = {
	PENDING: "Menunggu Verifikasi Gudang",
	APPROVED_GOOD: "Disetujui - Barang Bagus",
	APPROVED_DAMAGED: "Disetujui - Barang Rusak",
	REJECTED: "Ditolak",
};

const statusToneByReturn: Record<string, StatusTone> = {
	PENDING: "warning",
	APPROVED_GOOD: "success",
	APPROVED_DAMAGED: "success",
	REJECTED: "danger",
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
		return "Retur sekarang mengikuti waktu penerimaan barang. Muat ulang halaman lalu coba lagi.";
	}

	if (
		message === "Store return can only be requested after goods are received" ||
		message === "STORE_RETURN_REQUIRES_RECEIVED_DELIVERY"
	) {
		return "Retur hanya bisa diajukan setelah toko mengonfirmasi barang diterima.";
	}

	if (message === "Store return request window has expired" || message === "STORE_RETURN_WINDOW_EXPIRED") {
		return "Batas pengajuan retur 24 jam sejak barang diterima sudah lewat.";
	}

	return message;
};

export default function TokoReturnsWorkspace({
	actorMode,
	storeId,
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
	const [selectedReturn, setSelectedReturn] = useState<StoreReturnRequestItem | null>(null);
	const [draftItems, setDraftItems] = useState<DraftReturnItem[]>([]);
	const [generalNote, setGeneralNote] = useState("");
	const [returnReason, setReturnReason] = useState("");
	const [storeType, setStoreType] = useState<"RETAILER" | "WHOLESALER" | "DISTRIBUTOR">("RETAILER");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [orderResult, invoiceResult, returnResult, storeProfile] = await Promise.all([
				actorMode === "sales"
					? ordersService.listAllForSales({
							storeId,
							sortBy: "documentDate",
							sortOrder: "desc",
						})
					: ordersService.listAllForToko({
							sortBy: "documentDate",
							sortOrder: "desc",
						}),
				actorMode === "sales"
					? invoicesService.listAllForSales({
							storeId,
							sortBy: "invoiceDate",
							sortOrder: "desc",
						})
					: invoicesService.listAllForToko({
							sortBy: "invoiceDate",
							sortOrder: "desc",
						}),
				actorMode === "sales"
					? storeReturnsService.listAllForSales({
							storeId,
							sortBy: "submittedAt",
							sortOrder: "desc",
						})
					: storeReturnsService.listAllForToko({
							sortBy: "submittedAt",
							sortOrder: "desc",
						}),
				actorMode === "sales"
					? salesService.getManagedStoreById(storeId).catch(() => null)
					: meService.getProfile().catch(() => null),
			]);

			const enrichedInvoices = await attachDeliveryOrdersToInvoices(invoiceResult, actorMode);

			setOrders(orderResult.filter((item) => item.status === "PROCESSED"));
			setInvoicesByOrderId(Object.fromEntries(enrichedInvoices.map((item) => [item.orderId, item])));
			setRecords(returnResult);
			const resolvedStoreType =
				storeProfile && "storeType" in storeProfile
					? storeProfile.storeType
					: storeProfile && "store" in storeProfile
						? storeProfile.store?.storeType
						: undefined;
			setStoreType(
				resolvedStoreType === "WHOLESALER" || resolvedStoreType === "DISTRIBUTOR"
					? resolvedStoreType
					: "RETAILER",
			);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data retur toko."));
		} finally {
			setLoading(false);
		}
	}, [actorMode, storeId]);

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
						invoice?.status !== "CANCELLED" &&
						Boolean(referenceDate) &&
						(storeType !== "RETAILER" || isReturnEligibleWithin24Hours(referenceDate)),
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
	}, [existingReturnMap, invoicesByOrderId, orders, search, storeType]);

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

		if (storeType === "RETAILER" && !isReturnEligibleWithin24Hours(referenceDate)) {
			setModalError("Batas retur 24 jam untuk transaksi ini sudah lewat.");
			return;
		}

		if (existingReturnMap.has(selectedOrder.id)) {
			setModalError("Retur untuk order ini sudah pernah diajukan dan belum ditolak.");
			return;
		}

		const pickedItems = draftItems
			.flatMap((item) => [
				{
					...item,
					quantity: Math.max(0, Math.floor(Number(item.qtyGood) || 0)),
					condition: "GOOD" as const,
				},
				{
					...item,
					quantity: Math.max(0, Math.floor(Number(item.qtyDamaged) || 0)),
					condition: "DAMAGED" as const,
				},
			])
			.filter((item) => item.quantity > 0);

		if (pickedItems.length === 0) {
			setModalError("Pilih minimal satu item dengan qty retur lebih dari 0.");
			return;
		}

		// Sebelumnya field ini di-default ke kalimat instruksi, jadi tidak pernah
		// kosong — dan setiap retur yang tidak ditimpa terkirim beralasan
		// "Jelaskan alasan retur dari toko". Sekarang kosong, jadi harus dijaga.
		if (!returnReason.trim()) {
			setModalError("Isi alasan retur terlebih dahulu.");
			return;
		}

		for (const item of draftItems) {
			const totalReturn =
				Math.max(0, Math.floor(Number(item.qtyGood) || 0)) +
				Math.max(0, Math.floor(Number(item.qtyDamaged) || 0));
			if (totalReturn > item.qtyPurchased) {
				setModalError(`Total qty retur ${item.productName} melebihi qty beli.`);
				return;
			}
		}

		setSubmitting(true);
		setModalError("");
		setSuccess("");

		try {
			const payload = {
				invoiceId: invoice.id,
				reason: returnReason.trim(),
				note: generalNote.trim() || undefined,
				items: pickedItems.map((item) => ({
					productId: item.productId,
					quantity: item.quantity,
					requestedCondition: item.condition,
				})),
			};
			if (actorMode === "sales") {
				await storeReturnsService.createForSales({
					storeId,
					...payload,
				});
			} else {
				await storeReturnsService.createForToko(payload);
			}

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

	const eligibleColumns: ResponsiveColumn<(typeof paginatedEligibleOrders)[number]>[] = [
		{
			key: "order",
			head: "Order",
			role: "title",
			render: ({ order }) => (
				<span className="block">
					<span className="block font-medium text-slate-900">{order.orderNumber}</span>
					<span className="block text-xs text-slate-500">{order.storeNameSnapshot}</span>
				</span>
			),
		},
		{
			key: "window",
			head: "Ketentuan Retur",
			role: "status",
			render: ({ referenceDate }) => (
				<Badge tone={storeType === "RETAILER" ? "warning" : "neutral"}>
					{storeType === "RETAILER"
						? `${getRemainingHours(referenceDate)} jam tersisa`
						: "Tanpa batas 24 jam"}
				</Badge>
			),
		},
		{
			key: "amount",
			head: "Nilai Invoice",
			role: "amount",
			align: "right",
			render: ({ invoice, order }) => formatRupiah(invoice?.totalAmount ?? order.totalAmount),
		},
		{
			key: "referenceDate",
			head: "Tanggal Referensi",
			render: ({ referenceDate }) => formatAppDateTime(referenceDate),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: ({ order, hasExistingReturn }) => (
				<Button
					variant="danger"
					size="sm"
					disabled={hasExistingReturn}
					onClick={() => {
						setSelectedOrder(order);
						setDraftItems(mapDraftItems(order));
						setGeneralNote("");
						setModalError("");
						setReturnReason("Jelaskan alasan retur dari toko");
					}}
				>
					{hasExistingReturn ? "Sudah Diajukan" : "Ajukan Retur"}
				</Button>
			),
		},
	];

	const historyColumns: ResponsiveColumn<StoreReturnRequestItem>[] = [
		{ key: "requestNumber", head: "No Request", role: "title" },
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (request) => (
				<Badge tone={statusToneByReturn[request.status] ?? "neutral"}>
					{statusLabel[request.status] ?? request.status}
				</Badge>
			),
		},
		{ key: "invoice", head: "Invoice", render: (request) => request.invoice?.invoiceNumber ?? "-" },
		{
			key: "submittedAt",
			head: "Tanggal",
			render: (request) => formatAppDateTime(request.submittedAt),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (request) => (
				<Button variant="secondary" size="sm" onClick={() => setSelectedReturn(request)}>
					Detail
				</Button>
			),
		},
	];

	const returnItemColumns: ResponsiveColumn<StoreReturnRequestItem["items"][number]>[] = [
		{ key: "productNameSnapshot", head: "Barang", role: "title" },
		{ key: "quantity", head: "Qty", role: "amount", align: "right" },
		{
			key: "requestedCondition",
			head: "Klasifikasi",
			render: (item) => tokoConditionLabel[item.requestedCondition] ?? item.requestedCondition,
		},
	];

	return (
		<>
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Transaksi Eligible Retur</h2>
						<p className="mt-1 text-sm text-slate-600">
							Transaksi harus sudah diterima dan belum punya retur aktif. Batas 24 jam hanya
							berlaku untuk toko retail.
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
				<div className="mt-4">
					<ResponsiveTable
						columns={eligibleColumns}
						data={paginatedEligibleOrders}
						getRowKey={({ order }) => order.id}
						loading={loading}
						emptyText="Tidak ada transaksi yang masih eligible retur"
						emptyDescription="Retur hanya bisa diajukan untuk pesanan yang masih dalam masa ketentuan."
					/>
				</div>
				<PaginationControls
					currentPage={eligibleCurrentPage}
					totalPages={eligibleTotalPages}
					totalItems={eligibleOrders.length}
					currentItemCount={paginatedEligibleOrders.length}
					pageSize={PAGE_SIZE}
					itemLabel="pesanan"
					onPageChange={setEligiblePage}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="text-base font-semibold text-slate-900 sm:text-lg">
					Riwayat Pengajuan Retur
				</h2>
				<ResponsiveTable
					columns={historyColumns}
					data={paginatedHistory}
					getRowKey={(request) => request.id}
					loading={loading}
					onRowClick={(request) => setSelectedReturn(request)}
					emptyText="Belum ada pengajuan retur"
					emptyDescription="Pengajuan yang Anda kirim akan muncul di sini beserta statusnya."
				/>
				<div className="rounded-2xl border border-slate-200 bg-white">
				<PaginationControls
					currentPage={historyCurrentPage}
					totalPages={historyTotalPages}
					totalItems={groupedHistory.length}
					currentItemCount={paginatedHistory.length}
					pageSize={PAGE_SIZE}
					itemLabel="retur"
					onPageChange={setHistoryPage}
					/>
				</div>
			</section>

			<Modal
				isOpen={Boolean(selectedReturn)}
				onClose={() => setSelectedReturn(null)}
				title="Detail Retur"
				maxWidthClassName="max-w-4xl"
			>
				{selectedReturn ? (
					<div className="space-y-5 text-sm text-slate-700">
						<div className="grid gap-3 md:grid-cols-2">
							{[
								{ label: "No Request", value: selectedReturn.requestNumber ?? "-" },
								{ label: "Invoice", value: selectedReturn.invoice?.invoiceNumber ?? "-" },
								{ label: "Tanggal Pengajuan", value: formatAppDateTime(selectedReturn.submittedAt) },
								{ label: "Status", value: statusLabel[selectedReturn.status] ?? selectedReturn.status },
								{
									label: "Potong Piutang",
									value: formatRupiah(selectedReturn.receivableAdjustmentAmount),
								},
								{ label: "Jumlah Item", value: `${selectedReturn.items.length} item` },
							].map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
										{item.label}
									</p>
									<p className="mt-2 font-semibold text-slate-900">{item.value}</p>
								</div>
							))}
						</div>

						<ResponsiveTable
							columns={returnItemColumns}
							data={selectedReturn.items}
							getRowKey={(item) => item.id}
							emptyText="Tidak ada barang pada retur ini"
						/>

						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
									Alasan Retur
								</p>
								<p className="mt-2 whitespace-pre-wrap text-slate-700">{selectedReturn.reason || "-"}</p>
							</div>
							<div className="rounded-xl border border-slate-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
									Catatan Review
								</p>
								<p className="mt-2 whitespace-pre-wrap text-slate-700">
									{selectedReturn.reviewNote || selectedReturn.note || "-"}
								</p>
							</div>
						</div>
					</div>
				) : null}
			</Modal>

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
								{storeType === "RETAILER"
									? `Batas retur: ${getRemainingHours(
											buildReferenceDate(selectedOrder, invoicesByOrderId[selectedOrder.id]),
										)} jam lagi`
									: "Toko non-retail tidak dibatasi jendela retur 24 jam."}
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
						{/*
						 * Empat kolom dengan dua input angka per baris tidak muat di HP.
						 * Tiap barang jadi kartu dengan stepper berlabel.
						 */}
						<ul className="space-y-3">
							{draftItems.map((item, index) => (
								<li
									key={`${item.productId}-${index}`}
									className="rounded-xl border border-slate-200 bg-white p-3"
								>
									<div className="flex items-start justify-between gap-3">
										<p className="min-w-0 text-sm font-semibold text-slate-900">
											{item.productName}
										</p>
										<span className="shrink-0 text-xs text-slate-500">
											Beli {item.qtyPurchased}
										</span>
									</div>
									<div className="mt-3 grid gap-3 sm:grid-cols-2">
										<label className="space-y-1.5">
											<span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
												Qty baik / salah kirim
											</span>
											<QuantityStepper
												label="Qty baik atau salah kirim"
												min={0}
												max={item.qtyPurchased}
												value={Number(item.qtyGood) || 0}
												onChange={(next) =>
													setDraftItems((current) =>
														current.map((row, rowIndex) =>
															rowIndex === index ? { ...row, qtyGood: String(next) } : row,
														),
													)
												}
											/>
										</label>
										<label className="space-y-1.5">
											<span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
												Qty rusak
											</span>
											<QuantityStepper
												label="Qty rusak"
												min={0}
												max={item.qtyPurchased}
												value={Number(item.qtyDamaged) || 0}
												onChange={(next) =>
													setDraftItems((current) =>
														current.map((row, rowIndex) =>
															rowIndex === index ? { ...row, qtyDamaged: String(next) } : row,
														),
													)
												}
											/>
										</label>
									</div>
								</li>
							))}
						</ul>
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
