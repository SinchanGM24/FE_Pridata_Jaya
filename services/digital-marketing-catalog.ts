import { USE_NEXT_FEATURE_MOCK_SERVER, featureMockGet, featureMockPost } from "@/lib/feature-mock";
import { catalogProductsService, type CatalogProductPayload } from "@/services/catalog-products";
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

	async save(product: Product, payload: CatalogProductPayload) {
		if (USE_NEXT_FEATURE_MOCK_SERVER) {
			return (await featureMockPost<SaveResponse>("/digital-marketing/catalog", { productId: product.id, payload })).data;
		}
		const result = product.catalogProduct?.id
			? await catalogProductsService.update(product.catalogProduct.id, payload)
			: await catalogProductsService.create(payload);
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
