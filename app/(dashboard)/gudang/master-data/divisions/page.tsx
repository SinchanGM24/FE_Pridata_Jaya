import OwnerDivisionsPage from "@/app/(dashboard)/owner/master-data/divisions/page";
import { ProductTaxonomyGate } from "@/components/gudang/ProductTaxonomyGate";

export default function WarehouseDivisionsPage() {
	return <ProductTaxonomyGate><OwnerDivisionsPage /></ProductTaxonomyGate>;
}
