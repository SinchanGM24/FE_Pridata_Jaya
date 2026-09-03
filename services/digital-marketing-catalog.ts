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


type PaginationMeta = {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
};

export const digitalMarketingCatalogService = {
	async getWorkspace(): Promise<CatalogWorkspace> {
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

