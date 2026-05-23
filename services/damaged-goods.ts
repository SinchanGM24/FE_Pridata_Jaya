import type { StockAdjustmentRecord } from "@/services/stock-adjustments";
import { parseStoreReturnReason } from "@/services/store-returns";
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

export const mapDamagedGoods = (records: StockAdjustmentRecord[]): DamagedGoodsItem[] => {
	const items: DamagedGoodsItem[] = [];

	for (const record of records) {
		const parsedReceipt = parseWarehouseReceiptReason(record.reason);
		if (parsedReceipt) {
			for (const item of record.items) {
				if (!isDamagedCondition(item.condition)) {
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
					damageType: item.condition,
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

		const quantity = record.items.reduce((sum, item) => sum + item.quantity, 0);
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
