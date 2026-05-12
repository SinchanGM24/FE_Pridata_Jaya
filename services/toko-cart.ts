import type { CatalogProduct } from "@/services/catalog-products";

export interface TokoCartItem {
	catalogProductId?: string;
	productId: string;
	productName: string;
	condition: "NEW" | "GOOD";
	quantity: number;
	unitPriceSnapshot: number;
	imageUrl?: string;
}

const CART_KEY = "fe2:toko-cart";

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

export const readTokoCart = (): TokoCartItem[] => {
	if (typeof window === "undefined") return [];
	try {
		const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

export const writeTokoCart = (items: TokoCartItem[]) => {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(CART_KEY, JSON.stringify(items));
	window.dispatchEvent(new Event("toko-cart-updated"));
};

export const clearTokoCart = () => writeTokoCart([]);

export const addProductToTokoCart = (
	product: CatalogProduct,
	quantity: number,
	condition: "NEW" | "GOOD" = "NEW",
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
