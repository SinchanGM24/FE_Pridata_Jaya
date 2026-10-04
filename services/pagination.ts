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

// ponytail: batch tetap 3. Daftar besar seharusnya tidak lewat sini lagi (lihat usePagedList).
const MAX_PARALLEL_PAGES = 3;

export async function collectPaginatedItems<T>(
	fetchPage: (page: number, limit: number) => Promise<PaginatedResult<T>>,
	limit = 100,
): Promise<T[]> {
	const firstPage = await fetchPage(1, limit);
	const totalPages = firstPage.meta?.totalPages ?? 1;

	if (totalPages <= 1) {
		return firstPage.items;
	}

	const pages = [firstPage];
	for (let start = 2; start <= totalPages; start += MAX_PARALLEL_PAGES) {
		const count = Math.min(MAX_PARALLEL_PAGES, totalPages - start + 1);
		pages.push(...(await Promise.all(Array.from({ length: count }, (_, i) => fetchPage(start + i, limit)))));
	}
	return pages.flatMap((page) => page.items);
}

/** Jumlah baris dari satu request `limit: 1`; tanpa mengunduh koleksinya. */
export async function countOf(request: Promise<{ meta?: PaginationMeta }>): Promise<number> {
	return (await request).meta?.totalItems ?? 0;
}
