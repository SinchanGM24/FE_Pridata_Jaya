import {
	mapDamagedGoodsFromApprovedReturns,
	mapDamagedGoodsFromReceiptBatches,
	type DamagedGoodsItem,
} from "@/services/damaged-goods";
import { collectPaginatedItems } from "@/services/pagination";
import { stockAdjustmentsService } from "@/services/stock-adjustments";
import { storeReturnsService } from "@/services/store-returns";

export interface DamagedGoodsGroup {
	id: string;
	productName: string;
	totalQuantity: number;
	latestReportDate: string;
	sources: DamagedGoodsItem["source"][];
	warehouses: string[];
	records: DamagedGoodsItem[];
}

export const toDamagedGoodsGroupId = (productName: string) =>
	encodeURIComponent(productName.toLowerCase().trim().replace(/\s+/g, "-"));

// ponytail: masih mengumpulkan semua batch & retur rusak (dibatasi collectPaginatedItems) karena halaman
// mengelompokkan per produk lintas dua sumber; endpoint BE per produk dicatat sebagai follow-up 5.4b.
export const loadDamagedGoodsRows = async () => {
	const [batches, approvedDamagedReturns] = await Promise.all([
		collectPaginatedItems((page, limit) => stockAdjustmentsService.receiptBatches({ page, limit }), 100),
		collectPaginatedItems(
			(page, limit) =>
				storeReturnsService.list({
					status: "APPROVED_DAMAGED",
					sortBy: "submittedAt",
					sortOrder: "desc",
					page,
					limit,
				}),
			100,
		),
	]);
	const stockRows = mapDamagedGoodsFromReceiptBatches(batches);
	return [
		...stockRows,
		...mapDamagedGoodsFromApprovedReturns(approvedDamagedReturns, stockRows),
	].sort((left, right) => right.reportDate.localeCompare(left.reportDate));
};

export const groupDamagedGoodsRows = (rows: DamagedGoodsItem[]) => {
	const map = new Map<string, DamagedGoodsGroup>();

	for (const item of rows) {
		const key = toDamagedGoodsGroupId(item.productName);
		const existing = map.get(key);
		if (!existing) {
			map.set(key, {
				id: key,
				productName: item.productName,
				totalQuantity: item.quantity,
				latestReportDate: item.reportDate,
				sources: [item.source],
				warehouses: item.warehouseName ? [item.warehouseName] : [],
				records: [item],
			});
			continue;
		}

		existing.totalQuantity += item.quantity;
		existing.latestReportDate =
			item.reportDate > existing.latestReportDate ? item.reportDate : existing.latestReportDate;
		if (!existing.sources.includes(item.source)) existing.sources.push(item.source);
		if (item.warehouseName && !existing.warehouses.includes(item.warehouseName)) {
			existing.warehouses.push(item.warehouseName);
		}
		existing.records.push(item);
	}

	return Array.from(map.values())
		.map((item) => ({
			...item,
			records: item.records
				.slice()
				.sort((left, right) => right.reportDate.localeCompare(left.reportDate)),
		}))
		.sort((left, right) => right.latestReportDate.localeCompare(left.latestReportDate));
};
