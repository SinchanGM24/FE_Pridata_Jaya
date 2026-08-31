export const USE_NEXT_FEATURE_MOCK_SERVER =
	process.env.NEXT_PUBLIC_USE_FEATURE_MOCK_SERVER === "true" ||
	(process.env.NEXT_PUBLIC_USE_FEATURE_MOCK_SERVER !== "false" && process.env.NODE_ENV === "development");

const buildQuery = (params?: Record<string, string | number | boolean | undefined>) => {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params ?? {})) {
		if (value !== undefined && value !== "") searchParams.set(key, String(value));
	}
	const query = searchParams.toString();
	return query ? `?${query}` : "";
};

const readResponse = async <T>(response: Response): Promise<T> => {
	const payload = await response.json().catch(() => null) as { message?: string } | null;
	if (!response.ok) throw new Error(payload?.message || "Mock server gagal memproses request.");
	return payload as T;
};

export const featureMockGet = async <T>(
	path: string,
	params?: Record<string, string | number | boolean | undefined>,
): Promise<T> => {
	const response = await fetch(`/api/mock/features${path}${buildQuery(params)}`, {
		cache: "no-store",
	});
	return readResponse<T>(response);
};

export const featureMockPost = async <T>(path: string, body: unknown): Promise<T> => {
	const response = await fetch(`/api/mock/features${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return readResponse<T>(response);
};
