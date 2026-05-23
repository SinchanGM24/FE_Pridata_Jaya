import type { CatalogProduct } from "@/services/catalog-products";
import type { InvoiceListItem } from "@/services/invoices";
import type { OrderListItem } from "@/services/orders";
import type { StoreGradeItem } from "@/services/grade";

export interface RestockRecommendation {
	productId: string;
	productName: string;
	catalogProductId?: string;
	lastPurchasedAt?: string;
	daysSinceLastPurchase: number;
	averageIntervalDays: number;
	totalQuantity: number;
	purchaseCount: number;
	availableStock: number;
	score: number;
	reason: string;
}

export interface SalesOrderOpportunity {
	storeId: string;
	storeName: string;
	grade: StoreGradeItem["grade"];
	lastOrderAt?: string;
	daysSinceLastOrder: number;
	averageIntervalDays: number;
	averageOrderValue: number;
	outstandingAmount: number;
	creditLimit: number;
	overdueCount: number;
	score: number;
	status: "Siap follow up" | "Follow up dengan catatan" | "Tagih dulu";
	reason: string;
	suggestedProducts: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDate = (value?: string | null) => {
	const date = value ? new Date(value) : null;
	return date && Number.isFinite(date.getTime()) ? date : null;
};

const daysBetween = (left: Date, right: Date) =>
	Math.max(0, Math.floor((left.getTime() - right.getTime()) / MS_PER_DAY));

const average = (values: number[], fallback: number) =>
	values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;

const normalizeOrders = (orders: OrderListItem[]) =>
	orders
		.filter((order) => order.status !== "CANCELLED")
		.map((order) => ({ order, date: toDate(order.documentDate || order.createdAt) }))
		.filter((item): item is { order: OrderListItem; date: Date } => Boolean(item.date));

const getCatalogName = (catalog?: CatalogProduct) =>
	catalog?.marketingName || catalog?.product.name || "Produk";

export const buildRestockRecommendations = (
	orders: OrderListItem[],
	catalogProducts: CatalogProduct[],
	today = new Date(),
): RestockRecommendation[] => {
	const catalogByProductId = new Map(catalogProducts.map((item) => [item.productId, item]));
	const stats = new Map<
		string,
		{
			dates: Date[];
			totalQuantity: number;
			purchaseCount: number;
			productName: string;
		}
	>();

	for (const { order, date } of normalizeOrders(orders)) {
		for (const item of order.items ?? []) {
			const current = stats.get(item.productId) ?? {
				dates: [],
				totalQuantity: 0,
				purchaseCount: 0,
				productName: item.product?.name || item.productId,
			};
			current.dates.push(date);
			current.totalQuantity += item.quantity;
			current.purchaseCount += 1;
			current.productName = item.product?.name || current.productName;
			stats.set(item.productId, current);
		}
	}

	const recommendations = [...stats.entries()].flatMap(([productId, stat]) => {
		const catalog = catalogByProductId.get(productId);
		const availableStock = catalog?.product.stockQuantity ?? 0;
		if (!catalog || availableStock <= 0 || !stat.dates.length) return [];

		const sortedDates = [...stat.dates].sort((a, b) => a.getTime() - b.getTime());
		const intervals = sortedDates
			.slice(1)
			.map((date, index) => daysBetween(date, sortedDates[index]))
			.filter((value) => value > 0);
		const averageIntervalDays = Math.round(average(intervals, 14));
		const lastPurchasedAt = sortedDates[sortedDates.length - 1];
		const daysSinceLastPurchase = daysBetween(today, lastPurchasedAt);
		const dueRatio = daysSinceLastPurchase / Math.max(1, averageIntervalDays);
		const frequencyScore = Math.min(25, stat.purchaseCount * 5);
		const stockScore = Math.min(15, availableStock / 10);
		const score = Math.round(Math.min(100, dueRatio * 55 + frequencyScore + stockScore));
		const isDue = dueRatio >= 0.8;
		const reason = isDue
			? `Biasanya dibeli ulang sekitar ${averageIntervalDays} hari. Terakhir beli ${daysSinceLastPurchase} hari lalu.`
			: `Sering dibeli toko ini, stok tersedia ${availableStock}.`;

		return [
			{
				productId,
				catalogProductId: catalog.id,
				productName: getCatalogName(catalog),
				lastPurchasedAt: lastPurchasedAt.toISOString(),
				daysSinceLastPurchase,
				averageIntervalDays,
				totalQuantity: stat.totalQuantity,
				purchaseCount: stat.purchaseCount,
				availableStock,
				score,
				reason,
			},
		];
	});

	const recommendedProductIds = new Set(recommendations.map((item) => item.productId));
	const fallback = catalogProducts
		.filter((item) => !recommendedProductIds.has(item.productId) && (item.product.stockQuantity ?? 0) > 0)
		.sort((a, b) => (b.product.stockQuantity ?? 0) - (a.product.stockQuantity ?? 0))
		.slice(0, 4)
		.map<RestockRecommendation>((item) => ({
			productId: item.productId,
			catalogProductId: item.id,
			productName: getCatalogName(item),
			daysSinceLastPurchase: 0,
			averageIntervalDays: 14,
			totalQuantity: 0,
			purchaseCount: 0,
			availableStock: item.product.stockQuantity ?? 0,
			score: Math.min(45, item.product.stockQuantity ?? 0),
			reason: `Stok tersedia ${item.product.stockQuantity ?? 0}, cocok untuk mulai ditawarkan ulang.`,
		}));

	return [...recommendations, ...fallback]
		.sort((a, b) => b.score - a.score)
		.slice(0, 5);
};

export const buildSalesOrderOpportunities = (
	stores: StoreGradeItem[],
	orders: OrderListItem[],
	invoices: InvoiceListItem[],
	catalogProducts: CatalogProduct[],
	today = new Date(),
): SalesOrderOpportunity[] => {
	const ordersByStore = new Map<string, OrderListItem[]>();
	for (const { order } of normalizeOrders(orders)) {
		ordersByStore.set(order.storeId, [...(ordersByStore.get(order.storeId) ?? []), order]);
	}

	const catalogByProductId = new Map(catalogProducts.map((item) => [item.productId, item]));
	const invoicesByStore = new Map<string, InvoiceListItem[]>();
	for (const invoice of invoices) {
		invoicesByStore.set(invoice.storeId, [...(invoicesByStore.get(invoice.storeId) ?? []), invoice]);
	}

	return stores
		.map<SalesOrderOpportunity>((store) => {
			const storeOrders = [...(ordersByStore.get(store.storeId) ?? [])].sort(
				(a, b) =>
					(toDate(a.documentDate || a.createdAt)?.getTime() ?? 0) -
					(toDate(b.documentDate || b.createdAt)?.getTime() ?? 0),
			);
			const dates = storeOrders
				.map((order) => toDate(order.documentDate || order.createdAt))
				.filter((date): date is Date => Boolean(date));
			const intervals = dates
				.slice(1)
				.map((date, index) => daysBetween(date, dates[index]))
				.filter((value) => value > 0);
			const averageIntervalDays = Math.round(average(intervals, 14));
			const lastOrderAt = dates[dates.length - 1];
			const daysSinceLastOrder = lastOrderAt ? daysBetween(today, lastOrderAt) : 999;
			const averageOrderValue = Math.round(
				average(
					storeOrders.map((order) => order.totalAmount).filter((value) => value > 0),
					store.recentSalesAmount || store.totalSalesAmount || 0,
				),
			);
			const storeInvoices = invoicesByStore.get(store.storeId) ?? [];
			const overdueCount = storeInvoices.filter((invoice) => {
				const dueDate = toDate(invoice.dueDate);
				return invoice.remainingAmount > 0 && dueDate && dueDate.getTime() < today.getTime();
			}).length;
			const creditLimit = store.creditLimit || 0;
			const outstandingAmount = store.totalOutstandingAmount || 0;
			const creditUsage = creditLimit > 0 ? outstandingAmount / creditLimit : 0;
			const timingScore = Math.min(40, (daysSinceLastOrder / Math.max(1, averageIntervalDays)) * 40);
			const valueScore = Math.min(20, averageOrderValue / 500000);
			const activityScore = Math.min(15, storeOrders.length * 2);
			const creditScore = overdueCount > 0 ? 4 : Math.max(0, 20 - creditUsage * 20);
			const stockScore = catalogProducts.some((item) => (item.product.stockQuantity ?? 0) > 0) ? 10 : 0;
			const score = Math.round(Math.min(100, timingScore + valueScore + activityScore + creditScore + stockScore));
			const status =
				overdueCount > 0 || creditUsage >= 1
					? "Tagih dulu"
					: creditUsage >= 0.75
						? "Follow up dengan catatan"
						: "Siap follow up";

			const productStats = new Map<string, { quantity: number; count: number; name: string }>();
			for (const order of storeOrders) {
				for (const item of order.items ?? []) {
					const catalog = catalogByProductId.get(item.productId);
					if (catalog && (catalog.product.stockQuantity ?? 0) <= 0) continue;
					const current = productStats.get(item.productId) ?? {
						quantity: 0,
						count: 0,
						name: catalog ? getCatalogName(catalog) : item.product?.name || item.productId,
					};
					current.quantity += item.quantity;
					current.count += 1;
					productStats.set(item.productId, current);
				}
			}
			const suggestedProducts = [...productStats.values()]
				.sort((a, b) => b.count - a.count || b.quantity - a.quantity)
				.slice(0, 3)
				.map((item) => item.name);

			return {
				storeId: store.storeId,
				storeName: store.storeName,
				grade: store.grade,
				lastOrderAt: lastOrderAt?.toISOString(),
				daysSinceLastOrder,
				averageIntervalDays,
				averageOrderValue,
				outstandingAmount,
				creditLimit,
				overdueCount,
				score,
				status,
				reason: lastOrderAt
					? `Biasanya order sekitar ${averageIntervalDays} hari. Order terakhir ${daysSinceLastOrder} hari lalu.`
					: "Belum ada histori order, cocok untuk kunjungan aktivasi.",
				suggestedProducts,
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, 6);
};
