export const invoiceStatusLabel: Record<string, string> = {
	UNPAID: "Belum Lunas",
	PARTIAL: "Bayar Sebagian",
	PAID: "Lunas",
	CANCELLED: "Dibatalkan",
};

export const invoiceDraftStatusLabel: Record<string, string> = {
	DRAFT: "Rancangan",
	FINALIZED: "Difinalisasi",
	CANCELLED: "Dibatalkan",
};

export const deliveryOrderStatusLabel: Record<string, string> = {
	OPEN: "Baru Dibuat",
	PICKING: "Sedang Pengambilan",
	PACKING: "Sedang Pengemasan",
	READY_TO_SHIP: "Siap Dikirim",
	PARTIALLY_SHIPPED: "Terkirim Sebagian",
	SHIPPED: "Terkirim",
	RECEIVED: "Diterima",
	CANCELLED: "Dibatalkan",
};

export const paymentStatusLabel: Record<string, string> = {
	PENDING: "Menunggu",
	VERIFIED: "Terverifikasi",
	CANCELLED: "Dibatalkan",
};

export const paymentMethodLabel: Record<string, string> = {
	CASH: "Tunai",
	TRANSFER: "Transfer",
};

export const orderStatusLabel: Record<string, string> = {
	PENDING: "Menunggu",
	PROCESSED: "Diproses",
	CANCELLED: "Dibatalkan",
};

export const transferStatusLabel: Record<string, string> = {
	PENDING: "Menunggu",
	IN_TRANSIT: "Dalam Perjalanan",
	COMPLETED: "Selesai",
	CANCELLED: "Dibatalkan",
};

export const reconciliationStatusLabel: Record<string, string> = {
	DRAFT: "Rancangan",
	CONFIRMED: "Terkonfirmasi",
	CANCELLED: "Dibatalkan",
};

export const verificationStatusLabel: Record<string, string> = {
	PENDING: "Menunggu Verifikasi",
	VERIFIED: "Terverifikasi",
	REJECTED: "Ditolak",
};

export function toUiLabel(value: string | null | undefined, labels: Record<string, string>): string {
	if (!value) return "-";
	return labels[value] ?? value;
}
