import OwnerCategoriesPage from "@/app/(dashboard)/owner/master-data/categories/page";
import { WarehouseManagerGate } from "@/components/gudang/WarehouseManagerGate";

export default function WarehouseCategoriesPage() {
	return <WarehouseManagerGate><OwnerCategoriesPage /></WarehouseManagerGate>;
}
