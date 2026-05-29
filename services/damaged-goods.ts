import type { StockAdjustmentRecord } from "@/services/stock-adjustments";
import { parseStoreReturnReason, type StoreReturnRequestItem } from "@/services/store-returns";
import { parseWarehouseReceiptReason } from "@/services/warehouse-receipts";

export type DamagedGoodsSource = "Penerimaan Barang" | "Retur Barang";

export interface DamagedGoodsItem {
	id: string;
	reportNumber: string;
	reportDate: string;
	source: DamagedGoodsSource;
	referenceNumber: string;
	relatedParty: string;
	productName: string;
	quantity: number;
	damageType: "DAMAGED";
	warehouseName: string;
	description: string;
}

const isDamagedCondition = (value?: string | null): value is "DAMAGED" =>
	value === "DAMAGED";

const resolveIncomingCondition = (item: StockAdjustmentRecord["items"][number]) =>
	item.condition ?? item.toCondition ?? null;

export const mapDamagedGoods = (records: StockAdjustmentRecord[]): DamagedGoodsItem[] => {
	const items: DamagedGoodsItem[] = [];

	for (const record of records) {
		const parsedReceipt = parseWarehouseReceiptReason(record.reason);
		if (parsedReceipt) {
			for (const item of record.items) {
				const condition = resolveIncomingCondition(item);
				if (!isDamagedCondition(condition)) {
					continue;
				}

				items.push({
					id: `${record.id}:${item.id}`,
					reportNumber: `BR-${parsedReceipt.meta.batchId}`,
					reportDate: parsedReceipt.meta.receivedAt || record.transactionDate,
					source: "Penerimaan Barang",
					referenceNumber: parsedReceipt.meta.referenceNumber,
					relatedParty: parsedReceipt.meta.supplier,
					productName: record.product?.name ?? record.productId,
					quantity: item.quantity,
					damageType: condition,
					warehouseName: record.warehouse?.name ?? parsedReceipt.meta.warehouseId,
					description: parsedReceipt.note || "Barang rusak terdeteksi saat penerimaan supplier.",
				});
			}
			continue;
		}

		const parsedReturn = parseStoreReturnReason(record.reason);
		if (!parsedReturn || parsedReturn.meta.status !== "APPROVED_DAMAGED") {
			continue;
		}

		const quantity = record.items.reduce((sum, item) => {
			const condition = resolveIncomingCondition(item);
			return isDamagedCondition(condition) ? sum + item.quantity : sum;
		}, 0);
		if (quantity <= 0) {
			continue;
		}

		items.push({
			id: `${record.id}:return`,
			reportNumber: `BR-${parsedReturn.meta.requestNumber}`,
			reportDate: parsedReturn.meta.submittedAt || record.transactionDate,
			source: "Retur Barang",
			referenceNumber: parsedReturn.meta.orderNumber,
			relatedParty: parsedReturn.meta.storeName,
			productName: record.product?.name ?? record.productId,
			quantity,
			damageType: "DAMAGED",
			warehouseName: record.warehouse?.name ?? record.warehouseId,
			description:
				parsedReturn.meta.verificationNote ||
				parsedReturn.note ||
				"Barang retur diverifikasi rusak oleh gudang.",
		});
	}

	return items.sort((left, right) => right.reportDate.localeCompare(left.reportDate));
};

export const mapDamagedGoodsFromApprovedReturns = (
	requests: StoreReturnRequestItem[],
	existingRows: DamagedGoodsItem[] = [],
): DamagedGoodsItem[] => {
	const existingReturnReports = new Set(
		existingRows
			.filter((item) => item.source === "Retur Barang")
			.map((item) => item.reportNumber),
	);

	const items: DamagedGoodsItem[] = [];

	for (const request of requests) {
		if (
			request.status !== "APPROVED_DAMAGED" ||
			request.approvedCondition !== "DAMAGED" ||
			existingReturnReports.has(`BR-${request.requestNumber}`)
		) {
			continue;
		}

		for (const item of request.items) {
			items.push({
				id: `return:${request.id}:${item.id}`,
				reportNumber: `BR-${request.requestNumber}`,
				reportDate: request.reviewedAt || request.submittedAt,
				source: "Retur Barang",
				referenceNumber: request.invoice?.invoiceNumber ?? request.orderId,
				relatedParty: request.store?.name ?? request.storeId,
				productName: item.productNameSnapshot,
				quantity: item.quantity,
				damageType: "DAMAGED",
				warehouseName: request.sourceWarehouse?.name ?? request.sourceWarehouseId,
				description:
					request.reviewNote ||
					request.note ||
					"Barang retur diverifikasi rusak oleh gudang.",
			});
		}
	}

	return items;
};
