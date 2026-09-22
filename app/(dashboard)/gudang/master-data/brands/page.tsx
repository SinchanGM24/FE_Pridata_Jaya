import OwnerBrandsPage from "@/app/(dashboard)/owner/master-data/brands/page";
import { WarehouseManagerGate } from "@/components/gudang/WarehouseManagerGate";

export default function WarehouseBrandsPage() {
	return <WarehouseManagerGate><OwnerBrandsPage /></WarehouseManagerGate>;
}
