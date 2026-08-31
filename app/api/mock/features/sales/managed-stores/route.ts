import { getFeatureMockState, registerMockStore } from "@/lib/mocks/feature-data";

const toPositiveInteger = (value: string | null, fallback: number, maximum = 100) => {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
};

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const page = toPositiveInteger(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
	const limit = toPositiveInteger(searchParams.get("limit"), 10);
	const search = searchParams.get("search")?.trim().toLowerCase() || "";
	let rows = [...getFeatureMockState().grades];
	if (search) {
		rows = rows.filter(
			(row) => row.storeName.toLowerCase().includes(search) || row.email.toLowerCase().includes(search),
		);
	}
	rows.sort((left, right) => left.storeName.localeCompare(right.storeName, "id-ID"));

	const totalItems = rows.length;
	const totalPages = Math.ceil(totalItems / limit);
	const start = (page - 1) * limit;
	return Response.json({
		success: true,
		message: "Mock managed stores retrieved successfully",
		data: rows.slice(start, start + limit),
		meta: { currentPage: page, totalPages, totalItems, itemsPerPage: limit },
	});
}

export async function POST(request: Request) {
	try {
		const payload = await request.json();
		const required = ["ownerName", "ownerEmail", "ownerPassword", "storeName", "ownerGender", "phone", "address", "yearsInBusiness"];
		const missing = required.filter((field) => payload?.[field] === undefined || payload?.[field] === "");
		if (missing.length || (!payload.cityId && (!payload.newCityName || !payload.newCityProvince))) {
			return Response.json({ success: false, message: "Data pendaftaran toko belum lengkap.", data: null }, { status: 400 });
		}
		if (String(payload.ownerPassword).length < 8) {
			return Response.json({ success: false, message: "Password minimal 8 karakter.", data: null }, { status: 400 });
		}
		const store = registerMockStore(payload);
		return Response.json({ success: true, message: "Mock store registered successfully", data: store }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Mock server gagal mendaftarkan toko.";
		return Response.json({ success: false, message, data: null }, { status: message.includes("sudah digunakan") ? 409 : 500 });
	}
}
