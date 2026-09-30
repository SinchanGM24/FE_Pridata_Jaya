import OwnerSuppliersPage from "@/app/(dashboard)/owner/master-data/suppliers/page";
import { WarehouseOperationalMasterDataGate } from "@/components/gudang/WarehouseOperationalMasterDataGate";

export default function WarehouseSuppliersPage() {
	return <WarehouseOperationalMasterDataGate><OwnerSuppliersPage /></WarehouseOperationalMasterDataGate>;
}
