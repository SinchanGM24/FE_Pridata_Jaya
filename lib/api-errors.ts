type ValidationIssue = {
	path?: Array<string | number>;
	message?: string;
};

type ApiErrorShape = {
	message?: string;
	code?: string;
	errors?: ValidationIssue[];
};

const humanizePath = (path: Array<string | number> | undefined) => {
	if (!path || path.length === 0) return "";
	return path
		.map((part) => String(part))
		.join(".")
		.replace(/Id$/g, "")
		.replace(/\./g, " > ");
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error
	) {
		const payload = (error as { response?: { data?: ApiErrorShape } }).response?.data;
		if (payload) {
			const firstIssue = payload.errors?.find((issue) => issue?.message);
			if (firstIssue?.message) {
				const path = humanizePath(firstIssue.path);
				return path ? `${path}: ${firstIssue.message}` : firstIssue.message;
			}
			if (payload.message) {
				return payload.message;
			}
		}
	}

	if (error instanceof Error && error.message) return error.message;
	return fallback;
};
