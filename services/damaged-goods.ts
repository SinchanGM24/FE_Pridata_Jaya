import type { ReceiptBatch } from "@/services/stock-adjustments";
import { type StoreReturnRequestItem } from "@/services/store-returns";

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

/** Baris rusak dari batch penerimaan yang sudah diurai BE (`/stock-adjustments/receipt-batches`). */
export const mapDamagedGoodsFromReceiptBatches = (batches: ReceiptBatch[]): DamagedGoodsItem[] => {
	const items: DamagedGoodsItem[] = [];

	for (const batch of batches) {
		batch.items.forEach((item, index) => {
			if (item.condition !== "DAMAGED") {
				return;
			}

			items.push({
				id: `${batch.batchId}:${item.recordId}:${index}`,
				reportNumber: `BR-${batch.batchId}`,
				reportDate: batch.receivedAt,
				source: "Penerimaan Barang",
				// Batch fallback (meta rusak, batchId `rec:<id>`): referensi null, supplier bisa null.
				referenceNumber: batch.referenceNumber ?? "",
				relatedParty: batch.supplier ?? "",
				productName: item.productName,
				quantity: item.quantity,
				damageType: "DAMAGED",
				warehouseName: batch.warehouseName,
				description: batch.note || "Barang rusak terdeteksi saat penerimaan supplier.",
			});
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
			(request.status !== "APPROVED_DAMAGED" && request.status !== "PARTIALLY_APPROVED") ||
			existingReturnReports.has(`BR-${request.requestNumber}`)
		) {
			continue;
		}

		for (const item of request.items) {
			const receivedQuantity = item.receivedQuantity ?? item.quantity;
			if (item.approvedCondition !== "DAMAGED" || receivedQuantity <= 0) {
				continue;
			}
			items.push({
				id: `return:${request.id}:${item.id}`,
				reportNumber: `BR-${request.requestNumber}`,
				reportDate: request.reviewedAt || request.submittedAt,
				source: "Retur Barang",
				referenceNumber: request.invoice?.invoiceNumber ?? request.orderId,
				relatedParty: request.store?.name ?? request.storeId,
				productName: item.productNameSnapshot,
				quantity: receivedQuantity,
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
