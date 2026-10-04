export interface WarehouseReceiptMeta {
	batchId: string;
	referenceNumber: string;
	supplier: string;
	warehouseId: string;
	receivedAt: string;
}

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

/** Gabungkan baris item satu dokumen per produk: diterima, bagus, rusak. */
export const aggregateReceiptItems = (items: Array<{ productName: string; condition: string; quantity: number }>) => {
	const grouped = new Map<string, { productName: string; receivedQuantity: number; goodQuantity: number; damagedQuantity: number }>();
	for (const item of items) {
		const row = grouped.get(item.productName) ?? { productName: item.productName, receivedQuantity: 0, goodQuantity: 0, damagedQuantity: 0 };
		row.receivedQuantity += item.quantity;
		if (item.condition === "DAMAGED") row.damagedQuantity += item.quantity;
		else row.goodQuantity += item.quantity;
		grouped.set(item.productName, row);
	}
	return Array.from(grouped.values()).sort((a, b) => a.productName.localeCompare(b.productName, "id"));
};
