import CatalogItemEditor from "@/components/catalog/CatalogItemEditor";

export default async function DigitalMarketingCatalogItemPage({ params }: { params: Promise<{ productId: string }> }) {
	const { productId } = await params;
	return <CatalogItemEditor productId={productId} />;
}
