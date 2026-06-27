import {
	mapDamagedGoods,
	mapDamagedGoodsFromApprovedReturns,
	type DamagedGoodsItem,
} from "@/services/damaged-goods";
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

export const loadDamagedGoodsRows = async () => {
	const [records, approvedDamagedReturns] = await Promise.all([
		stockAdjustmentsService.listAll({
			type: "RECEIPT",
			sortBy: "transactionDate",
			sortOrder: "desc",
		}),
		storeReturnsService.listAll({
			status: "APPROVED_DAMAGED",
			sortBy: "submittedAt",
			sortOrder: "desc",
		}),
	]);
	const stockRows = mapDamagedGoods(records);
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
