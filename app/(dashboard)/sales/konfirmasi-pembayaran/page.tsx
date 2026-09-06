"use client";

export const dynamic = "force-dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import SearchCombobox from "@/components/shared/SearchCombobox";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatAppDate, formatLocalDateInput } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import {
	paymentMethodLabel,
	paymentStatusLabel,
	statusTone,
	toUiLabel,
} from "@/lib/ui-labels";
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

const dateOnly = (value?: string | null) => (value ? formatAppDate(value) : "-");

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
			const paymentResult = await paymentsService.listAllForSales({
					storeId: storeFilter || undefined,
					sortBy: "paymentDate",
					sortOrder: "desc",
				});
			setPayments(paymentResult);
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
			setSuccess(`Pembayaran ${payment.invoice?.invoiceNumber || "-"} berhasil dikonfirmasi.`);
			setSelectedPayment(null);
			await load();
		} catch (verifyError: unknown) {
			setError(getApiErrorMessage(verifyError, "Gagal mengonfirmasi pembayaran."));
		} finally {
			setSubmitting(false);
		}
	};

	const paymentColumns: ResponsiveColumn<Payment>[] = [
		{
			key: "invoice",
			head: "Invoice",
			role: "title",
			render: (payment) => (
				<span className="block">
					<span className="block font-medium text-slate-900">
						{payment.invoice?.invoiceNumber || "-"}
					</span>
					<span className="block text-xs text-slate-500">{getStoreName(payment)}</span>
				</span>
			),
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
			head: "Dibayarkan",
			role: "amount",
			align: "right",
			render: (payment) => formatRupiah(payment.amount),
		},
		{ key: "store", head: "Toko", render: getStoreName, hideOnCard: true },
		{
			key: "paymentDate",
			head: "Tanggal",
			render: (payment) => dateOnly(payment.paymentDate),
		},
		{
			key: "method",
			head: "Metode",
			render: (payment) => (
				<Badge tone={payment.method === "CASH" ? "brand" : "neutral"}>
					{toUiLabel(payment.method, paymentMethodLabel)}
				</Badge>
			),
		},
		{
			key: "totalAmount",
			head: "Total Tagihan",
			align: "right",
			render: (payment) => formatRupiah(payment.invoice?.totalAmount ?? 0),
		},
		{
			key: "remainingAmount",
			head: "Sisa Tagihan",
			align: "right",
			render: (payment) => (
				<span className="font-semibold text-rose-700">
					{formatRupiah(payment.invoice?.remainingAmount ?? 0)}
				</span>
			),
		},
		{
			key: "reference",
			head: "Referensi",
			render: (payment) => payment.referenceNo || payment.referenceNumber || "-",
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (payment) =>
				isSalesConfirmablePayment(payment) ? (
					<Button
						variant="primary"
						size="sm"
						disabled={submitting}
						onClick={() => setSelectedPayment(payment)}
					>
						Konfirmasi
					</Button>
				) : (
					<span className="text-xs text-slate-400">-</span>
				),
		},
	];

	return (
		<SalesPortalShell title="Konfirmasi Pembayaran">
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>

			<StatGrid columns={3}>
				<StatCard
					label="Perlu Konfirmasi"
					value={`${summary.needConfirmation} pembayaran`}
					tone={summary.needConfirmation > 0 ? "warning" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Nominal Menunggu"
					value={formatRupiah(summary.pendingAmount)}
					tone={summary.pendingAmount > 0 ? "warning" : "neutral"}
					loading={loading}
				/>
				<StatCard
					label="Dikonfirmasi Hari Ini"
					value={`${summary.verifiedToday} pembayaran`}
					tone={summary.verifiedToday > 0 ? "success" : "neutral"}
					loading={loading}
				/>
			</StatGrid>

			<Card>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Cari invoice, toko, atau referensi"
						className="h-11 rounded-xl border border-slate-300 px-3 text-sm md:h-10"
					/>
					<SearchCombobox
						value={storeFilter}
						selectedOption={stores.find((store) => store.storeId === storeFilter) ? { value: storeFilter, label: stores.find((store) => store.storeId === storeFilter)?.storeName ?? "Toko" } : null}
						loadOptions={async (query) => {
							const result = await salesService.listManagedStoresPage({ page: 1, limit: 10, search: query });
							setStores((current) => Array.from(new Map([...current, ...result.data].map((store) => [store.storeId, store])).values()));
							return result.data.map((store) => ({ value: store.storeId, label: store.storeName, description: store.email }));
						}}
						onChange={(storeId) => setStoreFilter(storeId)}
						placeholder="Cari toko atau email"
					/>
					<select
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
						className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm md:h-10"
					>
						<option value="PENDING">Menunggu</option>
						<option value="VERIFIED">Terverifikasi</option>
						<option value="CANCELLED">Dibatalkan</option>
						<option value="ALL">Semua Status</option>
					</select>
					<select
						value={methodFilter}
						onChange={(event) => setMethodFilter(event.target.value as MethodFilter)}
						className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm md:h-10"
					>
						<option value="CASH">Tunai</option>
						<option value="TRANSFER">Transfer</option>
						<option value="ALL">Semua Metode</option>
					</select>
				</div>
			</Card>

			<section className="space-y-3">
				<h2 className="text-base font-semibold text-slate-900 sm:text-lg">
					Daftar Pembayaran Toko
				</h2>
				<ResponsiveTable
					columns={paymentColumns}
					data={filteredPayments}
					getRowKey={(payment) => payment.id}
					loading={loading}
					emptyText="Tidak ada pembayaran sesuai filter"
					emptyDescription="Coba ubah kata kunci, toko, metode, atau rentang tanggal."
				/>
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
								{ label: "Invoice", value: selectedPayment.invoice?.invoiceNumber || "-" },
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

function SalesPaymentConfirmationPageContent() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-[40dvh] items-center justify-center text-sm text-slate-600">
					Memuat konfirmasi pembayaran sales...
				</div>
			}
		>
			<SalesPaymentConfirmationContent />
		</Suspense>
	);
}

export default function SalesPaymentConfirmationPage() {
	return (
		<Suspense fallback={null}>
			<SalesPaymentConfirmationPageContent />
		</Suspense>
	);
}
