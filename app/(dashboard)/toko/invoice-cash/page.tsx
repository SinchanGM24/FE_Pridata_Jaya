"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { useTokoCartCount } from "@/hooks/useTokoCartCount";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDate } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import {
	invoiceStatusLabel,
	paymentMethodLabel,
	paymentStatusLabel,
	statusTone,
	toUiLabel,
} from "@/lib/ui-labels";
import {
	invoicesService,
	type InvoiceListItem,
	type InvoiceStatus,
} from "@/services/invoices";
import {
	paymentsService,
	type Payment,
	type PaymentMethod,
} from "@/services/payments";
import { tokoService } from "@/services/toko";

const dateOnly = (v?: string | null) => (v ? formatAppDate(v) : "-");

const PAGE_SIZE = 10;

export default function StoreInvoiceCashPage() {
	const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [storeName, setStoreName] = useState("Toko");
	const cartCount = useTokoCartCount();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [selected, setSelected] = useState<InvoiceListItem | null>(null);
	const [detailInvoice, setDetailInvoice] = useState<InvoiceListItem | null>(null);
	const [filterStatus, setFilterStatus] = useState<"ALL" | Extract<InvoiceStatus, "UNPAID" | "PARTIAL">>("ALL");
	const [invoicePage, setInvoicePage] = useState(1);
	const [paymentPage, setPaymentPage] = useState(1);
	const [payAmount, setPayAmount] = useState(0);
	const [payMethod, setPayMethod] = useState<PaymentMethod>("TRANSFER");
	const [payRef, setPayRef] = useState("");
	const [payNotes, setPayNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [invoiceResult, paymentResult, dashboard] = await Promise.all([
				invoicesService.listAllForToko(),
				paymentsService.listAllForToko(),
				tokoService.getDashboard().catch(() => null),
			]);
			setInvoices(invoiceResult);
			setPayments(paymentResult);
			setStoreName(dashboard?.store?.storeName || "Toko");
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat data faktur."));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const paymentsByInvoice = useMemo(() => {
		const map: Record<string, Payment[]> = {};
		for (const p of payments) {
			if (!map[p.invoiceId]) map[p.invoiceId] = [];
			map[p.invoiceId].push(p);
		}
		Object.values(map).forEach((items) =>
			items.sort((left, right) => String(right.paymentDate || "").localeCompare(String(left.paymentDate || ""))),
		);
		return map;
	}, [payments]);

	const detailPayments = detailInvoice ? paymentsByInvoice[detailInvoice.id] ?? [] : [];

	const filteredInvoices = useMemo(() => {
		const payableInvoices = invoices.filter((inv) => inv.status === "UNPAID" || inv.status === "PARTIAL");
		if (filterStatus === "ALL") return payableInvoices;
		return payableInvoices.filter((inv) => inv.status === filterStatus);
	}, [invoices, filterStatus]);
	const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
	const invoiceCurrentPage = Math.min(invoicePage, invoiceTotalPages);
	const paginatedInvoices = useMemo(() => {
		const start = (invoiceCurrentPage - 1) * PAGE_SIZE;
		return filteredInvoices.slice(start, start + PAGE_SIZE);
	}, [filteredInvoices, invoiceCurrentPage]);
	const paymentTotalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
	const paymentCurrentPage = Math.min(paymentPage, paymentTotalPages);
	const paginatedPayments = useMemo(() => {
		const start = (paymentCurrentPage - 1) * PAGE_SIZE;
		return payments.slice(start, start + PAGE_SIZE);
	}, [paymentCurrentPage, payments]);

	const summary = useMemo(
		() => ({
			total: invoices.filter((i) => i.status === "UNPAID" || i.status === "PARTIAL").length,
			unpaid: invoices.filter((i) => i.status === "UNPAID").length,
			partial: invoices.filter((i) => i.status === "PARTIAL").length,
			outstanding: invoices
				.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED")
				.reduce((sum, i) => sum + i.remainingAmount, 0),
		}),
		[invoices],
	);

	const openPayment = (invoice: InvoiceListItem) => {
		setSelected(invoice);
		setPayAmount(invoice.remainingAmount);
		setPayMethod("TRANSFER");
		setPayRef("");
		setPayNotes("");
		setError("");
		setSuccess("");
	};

	const handleSubmitPayment = async () => {
		if (!selected) return;
		if (payAmount <= 0) {
			setError("Jumlah pembayaran harus lebih dari 0.");
			return;
		}
		if (payMethod === "TRANSFER" && !payRef.trim()) {
			setError("Nomor referensi / bukti transfer wajib diisi untuk pembayaran transfer.");
			return;
		}

		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await paymentsService.createForToko({
				invoiceId: selected.id,
				amount: payAmount,
				method: payMethod,
				referenceNo: payMethod === "TRANSFER" ? payRef : undefined,
				notes: payNotes || undefined,
			});
			setSuccess(
				payMethod === "CASH"
					? `Pembayaran tunai ${formatRupiah(payAmount)} berhasil diajukan dan menunggu konfirmasi sales.`
					: `Pembayaran ${formatRupiah(payAmount)} berhasil diajukan dan menunggu verifikasi akuntan.`,
			);
			setSelected(null);
			setInvoicePage(1);
			setPaymentPage(1);
			await load();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal mencatat pembayaran."));
		} finally {
			setSubmitting(false);
		}
	};

	const isSubmitDisabled =
		submitting ||
		!selected ||
		payAmount <= 0 ||
		payAmount > (selected?.remainingAmount ?? 0) ||
		(payMethod === "TRANSFER" && !payRef.trim());

	const invoiceColumns: ResponsiveColumn<InvoiceListItem>[] = [
		{
			key: "invoiceNumber",
			head: "Faktur",
			role: "title",
			render: (inv) => (
				<span className="block">
					<span className="block font-medium text-slate-900">{inv.invoiceNumber}</span>
					<span className="block text-xs text-slate-500">
						{(paymentsByInvoice[inv.id] ?? []).length} riwayat pembayaran
					</span>
				</span>
			),
		},
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (inv) => (
				<Badge tone={statusTone(inv.status)}>{toUiLabel(inv.status, invoiceStatusLabel)}</Badge>
			),
		},
		{
			key: "remainingAmount",
			head: "Sisa Tagihan",
			role: "amount",
			align: "right",
			render: (inv) => formatRupiah(inv.remainingAmount),
		},
		{ key: "invoiceDate", head: "Tanggal", render: (inv) => dateOnly(inv.invoiceDate) },
		{ key: "dueDate", head: "Jatuh Tempo", render: (inv) => dateOnly(inv.dueDate) },
		{
			key: "totalAmount",
			head: "Total",
			align: "right",
			render: (inv) => formatRupiah(inv.totalAmount),
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (inv) => {
				const pendingPayment = (paymentsByInvoice[inv.id] ?? []).find(
					(payment) => payment.status === "PENDING",
				);
				return (
					<span className="inline-flex flex-col items-end gap-1">
						<Button variant="secondary" size="sm" onClick={() => setDetailInvoice(inv)}>
							Detail
						</Button>
						{pendingPayment ? (
							<span className="text-xs font-semibold text-amber-700">Menunggu verifikasi</span>
						) : null}
					</span>
				);
			},
		},
	];

	const paymentColumns: ResponsiveColumn<Payment>[] = [
		{
			key: "invoice",
			head: "Faktur",
			role: "title",
			render: (payment) => payment.invoice?.invoiceNumber || "-",
		},
		{
			key: "status",
			head: "Status",
			role: "status",
			render: (payment) => (
				<Badge tone={statusTone(payment.status)}>
					{toUiLabel(payment.status, paymentStatusLabel)}
				</Badge>
			),
		},
		{
			key: "amount",
			head: "Nominal",
			role: "amount",
			align: "right",
			render: (payment) => formatRupiah(payment.amount),
		},
		{
			key: "paymentDate",
			head: "Tanggal Bayar",
			render: (payment) => dateOnly(payment.paymentDate),
		},
		{
			key: "method",
			head: "Metode",
			render: (payment) => toUiLabel(payment.method, paymentMethodLabel),
		},
		{
			key: "reference",
			head: "Referensi",
			render: (payment) => payment.referenceNo || payment.referenceNumber || "-",
		},
	];

	return (
		<TokoFeatureLayout title="Tagihan & Pembayaran" cartCount={cartCount}>
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>
			<section className="rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eef7ff_55%,#ffffff_100%)] p-5">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
							Tagihan & Pembayaran
						</p>
						<h2 className="mt-2 text-2xl font-semibold text-slate-900">{storeName}</h2>
					</div>
					<div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-right">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sisa Tagihan Aktif</p>
						<p className="mt-2 text-xl font-semibold text-slate-900">{formatRupiah(summary.outstanding)}</p>
					</div>
				</div>
				<p className="mt-4 text-sm leading-6 text-slate-600">
					Pantau faktur aktif, ajukan pembayaran, dan lihat riwayat pembayaran toko dalam satu halaman.
					Transfer akan masuk ke verifikasi akuntan, sementara pembayaran tunai menunggu konfirmasi sales.
				</p>
			</section>

			<StatGrid columns={4}>
				<StatCard label="Faktur Aktif" value={summary.total} loading={loading} />
				<StatCard
					label="Belum Bayar"
					value={summary.unpaid}
					tone={summary.unpaid > 0 ? "danger" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Bayar Sebagian"
					value={summary.partial}
					tone={summary.partial > 0 ? "warning" : "neutral"}
					loading={loading}
				/>
				<StatCard
					label="Sisa Tagihan"
					value={formatRupiah(summary.outstanding)}
					tone={summary.outstanding > 0 ? "warning" : "success"}
					loading={loading}
				/>
			</StatGrid>

			<div role="group" aria-label="Saring status faktur" className="flex flex-wrap gap-2">
				{(["ALL", "UNPAID", "PARTIAL"] as const).map((value) => (
					<button
						key={value}
						type="button"
						aria-pressed={filterStatus === value}
						onClick={() => {
							setFilterStatus(value);
							setInvoicePage(1);
						}}
						className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
							filterStatus === value
								? "bg-brand-600 text-white"
								: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
						}`}
					>
						{value === "ALL" ? "Semua" : toUiLabel(value, invoiceStatusLabel)}
					</button>
				))}
			</div>

			<section className="space-y-3">
				<h3 className="text-base font-semibold text-slate-900 sm:text-lg">Daftar Tagihan</h3>
				<ResponsiveTable
					columns={invoiceColumns}
					data={paginatedInvoices}
					getRowKey={(inv) => inv.id}
					loading={loading}
					onRowClick={(inv) => setDetailInvoice(inv)}
					emptyText="Tidak ada faktur pada filter ini"
					emptyDescription="Coba pilih status lain di atas."
				/>
				<div className="rounded-2xl border border-slate-200 bg-white">
				<PaginationControls
					currentPage={invoiceCurrentPage}
					totalPages={invoiceTotalPages}
					totalItems={filteredInvoices.length}
					currentItemCount={paginatedInvoices.length}
					pageSize={PAGE_SIZE}
					itemLabel="faktur"
					loading={loading}
					onPageChange={setInvoicePage}
					/>
				</div>
			</section>

			<section className="rounded-3xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Riwayat Pengajuan Pembayaran</h2>
						<p className="mt-1 text-sm text-slate-500">
							Menampilkan {paginatedPayments.length} dari {payments.length} pengajuan. Halaman {paymentCurrentPage} dari {paymentTotalPages}
						</p>
					</div>
				</div>
				<div className="mt-4">
					<ResponsiveTable
						columns={paymentColumns}
						data={paginatedPayments}
						getRowKey={(payment) => payment.id}
						loading={loading}
						emptyText="Belum ada pengajuan pembayaran"
						emptyDescription="Pengajuan yang Anda kirim akan muncul di sini beserta statusnya."
					/>
				</div>
				<PaginationControls
					currentPage={paymentCurrentPage}
					totalPages={paymentTotalPages}
					totalItems={payments.length}
					currentItemCount={paginatedPayments.length}
					pageSize={PAGE_SIZE}
					itemLabel="pengajuan"
					loading={loading}
					onPageChange={setPaymentPage}
					className="mt-4"
				/>
			</section>

			<Modal
				isOpen={Boolean(detailInvoice)}
				onClose={() => setDetailInvoice(null)}
				title={detailInvoice ? `Detail Tagihan ${detailInvoice.invoiceNumber}` : "Detail Tagihan"}
				maxWidthClassName="max-w-5xl"
			>
				{detailInvoice ? (
					<div className="space-y-5 text-sm text-slate-700">
						<div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
							<div>
								<p className="text-xs text-slate-500">Faktur</p>
								<p className="font-semibold text-slate-900">{detailInvoice.invoiceNumber}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Tanggal</p>
								<p className="font-semibold text-slate-900">{dateOnly(detailInvoice.invoiceDate)}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status</p>
								<p className="font-semibold text-slate-900">
									{toUiLabel(detailInvoice.status, invoiceStatusLabel)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Riwayat Pembayaran</p>
								<p className="font-semibold text-slate-900">{detailPayments.length} pengajuan</p>
							</div>
						</div>

						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-2xl border border-slate-200 bg-white p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">{formatRupiah(detailInvoice.totalAmount)}</p>
							</div>
							<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Terbayar</p>
								<p className="mt-2 text-lg font-semibold text-emerald-700">{formatRupiah(detailInvoice.paidAmount)}</p>
							</div>
							<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-rose-700">Sisa</p>
								<p className="mt-2 text-lg font-semibold text-rose-700">{formatRupiah(detailInvoice.remainingAmount)}</p>
							</div>
						</div>

						<div className="overflow-hidden rounded-2xl border border-slate-200">
							<div className="border-b border-slate-100 bg-white px-4 py-3">
								<h3 className="font-semibold text-slate-900">Detail Riwayat Pembayaran</h3>
							</div>
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-slate-200 text-sm">
									<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
										<tr>
											<th className="px-4 py-3">Tanggal</th>
											<th className="px-4 py-3">Metode</th>
											<th className="px-4 py-3 text-right">Nominal</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3">Referensi</th>
											<th className="px-4 py-3">Catatan</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{detailPayments.length ? (
											detailPayments.map((payment) => (
												<tr key={payment.id}>
													<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
													<td className="px-4 py-3 text-slate-700">
														{toUiLabel(payment.method, paymentMethodLabel)}
													</td>
													<td className="px-4 py-3 text-right font-semibold text-slate-900">
														{formatRupiah(payment.amount)}
													</td>
													<td className="px-4 py-3">
														<Badge tone={statusTone(payment.status)}>
															{toUiLabel(payment.status, paymentStatusLabel)}
														</Badge>
													</td>
													<td className="px-4 py-3 text-slate-700">
														{payment.referenceNo || payment.referenceNumber || "-"}
													</td>
													<td className="px-4 py-3 text-slate-700">{payment.notes || "-"}</td>
												</tr>
											))
										) : (
											<tr>
												<td colSpan={6} className="px-4 py-6 text-center text-slate-500">
													Belum ada riwayat pembayaran untuk faktur ini.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>

						<div className="flex justify-end gap-3">
							{detailInvoice.remainingAmount > 0 ? (
								<button
									type="button"
									onClick={() => {
										setDetailInvoice(null);
										openPayment(detailInvoice);
									}}
									className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
								>
									Ajukan Pembayaran
								</button>
							) : null}
						</div>
					</div>
				) : null}
			</Modal>

			<Modal
				isOpen={Boolean(selected)}
				onClose={() => setSelected(null)}
				title="Ajukan Pembayaran"
			>
				{selected ? (
					<div className="space-y-5">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
								Formulir Pembayaran
							</p>
							<p className="mt-2 text-sm text-slate-600">
								{selected.invoiceNumber} - sisa tagihan {formatRupiah(selected.remainingAmount)}
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Faktur</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">
									{formatRupiah(selected.totalAmount)}
								</p>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-emerald-600">Sudah Dibayar</p>
								<p className="mt-2 text-lg font-semibold text-emerald-700">
									{formatRupiah(selected.paidAmount)}
								</p>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-rose-50 p-4">
								<p className="text-xs uppercase tracking-[0.18em] text-rose-600">Sisa Tagihan</p>
								<p className="mt-2 text-lg font-semibold text-rose-700">
									{formatRupiah(selected.remainingAmount)}
								</p>
							</div>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Jumlah Pembayaran</span>
								<input
									type="number"
									min={1}
									max={selected.remainingAmount}
									className="w-full rounded-xl border border-slate-300 px-3 py-2"
									value={payAmount}
									onChange={(e) => setPayAmount(Number(e.target.value))}
									disabled={submitting}
								/>
							</label>
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Metode Pembayaran</span>
								<select
									className="w-full rounded-xl border border-slate-300 min-h-11 px-3 md:min-h-10"
									value={payMethod}
									onChange={(e) => {
										const nextMethod = e.target.value as PaymentMethod;
										setPayMethod(nextMethod);
										if (nextMethod === "CASH") setPayRef("");
									}}
									disabled={submitting}
								>
									<option value="TRANSFER">Transfer</option>
									<option value="CASH">Tunai</option>
								</select>
							</label>
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Nomor Referensi / Bukti Transfer</span>
								<input
									className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
									placeholder={payMethod === "TRANSFER" ? "Wajib untuk transfer" : "Tidak tersedia untuk tunai"}
									value={payRef}
									onChange={(e) => setPayRef(e.target.value)}
									disabled={submitting || payMethod === "CASH"}
								/>
							</label>
							<label className="space-y-1.5 text-sm text-slate-700">
								<span>Catatan</span>
								<input
									className="w-full rounded-xl border border-slate-300 px-3 py-2"
									placeholder="Opsional"
									value={payNotes}
									onChange={(e) => setPayNotes(e.target.value)}
									disabled={submitting}
								/>
							</label>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setSelected(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => void handleSubmitPayment()}
								disabled={isSubmitDisabled}
								className="rounded-xl bg-brand-600 px-6 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
							>
								{submitting ? "Mengajukan..." : "Ajukan Pembayaran"}
							</button>
						</div>
					</div>
				) : null}
			</Modal>
		</TokoFeatureLayout>
	);
}
