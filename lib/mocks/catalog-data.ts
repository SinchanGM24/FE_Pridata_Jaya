import type { Product } from "@/services/products";
import type { WarehouseInventoryItem } from "@/services/warehouse-inventory";
import type { DivisionListItem } from "@/services/divisions";
import type { SubDivisionListItem } from "@/services/subdivisions";

export type CatalogMockState = {
	products: Product[];
	inventory: WarehouseInventoryItem[];
	divisions: DivisionListItem[];
	subDivisions: SubDivisionListItem[];
};

const names = [
	"CCTV Outdoor 5MP", "CCTV Indoor 3MP", "NVR 16 Channel", "DVR 8 Channel",
	"Access Point WiFi 6", "Router Dual Band", "Switch PoE 8 Port", "Kabel LAN Cat6",
	"Video Door Phone", "Smart Door Lock", "Alarm Sensor Kit", "Rack Server 12U",
	"UPS 1200VA", "Monitor Surveillance 24 Inch",
];

const makeInitialState = (): CatalogMockState => {
	const divisions = [
		{ id: "division-security", name: "Security System" },
		{ id: "division-network", name: "Network Infrastructure" },
	];
	const subDivisions = [
		{ id: "sub-cctv", name: "CCTV", categoryId: "category-security", divisionId: "division-security" },
		{ id: "sub-access", name: "Access Control", categoryId: "category-security", divisionId: "division-security" },
		{ id: "sub-network", name: "Networking", categoryId: "category-network", divisionId: "division-network" },
	];
	const products: Product[] = names.map((name, index) => {
		const number = index + 1;
		const network = index >= 4 && index <= 7;
		const configured = index % 4 !== 3;
		const divisionId = network ? "division-network" : "division-security";
		const categoryId = network ? "category-network" : "category-security";
		const subDivisionId = network ? "sub-network" : index >= 8 ? "sub-access" : "sub-cctv";
		return {
			id: `mock-product-${String(number).padStart(2, "0")}`,
			name,
			categoryId,
			brandId: index % 2 === 0 ? "brand-prime" : "brand-vision",
			divisionId,
			subDivisionId,
			category: { id: categoryId, name: network ? "Jaringan" : "Keamanan" },
			brand: { id: index % 2 === 0 ? "brand-prime" : "brand-vision", name: index % 2 === 0 ? "PrimeTech" : "VisionPro" },
			division: divisions.find((item) => item.id === divisionId) ?? null,
			subDivision: subDivisions.find((item) => item.id === subDivisionId) ?? null,
			productDetail: { description: `Produk demo ${name} untuk pengujian katalog.`, imageList: [] },
			catalogProduct: configured ? {
				id: `mock-catalog-${String(number).padStart(2, "0")}`,
				productId: `mock-product-${String(number).padStart(2, "0")}`,
				marketingName: name,
				sellingPrice: 450000 + index * 175000,
				description: `Solusi ${name} untuk kebutuhan toko dan proyek profesional.`,
				imageList: index % 3 === 0 ? [] : ["/pridata-logo.png"],
				isPublished: index % 3 !== 0,
				divisionId,
				subDivisionId,
			} : null,
		};
	});
	const inventory: WarehouseInventoryItem[] = products.map((product, index) => ({
		id: `mock-inventory-${index + 1}`,
		warehouseId: "mock-warehouse-main",
		productId: product.id,
		condition: "GOOD",
		quantity: 8 + index * 3,
		warehouse: { id: "mock-warehouse-main", name: "Gudang Utama Surabaya" },
	}));
	return { products, inventory, divisions, subDivisions };
};

type CatalogGlobal = typeof globalThis & { __pridataCatalogMock?: CatalogMockState };

export const getCatalogMockState = () => {
	const catalogGlobal = globalThis as CatalogGlobal;
	catalogGlobal.__pridataCatalogMock ??= makeInitialState();
	return catalogGlobal.__pridataCatalogMock;
};
