import { getFeatureMockState } from "@/lib/mocks/feature-data";

const overdueDays = (dueDate?: string | null) => {
	if (!dueDate) return 0;
	return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));
};

const risk = (days: number) => days > 90 ? "HIGH" : days > 60 ? "MEDIUM" : "LOW";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const page = Math.max(1, Number(searchParams.get("page")) || 1);
	const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
	const search = searchParams.get("search")?.trim().toLowerCase() || "";
	const agingRisk = searchParams.get("agingRisk") || "";
	const storeId = searchParams.get("storeId") || "";

	let rows = [...getFeatureMockState().receivables];
	if (storeId) rows = rows.filter((row) => row.storeId === storeId);
	if (search) {
		rows = rows.filter((row) =>
			row.invoiceNumber.toLowerCase().includes(search) ||
			(row.storeNameSnapshot || row.store?.name || "").toLowerCase().includes(search),
		);
	}
	if (agingRisk) rows = rows.filter((row) => risk(overdueDays(row.dueDate)) === agingRisk);
	rows.sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)));

	const totalItems = rows.length;
	const totalPages = Math.ceil(totalItems / limit);
	const start = (page - 1) * limit;
	return Response.json({
		success: true,
		message: "Mock sales receivables retrieved successfully",
		data: rows.slice(start, start + limit),
		meta: { currentPage: page, totalPages, totalItems, itemsPerPage: limit },
	});
}
