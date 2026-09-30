import OwnerWarehousesPage from "@/app/(dashboard)/owner/master-data/warehouses/page";
import { WarehouseOperationalMasterDataGate } from "@/components/gudang/WarehouseOperationalMasterDataGate";

export default function WarehouseWarehousesPage() {
	return <WarehouseOperationalMasterDataGate><OwnerWarehousesPage /></WarehouseOperationalMasterDataGate>;
}
