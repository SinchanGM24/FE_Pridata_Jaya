import type { StockAdjustmentRecord } from "@/services/stock-adjustments";

export interface WarehouseReceiptMeta {
	batchId: string;
	referenceNumber: string;
	supplier: string;
	warehouseId: string;
	receivedAt: string;
}

export interface WarehouseReceiptLine {
	record: StockAdjustmentRecord;
	meta: WarehouseReceiptMeta;
	note: string;
}

export interface WarehouseReceiptBatch {
	batchId: string;
	referenceNumber: string;
	supplier: string;
	warehouseId: string;
	warehouseName: string;
	receivedAt: string;
	note: string;
	items: Array<{
		recordId: string;
		productName: string;
		condition: string;
		quantity: number;
	}>;
	totalItems: number;
	totalDamaged: number;
}

const countUniqueProducts = (items: WarehouseReceiptBatch["items"]) =>
	new Set(items.map((item) => item.productName)).size;

const RECEIPT_PREFIX = "[WAREHOUSE_RECEIPT]";

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const buildWarehouseReceiptReason = (meta: WarehouseReceiptMeta, note: string) => {
	const payload = JSON.stringify(meta);
	return `${RECEIPT_PREFIX}${payload} ${normalizeWhitespace(note)}`.trim();
};

export const parseWarehouseReceiptReason = (reason?: string | null) => {
	const rawReason = String(reason || "");
	if (!rawReason.startsWith(RECEIPT_PREFIX)) {
		return null;
	}

	const payloadStart = RECEIPT_PREFIX.length;
	const payloadEnd = rawReason.indexOf("}", payloadStart);
	if (payloadEnd === -1) {
		return null;
	}

	try {
		const meta = JSON.parse(rawReason.slice(payloadStart, payloadEnd + 1)) as WarehouseReceiptMeta;
		if (
			!meta?.batchId ||
			!meta?.referenceNumber ||
			!meta?.supplier ||
			!meta?.warehouseId ||
			!meta?.receivedAt
		) {
			return null;
		}

		return {
			meta,
			note: rawReason.slice(payloadEnd + 1).trim(),
		};
	} catch {
		return null;
	}
};

export const mapWarehouseReceiptLines = (records: StockAdjustmentRecord[]) =>
	records
		.map((record) => {
			const parsed = parseWarehouseReceiptReason(record.reason);
			if (!parsed) {
				return null;
			}

			return {
				record,
				meta: parsed.meta,
				note: parsed.note,
			} satisfies WarehouseReceiptLine;
		})
		.filter((item): item is WarehouseReceiptLine => item !== null);

export const groupWarehouseReceiptBatches = (records: StockAdjustmentRecord[]) => {
	const grouped = new Map<string, WarehouseReceiptBatch>();

	for (const line of mapWarehouseReceiptLines(records)) {
		const existing = grouped.get(line.meta.batchId);
		const items = line.record.items.map((item) => ({
			recordId: line.record.id,
			productName: line.record.product?.name ?? line.record.productId,
			condition: item.condition ?? item.toCondition ?? item.fromCondition ?? "-",
			quantity: item.quantity,
		}));

		if (!existing) {
			grouped.set(line.meta.batchId, {
				batchId: line.meta.batchId,
				referenceNumber: line.meta.referenceNumber,
				supplier: line.meta.supplier,
				warehouseId: line.meta.warehouseId,
				warehouseName: line.record.warehouse?.name ?? line.meta.warehouseId,
				receivedAt: line.meta.receivedAt,
				note: line.note,
				items,
				totalItems: countUniqueProducts(items),
				totalDamaged: items
					.filter((item) => item.condition === "DAMAGED" || item.condition === "DAMAGED")
					.reduce((sum, item) => sum + item.quantity, 0),
			});
			continue;
		}

		existing.items.push(...items);
		existing.totalItems = countUniqueProducts(existing.items);
		existing.totalDamaged += items
			.filter((item) => item.condition === "DAMAGED" || item.condition === "DAMAGED")
			.reduce((sum, item) => sum + item.quantity, 0);
	}

	return Array.from(grouped.values()).sort((left, right) =>
		right.receivedAt.localeCompare(left.receivedAt),
	);
};
