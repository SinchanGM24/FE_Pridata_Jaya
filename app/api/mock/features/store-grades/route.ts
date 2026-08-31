import { getFeatureMockState } from "@/lib/mocks/feature-data";

const toPositiveInteger = (value: string | null, fallback: number, maximum = 100) => {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
};

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const page = toPositiveInteger(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
	const limit = toPositiveInteger(searchParams.get("limit"), 10);
	const search = searchParams.get("search")?.trim().toLowerCase() || "";
	const grade = searchParams.get("grade")?.toUpperCase() || "";
	const storeId = searchParams.get("storeId") || "";
	const scope = searchParams.get("scope") || "internal";

	// Grade hanya berlaku untuk toko yang sudah resmi bergabung melalui verifikasi.
	// Toko PENDING/REJECTED tetap tersedia di Toko Kelolaan, tetapi tidak di endpoint ini.
	let rows = getFeatureMockState().grades.filter((row) => row.verificationStatus === "VERIFIED");
	if (scope === "toko") rows = rows.slice(0, 1);
	if (storeId) rows = rows.filter((row) => row.storeId === storeId);
	if (search) {
		rows = rows.filter(
			(row) => row.storeName.toLowerCase().includes(search) || row.email.toLowerCase().includes(search),
		);
	}
	if (grade) rows = rows.filter((row) => row.grade === grade);
	rows.sort((left, right) => left.storeName.localeCompare(right.storeName, "id-ID"));

	const totalItems = rows.length;
	const totalPages = Math.ceil(totalItems / limit);
	const start = (page - 1) * limit;

	return Response.json({
		success: true,
		message: "Mock store grades retrieved successfully",
		data: rows.slice(start, start + limit),
		meta: { currentPage: page, totalPages, totalItems, itemsPerPage: limit },
	});
}
