export interface AgingPrintableItem {
	invoiceNumber: string;
	invoiceDate?: string | null;
	dueDate?: string | null;
	status: string;
	totalAmount: number;
	remainingAmount: number;
	overdueDays: number;
}

export interface AgingPrintableGroup {
	storeId: string;
	storeName: string;
	totalOutstandingAmount: number;
	totalInvoiceCount: number;
	overdueCount?: number;
	maxOverdueDays?: number;
	riskLabel?: string;
	items: AgingPrintableItem[];
}

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const formatDate = (value?: string | null) => {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value).slice(0, 10);
	}
	return new Intl.DateTimeFormat("id-ID", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
};

const statusLabel = (value: string) => {
	switch (value) {
		case "UNPAID":
			return "Belum Lunas";
		case "PARTIAL":
			return "Bayar Sebagian";
		case "PAID":
			return "Lunas";
		case "CANCELLED":
			return "Dibatalkan";
		default:
			return value || "-";
	}
};

export function printAgingReceivableGroup(group: AgingPrintableGroup): boolean {
	const popup = window.open("", "_blank", "width=1100,height=900");
	if (!popup) return false;

	const printedAt = formatDate(new Date().toISOString());
	const totalReceivableAmount = group.items.reduce((sum, item) => sum + item.totalAmount, 0);
	const totalPaidAmount = group.items.reduce(
		(sum, item) => sum + Math.max(0, item.totalAmount - item.remainingAmount),
		0,
	);

	const rows = group.items
		.map(
			(item, index) => `
				<tr>
					<td class="center">${index + 1}</td>
					<td>${escapeHtml(item.invoiceNumber)}</td>
					<td>${escapeHtml(formatDate(item.invoiceDate))}</td>
					<td>${escapeHtml(formatDate(item.dueDate))}</td>
					<td class="center">${escapeHtml(statusLabel(item.status))}</td>
					<td class="right">${escapeHtml(formatRupiah(item.totalAmount))}</td>
					<td class="right">${escapeHtml(formatRupiah(item.remainingAmount))}</td>
					<td class="center">${item.overdueDays > 0 ? `${item.overdueDays} hari` : "-"}</td>
				</tr>
			`,
		)
		.join("");

	const html = `
		<!doctype html>
		<html lang="id">
			<head>
				<meta charset="UTF-8" />
				<title>Cetak Aging Piutang ${escapeHtml(group.storeName)}</title>
				<style>
					@page { size: A4; margin: 10mm; }
					* { box-sizing: border-box; }
					body {
						font-family: Arial, Helvetica, sans-serif;
						margin: 0;
						color: #111827;
						font-size: 12px;
						-webkit-print-color-adjust: exact;
						print-color-adjust: exact;
					}
					.page {
						width: 210mm;
						min-height: 297mm;
						margin: 0 auto;
						padding: 10mm;
					}
					@media screen {
						body {
							background: #ececec;
							padding: 18px 44px;
						}
						.page {
							background: #fff;
							box-shadow: 0 0 0 1px #d0d0d0;
						}
					}
					@media print {
						body {
							background: #fff;
							padding: 0;
						}
						.page {
							width: 100%;
							min-height: auto;
							margin: 0;
							box-shadow: none;
							page-break-after: always;
						}
					}
					h1, h2, p { margin: 0; }
					.header {
						display: grid;
						grid-template-columns: 88px 1fr;
						gap: 16px;
						align-items: center;
						margin-bottom: 18px;
						border-bottom: 2px solid #1f2937;
						padding-bottom: 12px;
					}
					.logo {
						width: 88px;
						height: 88px;
						object-fit: contain;
					}
					.brand h1 {
						font-size: 18px;
						font-weight: 700;
						color: #111827;
					}
					.brand p {
						margin-top: 3px;
						font-size: 11px;
						color: #4b5563;
					}
					.title-section {
						text-align: center;
						margin: 14px 0 16px;
						padding-bottom: 10px;
						border-bottom: 1px solid #d1d5db;
					}
					.title-section h2 {
						font-size: 16px;
						font-weight: 700;
						color: #111827;
					}
					.title-section p {
						margin-top: 4px;
						font-size: 11px;
						color: #6b7280;
					}
					.info-row {
						display: grid;
						grid-template-columns: repeat(4, 1fr);
						gap: 14px;
						margin: 10px 0 14px;
						font-size: 11px;
					}
					.info-item label {
						display: block;
						font-weight: 600;
						color: #374151;
						margin-bottom: 2px;
					}
					.info-item p {
						color: #4b5563;
					}
					table {
						width: 100%;
						border-collapse: collapse;
						margin: 10px 0;
						font-size: 10px;
					}
					thead {
						background: #f3f4f6;
						font-weight: 700;
						border-bottom: 2px solid #374151;
					}
					th, td {
						padding: 6px;
						text-align: left;
						border-bottom: 1px solid #d1d5db;
					}
					th { color: #111827; }
					.center { text-align: center; }
					.right { text-align: right; }
					tbody tr:nth-child(even) {
						background: #f9fafb;
					}
					.summary {
						margin-top: 12px;
						padding: 10px 12px;
						background: #f8fafc;
						border: 1px solid #d1d5db;
					}
					.summary-row {
						display: grid;
						grid-template-columns: 1fr 1fr;
						gap: 10px;
						margin: 6px 0;
						font-size: 11px;
					}
					.summary-row label {
						font-weight: 600;
						color: #374151;
					}
					.summary-row .value {
						text-align: right;
						color: #111827;
						font-weight: 600;
					}
					.summary-row .danger {
						color: #b91c1c;
						font-size: 12px;
					}
					.footer {
						margin-top: 16px;
						padding-top: 10px;
						border-top: 1px solid #d1d5db;
						font-size: 10px;
						color: #6b7280;
						display: grid;
						grid-template-columns: 1fr 1fr 1fr;
						gap: 10px;
					}
					.footer-item {
						text-align: center;
					}
					.footer-sign {
						margin-top: 28px;
						font-weight: 600;
						color: #111827;
					}
				</style>
			</head>
			<body>
				<div class="page">
					<div class="header">
						<img src="/pridata-logo.png" alt="Logo Pridata Jaya" class="logo" />
						<div class="brand">
							<h1>CV. Pridata Jaya</h1>
							<p>Sistem Manajemen Distribusi</p>
							<p>Operasional Distributor</p>
						</div>
					</div>

					<div class="title-section">
						<h2>LAPORAN AGING PIUTANG</h2>
						<p>Tanggal Cetak: ${escapeHtml(printedAt)}</p>
					</div>

					<div class="info-row">
						<div class="info-item">
							<label>ID Toko:</label>
							<p>${escapeHtml(group.storeId)}</p>
						</div>
						<div class="info-item">
							<label>Nama Toko:</label>
							<p>${escapeHtml(group.storeName)}</p>
						</div>
						<div class="info-item">
							<label>Jumlah Invoice:</label>
							<p>${group.totalInvoiceCount}</p>
						</div>
						<div class="info-item">
							<label>Kategori Risiko:</label>
							<p>${escapeHtml(group.riskLabel ?? "-")}</p>
						</div>
					</div>

					<table>
						<thead>
							<tr>
								<th class="center">No</th>
								<th>Invoice</th>
								<th>Tanggal Invoice</th>
								<th>Jatuh Tempo</th>
								<th class="center">Status</th>
								<th class="right">Total</th>
								<th class="right">Sisa Tagihan</th>
								<th class="center">Terlambat</th>
							</tr>
						</thead>
						<tbody>${rows}</tbody>
					</table>

					<div class="summary">
						<div class="summary-row">
							<label>Total Tagihan:</label>
							<div class="value">${escapeHtml(formatRupiah(totalReceivableAmount))}</div>
						</div>
						<div class="summary-row">
							<label>Sudah Dibayar:</label>
							<div class="value">${escapeHtml(formatRupiah(totalPaidAmount))}</div>
						</div>
						<div class="summary-row">
							<label>Sisa Tagihan:</label>
							<div class="value danger">${escapeHtml(formatRupiah(group.totalOutstandingAmount))}</div>
						</div>
						<div class="summary-row">
							<label>Invoice Lewat Jatuh Tempo:</label>
							<div class="value">${group.overdueCount ?? 0}</div>
						</div>
					</div>

					<div class="footer">
						<div>
							<p>Mengetahui,</p>
							<div class="footer-sign">Bagian Akuntansi</div>
						</div>
						<div>
							<p>Menyetujui,</p>
							<div class="footer-sign">Manajer</div>
						</div>
						<div class="footer-item">
							<p>Tanggal: ${escapeHtml(printedAt)}</p>
						</div>
					</div>
				</div>
				<script>
					window.onload = function () {
						window.print();
						window.close();
					};
				</script>
			</body>
		</html>
	`;

	popup.document.write(html);
	popup.document.close();
	return true;
}
