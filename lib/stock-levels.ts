import type { StockLevel, StockLevelStatus, StockLevelWarehouse } from "@/services/warehouse-inventory";

export type StockStatus = "Aman" | "Menipis" | "Kosong";

const LABEL: Record<StockLevelStatus, StockStatus> = { OK: "Aman", LOW: "Menipis", EMPTY: "Kosong" };
const API: Record<StockStatus, StockLevelStatus> = { Aman: "OK", Menipis: "LOW", Kosong: "EMPTY" };

export const stockStatusLabel = (status: StockLevelStatus): StockStatus => LABEL[status];
export const stockStatusParam = (status: "ALL" | StockStatus): StockLevelStatus | undefined =>
	status === "ALL" ? undefined : API[status];

export interface StockRowView {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	categoryName: string;
	brandName: string;
	totalWarehouses: number;
	sellableQuantity: number;
	status: StockStatus;
	warehouseBreakdown: Array<Omit<StockLevelWarehouse, "status"> & { status: StockStatus }>;
}

export const toStockRowView = (row: StockLevel): StockRowView => ({
	id: row.productId,
	productId: row.productId,
	productName: row.productName,
	productSku: row.productCode ?? "",
	categoryName: row.categoryName ?? "-",
	brandName: row.brandName ?? "-",
	totalWarehouses: row.totalWarehouses,
	sellableQuantity: row.sellableQuantity,
	status: LABEL[row.status],
	warehouseBreakdown: row.warehouseBreakdown.map((w) => ({ ...w, status: LABEL[w.status] })),
});
