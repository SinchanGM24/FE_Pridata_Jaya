"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Modal from "@/components/shared/Modal";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatLocalDateInput } from "@/lib/datetime";
import { paymentMethodLabel, paymentStatusLabel, toUiLabel } from "@/lib/ui-labels";
import type { StoreGradeItem } from "@/services/grade";
import {
	paymentsService,
	type Payment,
	type PaymentMethod,
	type PaymentStatus,
} from "@/services/payments";
import { salesService } from "@/services/sales";

type StatusFilter = "ALL" | PaymentStatus;
type MethodFilter = "ALL" | PaymentMethod;

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

const statusTone: Record<string, string> = {
	PENDING: "border-amber-200 bg-amber-50/80 text-amber-800",
	VERIFIED: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
	CANCELLED: "border-slate-200 bg-slate-100/80 text-slate-600",
};

const methodTone: Record<string, string> = {
	CASH: "border-sky-200 bg-sky-50/80 text-sky-800",
	TRANSFER: "border-violet-200 bg-violet-50/80 text-violet-800",
};

const isSalesConfirmablePayment = (payment: Payment) =>
	payment.method === "CASH" &&
	payment.status === "PENDING" &&
	(payment.verificationTarget === "SALES" || !payment.verificationTarget);

function SalesPaymentConfirmationContent() {
	const searchParams = useSearchParams();
	const initialStoreId = searchParams.get("storeId") ?? "";
	const [payments, setPayments] = useState<Payment[]>([]);
	const [stores, setStores] = useState<StoreGradeItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [storeFilter, setStoreFilter] = useState(initialStoreId);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
	const [methodFilter, setMethodFilter] = useState<MethodFilter>("CASH");
	const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

	const storeNameById = useMemo(
		() => new Map(stores.map((store) => [store.storeId, store.storeName])),
		[stores],
	);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [paymentResult, storeResult] = await Promise.all([
				paymentsService.listAllForSales({
					storeId: storeFilter || undefined,
					sortBy: "paymentDate",
					sortOrder: "desc",
				}),
				salesService.getManagedStores(),
			]);
			setPayments(paymentResult);
			setStores(storeResult);
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data konfirmasi pembayaran."));
		} finally {
			setLoading(false);
		}
	}, [storeFilter]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	const filteredPayments = useMemo(() => {
		const query = search.trim().toLowerCase();
		return payments.filter((payment) => {
			const storeName =
				payment.invoice?.storeNameSnapshot || storeNameById.get(payment.storeId) || "";
			const reference = payment.referenceNo || payment.referenceNumber || "";
			const matchSearch =
				!query ||
				payment.invoice?.invoiceNumber.toLowerCase().includes(query) ||
				payment.invoiceId.toLowerCase().includes(query) ||
				storeName.toLowerCase().includes(query) ||
				reference.toLowerCase().includes(query);
			const matchStatus = statusFilter === "ALL" || payment.status === statusFilter;
			const matchMethod = methodFilter === "ALL" || payment.method === methodFilter;
			return matchSearch && matchStatus && matchMethod;
		});
	}, [methodFilter, payments, search, statusFilter, storeNameById]);

	const pendingSalesPayments = useMemo(
		() => payments.filter((payment) => isSalesConfirmablePayment(payment)),
		[payments],
	);

	const summary = useMemo(
		() => ({
			needConfirmation: pendingSalesPayments.length,
			pendingAmount: pendingSalesPayments.reduce((sum, payment) => sum + payment.amount, 0),
			verifiedToday: payments.filter(
				(payment) =>
					payment.status === "VERIFIED" &&
					dateOnly(payment.verifiedAt || payment.updatedAt) === formatLocalDateInput(),
			).length,
		}),
		[payments, pendingSalesPayments],
	);

	const getStoreName = (payment: Payment) =>
		payment.invoice?.storeNameSnapshot || storeNameById.get(payment.storeId) || "-";

	const handleVerify = async (payment: Payment) => {
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await paymentsService.verifyForSales(payment.id);
			setSuccess(`Pembayaran ${payment.invoice?.invoiceNumber || payment.invoiceId} berhasil dikonfirmasi.`);
			setSelectedPayment(null);
			await load();
		} catch (verifyError: unknown) {
			setError(getApiErrorMessage(verifyError, "Gagal mengonfirmasi pembayaran."));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<SalesPortalShell title="Konfirmasi Pembayaran">
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-3">
				{[
					{ label: "Perlu Konfirmasi", value: `${summary.needConfirmation} pembayaran` },
					{ label: "Nominal Menunggu", value: formatRupiah(summary.pendingAmount) },
					{ label: "Dikonfirmasi Hari Ini", value: `${summary.verifiedToday} pembayaran` },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
							{item.label}
						</p>
						<p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Cari invoice, toko, atau referensi"
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
					<select
						value={storeFilter}
						onChange={(event) => setStoreFilter(event.target.value)}
						className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						<option value="">Semua Toko</option>
						{stores.map((store) => (
							<option key={store.storeId} value={store.storeId}>
								{store.storeName}
							</option>
						))}
					</select>
					<select
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
						className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						<option value="PENDING">Menunggu</option>
						<option value="VERIFIED">Terverifikasi</option>
						<option value="CANCELLED">Dibatalkan</option>
						<option value="ALL">Semua Status</option>
					</select>
					<select
						value={methodFilter}
						onChange={(event) => setMethodFilter(event.target.value as MethodFilter)}
						className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						<option value="CASH">Tunai</option>
						<option value="TRANSFER">Transfer</option>
						<option value="ALL">Semua Metode</option>
					</select>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-lg font-semibold text-slate-900">Daftar Pembayaran Toko</h2>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Invoice</th>
								<th className="px-4 py-3">Toko</th>
								<th className="px-4 py-3">Tanggal</th>
								<th className="px-4 py-3">Metode</th>
								<th className="px-4 py-3 text-right">Total Tagihan</th>
								<th className="px-4 py-3 text-right">Dibayarkan</th>
								<th className="px-4 py-3 text-right">Sisa Tagihan</th>
								<th className="px-4 py-3">Referensi</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{loading ? (
								<tr>
									<td colSpan={10} className="px-4 py-4 text-slate-600">
										Memuat pembayaran...
									</td>
								</tr>
							) : filteredPayments.length === 0 ? (
								<tr>
									<td colSpan={10} className="px-4 py-4 text-slate-600">
										Tidak ada pembayaran sesuai filter.
									</td>
								</tr>
							) : (
								filteredPayments.map((payment) => (
									<tr key={payment.id}>
										<td className="px-4 py-3 font-medium text-slate-900">
											{payment.invoice?.invoiceNumber || payment.invoiceId}
										</td>
										<td className="px-4 py-3 text-slate-700">{getStoreName(payment)}</td>
										<td className="px-4 py-3 text-slate-700">{dateOnly(payment.paymentDate)}</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
													methodTone[payment.method] ?? "border-slate-200 bg-slate-100 text-slate-700"
												}`}
											>
												{toUiLabel(payment.method, paymentMethodLabel)}
											</span>
										</td>
										<td className="px-4 py-3 text-right font-semibold text-slate-900">
											{formatRupiah(payment.invoice?.totalAmount ?? 0)}
										</td>
										<td className="px-4 py-3 text-right font-semibold text-slate-900">
											{formatRupiah(payment.amount)}
										</td>
										<td className="px-4 py-3 text-right font-semibold text-rose-700">
											{formatRupiah(payment.invoice?.remainingAmount ?? 0)}
										</td>
										<td className="px-4 py-3 text-slate-700">
											{payment.referenceNo || payment.referenceNumber || "-"}
										</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
													statusTone[payment.status] ?? "border-slate-200 bg-slate-100 text-slate-700"
												}`}
											>
												{toUiLabel(payment.status, paymentStatusLabel)}
											</span>
										</td>
										<td className="px-4 py-3 text-right">
											{isSalesConfirmablePayment(payment) ? (
												<button
													type="button"
													onClick={() => setSelectedPayment(payment)}
													disabled={submitting}
													className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
												>
													Konfirmasi
												</button>
											) : (
												<span className="text-xs text-slate-400">-</span>
											)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>

			<Modal
				isOpen={Boolean(selectedPayment)}
				onClose={() => setSelectedPayment(null)}
				title="Konfirmasi Pembayaran Tunai"
			>
				{selectedPayment ? (
					<div className="space-y-5 text-sm text-slate-700">
						<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
							Pastikan uang tunai sudah diterima sebelum pembayaran dikonfirmasi.
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							{[
								{ label: "Invoice", value: selectedPayment.invoice?.invoiceNumber || selectedPayment.invoiceId },
								{ label: "Toko", value: getStoreName(selectedPayment) },
								{ label: "Tanggal Bayar", value: dateOnly(selectedPayment.paymentDate) },
								{ label: "Total Tagihan", value: formatRupiah(selectedPayment.invoice?.totalAmount ?? 0) },
								{ label: "Dibayarkan", value: formatRupiah(selectedPayment.amount) },
								{ label: "Sisa Tagihan", value: formatRupiah(selectedPayment.invoice?.remainingAmount ?? 0) },
								{ label: "Referensi", value: selectedPayment.referenceNo || selectedPayment.referenceNumber || "-" },
								{ label: "Catatan", value: selectedPayment.notes || "-" },
							].map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
										{item.label}
									</p>
									<p className="mt-2 font-semibold text-slate-900">{item.value}</p>
								</div>
							))}
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setSelectedPayment(null)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => void handleVerify(selectedPayment)}
								disabled={submitting}
								className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
							>
								{submitting ? "Mengonfirmasi..." : "Konfirmasi"}
							</button>
						</div>
					</div>
				) : null}
			</Modal>

		</SalesPortalShell>
	);
}

export default function SalesPaymentConfirmationPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
					Memuat konfirmasi pembayaran sales...
				</div>
			}
		>
			<SalesPaymentConfirmationContent />
		</Suspense>
	);
}
