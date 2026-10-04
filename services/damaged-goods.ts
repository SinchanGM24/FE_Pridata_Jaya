import apiClient from "@/lib/api-client";
import { witaDayEndIso, witaDayStartIso } from "@/lib/datetime";
import type { PaginationMeta } from "@/services/pagination";
import type { ApiResponse } from "@/types";

type PagedBody<T> = { data: T[]; meta?: PaginationMeta };

export type DamagedGoodsSource = "receipt" | "return";

export const damagedGoodsSourceLabel: Record<DamagedGoodsSource, string> = {
	receipt: "Penerimaan Barang",
	return: "Retur Barang",
};

/** Filter yang sama untuk ketiga endpoint; server menerapkannya per entri sebelum mengelompokkan. */
export interface DamagedGoodsFilters {
	source?: DamagedGoodsSource;
	/** Nama supplier/toko, persis. */
	party?: string;
	/** Instan ISO (batas hari WITA). */
	dateFrom?: string;
	dateTo?: string;
	search?: string;
	productId?: string;
}

type DamagedGoodsListParams = DamagedGoodsFilters & { page?: number; limit?: number };

/** Satu baris per produk (dikelompokkan server berdasarkan `productId`). */
export interface DamagedGoodsProduct {
	productId: string;
	productName: string;
	totalQuantity: number;
	entryCount: number;
	latestReportDate: string | null;
	sources: DamagedGoodsSource[];
	warehouses: string[];
}

export interface DamagedGoodsEntry {
	id: string;
	source: DamagedGoodsSource;
	reportNumber: string;
	reportDate: string | null;
	referenceNumber: string | null;
	relatedParty: string | null;
	productId: string;
	productName: string;
	quantity: number;
	warehouseName: string | null;
	description: string | null;
}

export interface DamagedGoodsSummary {
	totalEntries: number;
	totalUnits: number;
	receiptEntries: number;
	returnEntries: number;
	/** Opsi dropdown pihak; dihitung dengan semua filter kecuali `party`. */
	parties: string[];
}

export const damagedGoodsPeriods = ["Semua Periode", "Hari Ini", "Minggu Ini", "Bulan Ini"] as const;
export type DamagedGoodsPeriod = (typeof damagedGoodsPeriods)[number];

/**
 * Batas `dateFrom`/`dateTo` untuk pilihan periode, dalam hari WITA. `today` = `YYYY-MM-DD` WITA.
 * "Minggu Ini" = 7 hari ke belakang sampai hari ini (halaman lama: 7×24 jam terakhir).
 */
export const damagedGoodsPeriodRange = (period: DamagedGoodsPeriod, today: string) => {
	if (period === "Semua Periode") return {};
	const from =
		period === "Hari Ini"
			? today
			: period === "Bulan Ini"
				? `${today.slice(0, 8)}01`
				: new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
	return { dateFrom: witaDayStartIso(from), dateTo: witaDayEndIso(today) };
};

export const damagedGoodsService = {
	async list(params?: DamagedGoodsListParams): Promise<{ items: DamagedGoodsProduct[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PagedBody<DamagedGoodsProduct>>("/damaged-goods", { params });
		return { items: response.data.data, meta: response.data.meta };
	},

	/** Entri tunggal (baris penerimaan rusak / baris retur rusak); kirim `productId` untuk halaman detail. */
	async entries(params?: DamagedGoodsListParams): Promise<{ items: DamagedGoodsEntry[]; meta?: PaginationMeta }> {
		const response = await apiClient.get<PagedBody<DamagedGoodsEntry>>("/damaged-goods/entries", {
			params,
		});
		return { items: response.data.data, meta: response.data.meta };
	},

	/** Angka headline atas semua entri yang cocok dengan filter (tanpa paging). */
	async summary(params?: DamagedGoodsFilters): Promise<DamagedGoodsSummary> {
		const response = await apiClient.get<ApiResponse<DamagedGoodsSummary>>("/damaged-goods/summary", { params });
		return response.data.data;
	},
};
