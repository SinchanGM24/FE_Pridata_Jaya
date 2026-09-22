import OwnerDivisionsPage from "@/app/(dashboard)/owner/master-data/divisions/page";
import { WarehouseManagerGate } from "@/components/gudang/WarehouseManagerGate";

export default function WarehouseDivisionsPage() {
	return <WarehouseManagerGate><OwnerDivisionsPage /></WarehouseManagerGate>;
}
