import OwnerBrandsPage from "@/app/(dashboard)/owner/master-data/brands/page";
import { ProductTaxonomyGate } from "@/components/gudang/ProductTaxonomyGate";

export default function WarehouseBrandsPage() {
	return <ProductTaxonomyGate><OwnerBrandsPage /></ProductTaxonomyGate>;
}
