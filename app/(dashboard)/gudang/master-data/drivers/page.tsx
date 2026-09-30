import OwnerDriversPage from "@/app/(dashboard)/owner/master-data/drivers/page";
import { WarehouseOperationalMasterDataGate } from "@/components/gudang/WarehouseOperationalMasterDataGate";

export default function WarehouseDriversPage() {
	return <WarehouseOperationalMasterDataGate><OwnerDriversPage /></WarehouseOperationalMasterDataGate>;
}
