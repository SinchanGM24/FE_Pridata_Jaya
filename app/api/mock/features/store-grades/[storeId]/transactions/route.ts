import { buildMockGradeTransactions } from "@/lib/mocks/feature-data";

export async function GET(
	_request: Request,
	context: { params: Promise<{ storeId: string }> },
) {
	const { storeId } = await context.params;
	const transactions = buildMockGradeTransactions(storeId);
	if (!transactions) {
		return Response.json({ success: false, message: "Mock store tidak ditemukan.", data: null }, { status: 404 });
	}
	return Response.json({ success: true, message: "Mock grade transactions retrieved", data: transactions });
}
