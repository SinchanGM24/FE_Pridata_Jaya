import { NextRequest, NextResponse } from "next/server";
import { getCatalogMockState } from "@/lib/mocks/catalog-data";
import type { CatalogProductPayload } from "@/services/catalog-products";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({ success: true, message: "Mock catalog workspace retrieved", data: getCatalogMockState() });
}

export async function POST(request: NextRequest) {
	const body = await request.json().catch(() => null) as { productId?: string; payload?: CatalogProductPayload } | null;
	if (!body?.productId || !body.payload) {
		return NextResponse.json({ success: false, message: "productId dan payload wajib diisi." }, { status: 400 });
	}
	const state = getCatalogMockState();
	const productIndex = state.products.findIndex((item) => item.id === body.productId);
	if (productIndex < 0) return NextResponse.json({ success: false, message: "Produk tidak ditemukan." }, { status: 404 });
	const product = state.products[productIndex];
	const current = product.catalogProduct;
	const updated = {
		id: current?.id ?? `mock-catalog-${body.productId}`,
		productId: product.id,
		marketingName: body.payload.marketingName ?? current?.marketingName ?? product.name,
		sellingPrice: body.payload.sellingPrice ?? current?.sellingPrice ?? 0,
		description: body.payload.description ?? current?.description ?? null,
		imageList: body.payload.imageList ?? current?.imageList ?? [],
		isPublished: body.payload.isPublished ?? current?.isPublished ?? false,
		divisionId: body.payload.divisionId !== undefined ? body.payload.divisionId : current?.divisionId ?? product.divisionId ?? null,
		subDivisionId: body.payload.subDivisionId !== undefined ? body.payload.subDivisionId : current?.subDivisionId ?? product.subDivisionId ?? null,
	};
	state.products[productIndex] = { ...product, catalogProduct: updated };
	return NextResponse.json({ success: true, message: "Mock catalog saved", data: updated });
}
