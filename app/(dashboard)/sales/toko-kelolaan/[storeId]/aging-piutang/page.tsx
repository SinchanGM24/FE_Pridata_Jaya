import { redirect } from "next/navigation";

interface SalesManagedStoreAgingRedirectPageProps {
	params: Promise<{ storeId: string }>;
}

export default async function SalesManagedStoreAgingRedirectPage({
	params,
}: SalesManagedStoreAgingRedirectPageProps) {
	const { storeId } = await params;
	redirect(`/sales/aging-piutang?storeId=${storeId}`);
}
