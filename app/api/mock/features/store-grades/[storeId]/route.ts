import { getFeatureMockState } from "@/lib/mocks/feature-data";

export async function GET(
	_request: Request,
	context: { params: Promise<{ storeId: string }> },
) {
	const { storeId } = await context.params;
	const store = getFeatureMockState().stores.get(storeId);
	if (!store) {
		return Response.json({ success: false, message: "Mock store tidak ditemukan.", data: null }, { status: 404 });
	}
	return Response.json({ success: true, message: "Mock store retrieved successfully", data: store });
}
