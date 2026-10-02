/** Priority merge: groups in the given order, deduped by productId, first `limit` kept. */
export function mergeAttention<T extends { productId: string }>(groups: T[][], limit: number): T[] {
	const seen = new Set<string>();
	const out: T[] = [];
	for (const item of groups.flat()) {
		if (seen.has(item.productId)) continue;
		seen.add(item.productId);
		out.push(item);
		if (out.length === limit) break;
	}
	return out;
}

type ActiveCounts = { activeStockProducts: number; activeNotCreated: number; activeDraft: number; activeWithoutImages: number };

/** Stock-active readiness numbers; statuses are exactly not_created / draft / published. */
export function activeReadiness(s: ActiveCounts) {
	const configured = Math.max(0, s.activeStockProducts - s.activeNotCreated);
	const published = Math.max(0, configured - s.activeDraft);
	const needAction = s.activeNotCreated + s.activeDraft;
	return {
		configured,
		published,
		notCreated: s.activeNotCreated,
		needAction,
		allClear: needAction + s.activeWithoutImages === 0,
		readinessPercent: s.activeStockProducts ? Math.round((configured / s.activeStockProducts) * 100) : 0,
	};
}
