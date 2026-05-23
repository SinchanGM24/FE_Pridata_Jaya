import type { CatalogProduct } from "@/services/catalog-products";
import {
	getProductImage,
	getProductPrice,
	normalizeSellableCartCondition,
	readStoreScopedCart,
	writeStoreScopedCart,
} from "@/services/toko-cart";

export interface SalesTokoCartItem {
	catalogProductId?: string;
	productId: string;
	productName: string;
	condition: "GOOD";
	quantity: number;
	unitPriceSnapshot: number;
	imageUrl?: string;
}

export interface SalesActingStoreProfile {
	storeId: string;
	storeName: string;
	salesName: string;
}

const SALES_STORE_CONTEXT_KEY = "fe2:sales_store_context";

let salesActingStoreProfile: SalesActingStoreProfile | null = null;

export const setSalesActingStoreProfile = (profile: SalesActingStoreProfile | null) => {
	salesActingStoreProfile = profile;
	if (typeof window === "undefined") return;
	if (!profile) {
		sessionStorage.removeItem(SALES_STORE_CONTEXT_KEY);
		return;
	}
	sessionStorage.setItem(SALES_STORE_CONTEXT_KEY, JSON.stringify(profile));
};

export const getSalesActingStoreProfile = (): SalesActingStoreProfile | null => {
	if (salesActingStoreProfile?.storeId && salesActingStoreProfile?.storeName) {
		return salesActingStoreProfile;
	}

	if (typeof window === "undefined") return null;

	try {
		const raw = sessionStorage.getItem(SALES_STORE_CONTEXT_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as SalesActingStoreProfile;
		if (!parsed?.storeId || !parsed?.storeName) {
			return null;
		}
		salesActingStoreProfile = parsed;
		return parsed;
	} catch {
		return null;
	}
};

export const readSalesTokoCart = (storeId: string): SalesTokoCartItem[] => {
	if (!storeId) return [];
	return readStoreScopedCart(storeId).map((item) => normalizeSellableCartCondition(item));
};

export const writeSalesTokoCart = (storeId: string, items: SalesTokoCartItem[]) => {
	if (!storeId) return;
	writeStoreScopedCart(storeId, items);
};

export const clearSalesTokoCart = (storeId: string) => writeSalesTokoCart(storeId, []);

export const addProductToSalesTokoCart = (
	storeId: string,
	product: CatalogProduct,
	quantity: number,
	condition: "GOOD" = "GOOD",
) => {
	const price = getProductPrice(product);
	const imageUrl = getProductImage(product);
	const current = readSalesTokoCart(storeId);
	const key = `${product.productId}-${condition}`;
	const nextQuantity = Math.max(1, Math.floor(quantity || 1));
	const existing = current.findIndex((item) => `${item.productId}-${item.condition}` === key);
	const next =
		existing >= 0
			? current.map((item, index) =>
					index === existing
						? {
								...item,
								quantity: item.quantity + nextQuantity,
								unitPriceSnapshot: price,
								imageUrl,
							}
						: item,
				)
			: [
					...current,
					{
						catalogProductId: product.id,
						productId: product.productId,
						productName: product.marketingName,
						condition,
						quantity: nextQuantity,
						unitPriceSnapshot: price,
						imageUrl,
					},
				];

	writeSalesTokoCart(storeId, next);
	return next;
};
