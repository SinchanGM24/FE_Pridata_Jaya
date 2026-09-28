/**
 * Satu-satunya jalan ke console di FE (ESLint `no-console` menolak yang lain).
 * Mati di production: pengguna tidak membaca console, dan error yang penting
 * sudah punya jejak di log backend lewat X-Request-Id.
 */
export function logError(message: string, error?: unknown): void {
	if (process.env.NODE_ENV === "production") return;
	// eslint-disable-next-line no-console
	console.error(message, error);
}
