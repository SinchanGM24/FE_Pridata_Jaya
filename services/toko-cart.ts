import type { CatalogProduct } from "@/services/catalog-products";

export interface TokoCartItem {
	catalogProductId?: string;
	productId: string;
	productName: string;
	condition: "GOOD";
	quantity: number;
	unitPriceSnapshot: number;
	imageUrl?: string;
}

const CART_KEY = "fe2:toko-cart";
const ACTIVE_STORE_KEY = "fe2:toko-cart:active-store";
const storeCartKey = (storeId: string) => `fe2:store-cart:${storeId}`;

const numberFromSpec = (value: unknown) => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const normalized = Number(value.replace(/[^\d.-]/g, ""));
		return Number.isFinite(normalized) ? normalized : 0;
	}
	return 0;
};

export const getProductPrice = (product: CatalogProduct) => numberFromSpec(product.sellingPrice);

export const getProductImage = (product: CatalogProduct) => product.imageList?.find(Boolean) || "";

export const normalizeSellableCartCondition = <T extends { condition: "GOOD" }>(item: T): T =>
	item.condition === "GOOD" ? { ...item, condition: "GOOD" } : item;

const getActiveStoreId = () => {
	if (typeof window === "undefined") return "";
	return window.sessionStorage.getItem(ACTIVE_STORE_KEY) || "";
};

const readSharedStoreCart = (storeId: string): TokoCartItem[] => {
	if (typeof window === "undefined" || !storeId) return [];
	try {
		const parsed = JSON.parse(window.localStorage.getItem(storeCartKey(storeId)) || "[]");
		return Array.isArray(parsed) ? (parsed as TokoCartItem[]).map(normalizeSellableCartCondition) : [];
	} catch {
		return [];
	}
};

const writeSharedStoreCart = (storeId: string, items: TokoCartItem[]) => {
	if (typeof window === "undefined" || !storeId) return;
	window.localStorage.setItem(storeCartKey(storeId), JSON.stringify(items));
	window.dispatchEvent(new Event("toko-cart-updated"));
	window.dispatchEvent(new CustomEvent("sales-toko-cart-updated", { detail: { storeId } }));
};

export const setActiveTokoCartStore = (storeId: string) => {
	if (typeof window === "undefined" || !storeId) return;
	window.sessionStorage.setItem(ACTIVE_STORE_KEY, storeId);
	const legacyItems = readTokoCart();
	if (legacyItems.length > 0 && readSharedStoreCart(storeId).length === 0) {
		writeSharedStoreCart(storeId, legacyItems);
		window.localStorage.removeItem(CART_KEY);
	}
};

export const readTokoCart = (): TokoCartItem[] => {
	if (typeof window === "undefined") return [];
	const activeStoreId = getActiveStoreId();
	if (activeStoreId) {
		return readSharedStoreCart(activeStoreId);
	}
	try {
		const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
		return Array.isArray(parsed) ? (parsed as TokoCartItem[]).map(normalizeSellableCartCondition) : [];
	} catch {
		return [];
	}
};

export const writeTokoCart = (items: TokoCartItem[]) => {
	if (typeof window === "undefined") return;
	const activeStoreId = getActiveStoreId();
	if (activeStoreId) {
		writeSharedStoreCart(activeStoreId, items);
		return;
	}
	window.localStorage.setItem(CART_KEY, JSON.stringify(items));
	window.dispatchEvent(new Event("toko-cart-updated"));
};

export const clearTokoCart = () => writeTokoCart([]);

export const addProductToTokoCart = (
	product: CatalogProduct,
	quantity: number,
	condition: "GOOD" = "GOOD",
) => {
	const price = getProductPrice(product);
	const imageUrl = getProductImage(product);
	const current = readTokoCart();
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
	writeTokoCart(next);
	return next;
};

export const readStoreScopedCart = (storeId: string) => readSharedStoreCart(storeId);

export const writeStoreScopedCart = (storeId: string, items: TokoCartItem[]) => {
	writeSharedStoreCart(storeId, items);
};
