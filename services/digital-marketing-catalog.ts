import { USE_NEXT_FEATURE_MOCK_SERVER, featureMockGet, featureMockPost } from "@/lib/feature-mock";
import {
	catalogProductsService,
	type CatalogProduct,
	type CatalogProductListParams,
	type CatalogProductPayload,
	type CatalogSummary,
} from "@/services/catalog-products";
import { divisionsService, type DivisionListItem } from "@/services/divisions";
import { filesService } from "@/services/files";
import { productsService, type Product } from "@/services/products";
import { subDivisionsService, type SubDivisionListItem } from "@/services/subdivisions";
import { warehouseInventoryService, type WarehouseInventoryItem } from "@/services/warehouse-inventory";

export type CatalogWorkspace = {
	products: Product[];
	inventory: WarehouseInventoryItem[];
	divisions: DivisionListItem[];
	subDivisions: SubDivisionListItem[];
};

type WorkspaceResponse = { data: CatalogWorkspace };
type SaveResponse = { data: NonNullable<Product["catalogProduct"]> };

type PaginationMeta = {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
};

const statusPriority = (product: Product) => {
	if (!product.catalogProduct) return 0;
	if (!product.catalogProduct.isPublished) return 1;
	return 2;
};

const displayName = (product: Product) =>
	product.catalogProduct?.marketingName?.trim() || product.name;

/** Belum Dibuat -> Draft -> Published, then marketing name A-Z. Matches the backend ordering. */
const byCatalogPriority = (left: Product, right: Product) =>
	statusPriority(left) - statusPriority(right) ||
	displayName(left).localeCompare(displayName(right), "id-ID", { sensitivity: "base" });

const toStock = (inventory: CatalogWorkspace["inventory"]) => {
	const stock = new Map<string, number>();
	for (const row of inventory) stock.set(row.productId, (stock.get(row.productId) ?? 0) + row.quantity);
	return stock;
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
	const reader = new FileReader();
	reader.onload = () => resolve(String(reader.result));
	reader.onerror = () => reject(new Error("Gagal membaca gambar mock."));
	reader.readAsDataURL(file);
});

export const digitalMarketingCatalogService = {
	async getWorkspace(): Promise<CatalogWorkspace> {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			return (await featureMockGet<WorkspaceResponse>("/digital-marketing/catalog")).data;
		}
		const [products, inventory, divisions, subDivisions] = await Promise.all([
			productsService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
			warehouseInventoryService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
			divisionsService.listAll({ sortBy: "name", sortOrder: "asc" }),
			subDivisionsService.listAll({ sortBy: "name", sortOrder: "asc" }),
		]);
		return { products, inventory, divisions, subDivisions };
	},

	/**
	 * Server-side page of the catalog list. Search, status filter and ordering are
	 * applied by the backend to the whole dataset before paging, so the workspace
	 * never has to pull every product to render one page.
	 */
	async listPage(params: CatalogProductListParams): Promise<{
		items: CatalogProduct[];
		meta?: PaginationMeta;
		stockByProduct: Map<string, number>;
	}> {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			const workspace = (await featureMockGet<WorkspaceResponse>("/digital-marketing/catalog")).data;
			return mockCatalogPage(workspace, params);
		}
		const { items, meta } = await catalogProductsService.list(params);
		return {
			items,
			meta,
			stockByProduct: new Map(items.map((item) => [item.productId, item.product.stockQuantity ?? 0])),
		};
	},

	async summary(): Promise<CatalogSummary> {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			const workspace = (await featureMockGet<WorkspaceResponse>("/digital-marketing/catalog")).data;
			return mockCatalogSummary(workspace);
		}
		return catalogProductsService.summary();
	},

	async save(product: Product, payload: CatalogProductPayload) {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			return (await featureMockPost<SaveResponse>("/digital-marketing/catalog", { productId: product.id, payload })).data;
		}
		// The catalog entry is addressed by its product id in both cases; create is
		// only "first save" for a product that has never been catalogued.
		const result = product.catalogProduct
			? await catalogProductsService.update(product.id, payload)
			: await catalogProductsService.create({ ...payload, productId: product.id });
		return {
			id: result.id,
			productId: result.productId,
			marketingName: result.marketingName,
			sellingPrice: result.sellingPrice,
			description: result.description,
			imageList: result.imageList,
			isPublished: result.isPublished,
			divisionId: result.divisionId,
			subDivisionId: result.subDivisionId,
		};
	},

	async uploadImage(file: File) {
		if (USE_NEXT_FEATURE_MOCK_SERVER) return readFileAsDataUrl(file);
		return (await filesService.uploadProductImage(file)).url;
	},
};

/**
 * Mock-mode equivalents of the two server-side catalog reads. Kept beside the real
 * calls so the mock and the backend agree on ordering and status semantics.
 */
function mockCatalogPage(workspace: CatalogWorkspace, params: CatalogProductListParams) {
	const stockByProduct = toStock(workspace.inventory);
	const query = params.search?.trim().toLowerCase() ?? "";
	const page = params.page ?? 1;
	const limit = params.limit ?? 10;

	const matched = workspace.products
		.filter((product) => (stockByProduct.get(product.id) ?? 0) > 0)
		.filter((product) => {
			if (params.status === "published") return product.catalogProduct?.isPublished === true;
			if (params.status === "draft") return Boolean(product.catalogProduct && !product.catalogProduct.isPublished);
			if (params.status === "not_created") return !product.catalogProduct;
			return true;
		})
		.filter((product) => {
			if (!query) return true;
			return [product.name, product.catalogProduct?.marketingName, product.category?.name, product.brand?.name]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query));
		})
		.sort(byCatalogPriority);

	const items = matched.slice((page - 1) * limit, page * limit).map(toCatalogRow);

	return {
		items,
		meta: {
			currentPage: page,
			totalPages: Math.max(1, Math.ceil(matched.length / limit)),
			totalItems: matched.length,
			itemsPerPage: limit,
		},
		stockByProduct,
	};
}

function mockCatalogSummary(workspace: CatalogWorkspace): CatalogSummary {
	const stockByProduct = toStock(workspace.inventory);
	const products = workspace.products.filter((product) => (stockByProduct.get(product.id) ?? 0) > 0);
	const configured = products.filter((product) => Boolean(product.catalogProduct)).length;
	const published = products.filter((product) => product.catalogProduct?.isPublished).length;
	const withoutImages = products.filter(
		(product) => product.catalogProduct && !(product.catalogProduct.imageList ?? []).some(Boolean),
	).length;
	const catalogable = products.length;

	return {
		activeStockProducts: products.length,
		configured,
		published,
		draft: configured - published,
		withoutImages,
		notCreated: catalogable - configured,
		contentReadinessPercent: catalogable === 0 ? 0 : Math.round((published / catalogable) * 100),
	};
}

function toCatalogRow(product: Product): CatalogProduct {
	const catalog = product.catalogProduct;
	return {
		id: product.id,
		productId: product.id,
		marketingName: catalog?.marketingName?.trim() || product.name,
		sellingPrice: catalog?.sellingPrice ?? 0,
		status: !catalog ? "not_created" : catalog.isPublished ? "published" : "draft",
		description: catalog?.description ?? product.productDetail?.description ?? null,
		imageList: catalog?.imageList ?? product.productDetail?.imageList ?? [],
		isPublished: Boolean(catalog?.isPublished),
		divisionId: catalog?.divisionId ?? product.divisionId ?? null,
		subDivisionId: catalog?.subDivisionId ?? product.subDivisionId ?? null,
		division: product.division ?? null,
		subDivision: product.subDivision ?? null,
		product: {
			id: product.id,
			name: product.name,
			stockQuantity: product.stockQuantity ?? 0,
			category: product.category ?? null,
			brand: product.brand ?? null,
			division: product.division ?? null,
			subDivision: product.subDivision ?? null,
			categoryId: product.categoryId ?? null,
			brandId: product.brandId ?? null,
			divisionId: product.divisionId ?? null,
			subDivisionId: product.subDivisionId ?? null,
			productDetail: product.productDetail ?? null,
		},
	};
}
