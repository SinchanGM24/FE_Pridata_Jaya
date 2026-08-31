import { getFeatureMockState } from "@/lib/mocks/feature-data";

export async function GET(request: Request) {
	const storeId = new URL(request.url).searchParams.get("storeId") || "";
	const rows = getFeatureMockState().receivables.filter((row) => !storeId || row.storeId === storeId);
	const buckets = {
		current: { count: 0, amount: 0 },
		days1To30: { count: 0, amount: 0 },
		days31To60: { count: 0, amount: 0 },
		days61To90: { count: 0, amount: 0 },
		daysOver90: { count: 0, amount: 0 },
	};
	for (const row of rows) {
		const days = Math.floor((Date.now() - new Date(String(row.dueDate)).getTime()) / 86_400_000);
		const bucket = days <= 0 ? buckets.current : days <= 30 ? buckets.days1To30 : days <= 60 ? buckets.days31To60 : days <= 90 ? buckets.days61To90 : buckets.daysOver90;
		bucket.count += 1;
		bucket.amount += row.remainingAmount;
	}
	return Response.json({
		success: true,
		message: "Mock sales aging retrieved successfully",
		data: {
			...buckets,
			totalReceivables: rows.length,
			totalOutstandingAmount: rows.reduce((sum, row) => sum + row.remainingAmount, 0),
			overdueCount: rows.filter((row) => new Date(String(row.dueDate)).getTime() < Date.now()).length,
		},
	});
}
