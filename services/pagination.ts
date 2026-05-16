export interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

interface PaginatedResult<T> {
	items: T[];
	meta?: PaginationMeta;
}

export async function collectPaginatedItems<T>(
	fetchPage: (page: number, limit: number) => Promise<PaginatedResult<T>>,
	limit = 100,
): Promise<T[]> {
	const firstPage = await fetchPage(1, limit);
	const totalPages = firstPage.meta?.totalPages ?? 1;

	if (totalPages <= 1) {
		return firstPage.items;
	}

	const remainingPages = await Promise.all(
		Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2, limit)),
	);

	return [firstPage, ...remainingPages].flatMap((page) => page.items);
}
