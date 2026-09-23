import OwnerSubdivisionsPage from "@/app/(dashboard)/owner/master-data/subdivisions/page";
import { ProductTaxonomyGate } from "@/components/gudang/ProductTaxonomyGate";

export default function WarehouseSubdivisionsPage() {
	return <ProductTaxonomyGate><OwnerSubdivisionsPage /></ProductTaxonomyGate>;
}
