"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import Modal from "@/components/shared/Modal";
import PaginationControls from "@/components/shared/PaginationControls";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import StatCard, { StatGrid } from "@/components/shared/StatCard";
import { formatRupiah } from "@/lib/format";
import type { StatusTone } from "@/lib/ui-labels";
import { type GradePaginationMeta, type StoreGradeItem } from "@/services/grade";
import { storesService, type Store } from "@/services/stores";

const averageMonthlyPurchase = (row: StoreGradeItem) =>
	Number.isFinite(row.averageMonthlyPurchase) ? row.averageMonthlyPurchase : row.recentSalesAmount / 3;

const averagePaymentDays = (row: StoreGradeItem) =>
	Number.isFinite(row.averagePaymentDays) ? row.averagePaymentDays : 0;

// Grade adalah skala berurut; nadanya menurun A -> D, bukan satu hue per huruf.
const gradeTone = (grade: StoreGradeItem["grade"]): StatusTone => {
	if (grade === "N") return "brand";
	if (grade === "A+" || grade === "A") return "success";
	if (grade === "B+" || grade === "B") return "brand";
	if (grade === "C+" || grade === "C") return "warning";
	return "danger";
};

export type GradeFilter = "ALL" | StoreGradeItem["grade"];

const gradeOptions: Array<{ value: GradeFilter; label: string }> = [
	{ value: "ALL", label: "Semua Grade" },
	{ value: "N", label: "Grade N - Toko baru" },
	{ value: "A+", label: "Grade A+" },
	{ value: "A", label: "Grade A" },
	{ value: "B+", label: "Grade B+" },
	{ value: "B", label: "Grade B" },
	{ value: "C+", label: "Grade C+" },
	{ value: "C", label: "Grade C" },
	{ value: "D", label: "Grade D" },
];

interface StoreGradeWorkspaceProps {
	rows: StoreGradeItem[];
	search: string;
	gradeFilter: GradeFilter;
	loading?: boolean;
	onSearchChange: (value: string) => void;
	onGradeFilterChange: (value: GradeFilter) => void;
	transactionDetailSource?: "grade" | "sales" | "toko";
	pagination?: GradePaginationMeta | null;
	onPageChange?: (page: number) => void;
}

const transactionDetailHref = (
	storeId: string,
	source: StoreGradeWorkspaceProps["transactionDetailSource"],
) => {
	if (source === "sales") {
		return `/sales/grade-toko/${storeId}/transaksi`;
	}
	return `/grade-toko/${storeId}/transaksi?from=${source ?? "grade"}`;
};

export default function StoreGradeWorkspace({
	rows,
	search,
	gradeFilter,
	loading = false,
	onSearchChange,
	onGradeFilterChange,
	transactionDetailSource = "grade",
	pagination,
	onPageChange,
}: StoreGradeWorkspaceProps) {
	const [selectedStoreRow, setSelectedStoreRow] = useState<StoreGradeItem | null>(null);
	const [selectedStore, setSelectedStore] = useState<Store | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState("");
	const summary = useMemo(
		() => ({
			totalStores: pagination?.totalItems ?? rows.length,
			totalOutstanding: rows.reduce((sum, row) => sum + row.totalOutstandingAmount, 0),
			topRiskStores: rows.filter((row) => row.grade === "D").length,
		}),
		[pagination?.totalItems, rows],
	);

	const totalPages = Math.max(1, pagination?.totalPages ?? 1);
	const currentPage = Math.min(pagination?.currentPage ?? 1, totalPages);

	const handleOpenStoreDetail = async (row: StoreGradeItem) => {
		setSelectedStoreRow(row);
		setSelectedStore(null);
		setDetailError("");
		setDetailLoading(true);
		try {
			const store = await storesService.getById(row.storeId);
			setSelectedStore(store);
		} catch {
			setDetailError("Gagal memuat detail toko.");
		} finally {
			setDetailLoading(false);
		}
	};

	const gradeColumns: ResponsiveColumn<StoreGradeItem>[] = [
		{
			key: "store",
			head: "Toko",
			role: "title",
			render: (row) => (
				<span className="block">
					<span className="block font-medium text-slate-900">{row.storeName}</span>
					<span className="block text-xs text-slate-500">{row.email}</span>
				</span>
			),
		},
		{
			key: "grade",
			head: "Grade",
			role: "status",
			render: (row) => <Badge tone={gradeTone(row.grade)}>Grade {row.grade}</Badge>,
		},
		{
			key: "average",
			head: "Rata-rata / bulan",
			role: "amount",
			align: "right",
			render: (row) => formatRupiah(averageMonthlyPurchase(row)),
		},
		{
			key: "paymentDays",
			head: "Pembayaran Rata-rata",
			render: (row) => `${averagePaymentDays(row).toLocaleString("id-ID")} hari`,
		},
		{
			key: "storeAgeDays",
			head: "Usia Toko",
			render: (row) => `${row.storeAgeDays} hari`,
		},
		{
			key: "action",
			head: "Aksi",
			role: "action",
			align: "right",
			render: (row) => (
				<span className="inline-flex flex-wrap justify-end gap-2">
					<Button variant="secondary" size="sm" onClick={() => void handleOpenStoreDetail(row)}>
						Detail Toko
					</Button>
					<Button
						size="sm"
						href={transactionDetailHref(row.storeId, transactionDetailSource)}
					>
						Detail Transaksi
					</Button>
				</span>
			),
		},
	];

	return (
		<div className="space-y-6">
			<StatGrid columns={3}>
				<StatCard label="Total Toko" value={summary.totalStores} loading={loading} />
				<StatCard
					label="Sisa Piutang"
					value={formatRupiah(summary.totalOutstanding)}
					tone={summary.totalOutstanding > 0 ? "warning" : "success"}
					loading={loading}
				/>
				<StatCard
					label="Grade Risiko Tinggi"
					value={summary.topRiskStores}
					tone={summary.topRiskStores > 0 ? "danger" : "success"}
					loading={loading}
				/>
			</StatGrid>

			<Card>
				<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
					<input
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Cari nama toko atau email"
						className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
					/>
					<select
						value={gradeFilter}
						onChange={(event) => onGradeFilterChange(event.target.value as GradeFilter)}
						className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
					>
						{gradeOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<p className="mt-3 text-xs leading-5 text-slate-500">
					Pencarian dan filter grade diterapkan ke seluruh data di server sebelum hasil dibagi menjadi 10 toko per halaman. Ringkasan selain Total Toko mengikuti data pada halaman aktif.
				</p>
			</Card>

			<section className="space-y-3">
				<ResponsiveTable
					columns={gradeColumns}
					data={rows}
					getRowKey={(row) => row.storeId}
					loading={loading}
					emptyText="Tidak ada data grade toko"
					emptyDescription="Coba ubah kata kunci atau filter grade."
				/>
				{pagination && onPageChange ? (
					<div className="rounded-2xl border border-slate-200 bg-white">
						<PaginationControls
							currentPage={currentPage}
							totalPages={totalPages}
							totalItems={pagination.totalItems}
							currentItemCount={rows.length}
							pageSize={10}
							itemLabel="toko"
							loading={loading}
							onPageChange={onPageChange}
						/>
					</div>
				) : null}
			</section>

			<Modal
				isOpen={Boolean(selectedStoreRow)}
				onClose={() => {
					setSelectedStoreRow(null);
					setSelectedStore(null);
					setDetailError("");
				}}
				title="Detail Toko"
			>
				{selectedStoreRow ? (
					<div className="space-y-4 text-sm text-slate-700">
						{detailError ? (
							<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
								{detailError}
							</div>
						) : null}
						{detailLoading && !selectedStore ? (
							<p className="text-slate-500">Memuat detail toko...</p>
						) : (
							<>
								<div className="grid gap-3 md:grid-cols-2">
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nama Toko</p>
										<p className="mt-2 font-semibold text-slate-900">{selectedStore?.name ?? selectedStoreRow.storeName}</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</p>
										<p className="mt-2 font-semibold text-slate-900">{selectedStore?.email ?? selectedStoreRow.email}</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Telepon</p>
										<p className="mt-2 font-semibold text-slate-900">{selectedStore?.phone ?? "-"}</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sales Penanggung Jawab</p>
										<p className="mt-2 font-semibold text-slate-900">{selectedStore?.assignedSalesUser?.name ?? "-"}</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Limit Kredit</p>
										<p className="mt-2 font-semibold text-slate-900">
											{formatRupiah(selectedStore?.creditLimit ?? selectedStoreRow.creditLimit)}
										</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Grade</p>
										<p className="mt-2 font-semibold text-slate-900">Grade {selectedStoreRow.grade}</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Usia Toko</p>
										<p className="mt-2 font-semibold text-slate-900">{selectedStoreRow.storeAgeDays} hari</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoice Periode Evaluasi</p>
										<p className="mt-2 font-semibold text-slate-900">{selectedStoreRow.recentInvoices} invoice</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Rata-rata Pembelian Bulanan</p>
										<p className="mt-2 font-semibold text-slate-900">{formatRupiah(averageMonthlyPurchase(selectedStoreRow))}</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Rata-rata Hari Pembayaran</p>
										<p className="mt-2 font-semibold text-slate-900">{averagePaymentDays(selectedStoreRow).toLocaleString("id-ID")} hari</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Catatan Grade</p>
										<p className="mt-2 font-semibold text-slate-900">{selectedStoreRow.gradeReason}</p>
									</div>
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Alamat</p>
										<p className="mt-2 font-semibold text-slate-900">
											{selectedStore?.address ?? "-"}
											{selectedStore?.city
												? `, ${selectedStore.city.name}${selectedStore.city.province ? `, ${selectedStore.city.province}` : ""}`
												: ""}
										</p>
									</div>
								</div>

								<div className="grid gap-3 md:grid-cols-2">
									<div className="rounded-xl border border-slate-200 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nama Pemilik</p>
										<p className="mt-2 font-medium text-slate-900">{selectedStore?.documents?.ownerName ?? "-"}</p>
									</div>
									<div className="rounded-xl border border-slate-200 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">NIK Pemilik</p>
										<p className="mt-2 font-medium text-slate-900">{selectedStore?.documents?.ownerNik ?? "-"}</p>
									</div>
									<div className="rounded-xl border border-slate-200 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">NIB</p>
										<p className="mt-2 font-medium text-slate-900">{selectedStore?.documents?.ownerNib ?? "-"}</p>
									</div>
									<div className="rounded-xl border border-slate-200 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">NPWP</p>
										<p className="mt-2 font-medium text-slate-900">{selectedStore?.documents?.ownerNpwp ?? "-"}</p>
									</div>
									<div className="rounded-xl border border-slate-200 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Izin Usaha</p>
										<p className="mt-2 font-medium text-slate-900">{selectedStore?.documents?.businessLicense ?? "-"}</p>
									</div>
									<div className="rounded-xl border border-slate-200 p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Perkiraan Omzet Bulanan</p>
										<p className="mt-2 font-medium text-slate-900">
											{formatRupiah(selectedStore?.documents?.estimatedMonthlyRevenue ?? 0)}
										</p>
									</div>
								</div>
							</>
						)}
					</div>
				) : null}
			</Modal>

		</div>
	);
}
