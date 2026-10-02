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

export type CatalogItemWorkspace = {
	product: Product;
	inventory: WarehouseInventoryItem[];
	divisions: DivisionListItem[];
	subDivisions: SubDivisionListItem[];
};

export type CatalogOverview = {
	summary: CatalogSummary;
	/** Stock-active products that still need catalog work: not created first, then drafts. */
	attention: CatalogProduct[];
};

const ATTENTION_LIMIT = 6;

type PaginationMeta = {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
};

export const digitalMarketingCatalogService = {
	/** One product plus its own stock rows; only master data (divisions) is fetched in full. */
	async getItemWorkspace(productId: string): Promise<CatalogItemWorkspace> {
		const [product, inventory, divisions, subDivisions] = await Promise.all([
			productsService.getById(productId),
			warehouseInventoryService.list({ productId, page: 1, limit: 100 }).then((result) => result.items),
			divisionsService.listAll({ sortBy: "name", sortOrder: "asc" }),
			subDivisionsService.listAll({ sortBy: "name", sortOrder: "asc" }),
		]);
		return { product, inventory, divisions, subDivisions };
	},

	/** Headline counts from the server summary plus a short attention list; never the whole catalog. */
	async getOverview(): Promise<CatalogOverview> {
		const params = { page: 1, limit: ATTENTION_LIMIT, sortBy: "updatedAt", sortOrder: "desc" as const };
		const [summary, notCreated, draft] = await Promise.all([
			catalogProductsService.summary(),
			catalogProductsService.list({ ...params, status: "not_created" }),
			catalogProductsService.list({ ...params, status: "draft" }),
		]);
		return { summary, attention: [...notCreated.items, ...draft.items].slice(0, ATTENTION_LIMIT) };
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
		const { items, meta } = await catalogProductsService.list(params);
		return {
			items,
			meta,
			stockByProduct: new Map(items.map((item) => [item.productId, item.product.stockQuantity ?? 0])),
		};
	},

	async summary(): Promise<CatalogSummary> {
		return catalogProductsService.summary();
	},

	async save(product: Product, payload: CatalogProductPayload) {
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
		return (await filesService.uploadProductImage(file)).url;
	},
};

