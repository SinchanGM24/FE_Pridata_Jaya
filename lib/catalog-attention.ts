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
