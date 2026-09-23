import OwnerCategoriesPage from "@/app/(dashboard)/owner/master-data/categories/page";
import { ProductTaxonomyGate } from "@/components/gudang/ProductTaxonomyGate";

export default function WarehouseCategoriesPage() {
	return <ProductTaxonomyGate><OwnerCategoriesPage /></ProductTaxonomyGate>;
}
