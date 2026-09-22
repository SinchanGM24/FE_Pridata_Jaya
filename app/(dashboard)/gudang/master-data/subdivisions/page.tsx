import OwnerSubdivisionsPage from "@/app/(dashboard)/owner/master-data/subdivisions/page";
import { WarehouseManagerGate } from "@/components/gudang/WarehouseManagerGate";

export default function WarehouseSubdivisionsPage() {
	return <WarehouseManagerGate><OwnerSubdivisionsPage /></WarehouseManagerGate>;
}
