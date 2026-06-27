"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/shared/Modal";
import { type StoreGradeItem } from "@/services/grade";
import { storesService, type Store } from "@/services/stores";

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

const verificationLabel: Record<string, string> = {
	PENDING: "Menunggu Verifikasi",
	VERIFIED: "Terverifikasi",
	REJECTED: "Ditolak",
};

const gradeTone = (grade: StoreGradeItem["grade"]) => {
	if (grade === "N") return "bg-violet-100 text-violet-700";
	if (grade === "A") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
	if (grade === "B") return "bg-sky-100 text-sky-700";
	if (grade === "C") return "border border-amber-200 bg-amber-50 text-amber-700";
	if (grade === "D") return "bg-orange-100 text-orange-700";
	return "border border-rose-200 bg-rose-50 text-rose-700";
};

type GradeFilter = "ALL" | StoreGradeItem["grade"];

const gradeOptions: Array<{ value: GradeFilter; label: string }> = [
	{ value: "ALL", label: "Semua Grade" },
	{ value: "N", label: "Grade N - Toko baru" },
	{ value: "A", label: "Grade A" },
	{ value: "B", label: "Grade B" },
	{ value: "C", label: "Grade C" },
	{ value: "D", label: "Grade D" },
	{ value: "E", label: "Grade E" },
];

interface StoreGradeWorkspaceProps {
	rows: StoreGradeItem[];
	search: string;
	loading?: boolean;
	onSearchChange: (value: string) => void;
	transactionDetailSource?: "grade" | "sales" | "toko";
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
	loading = false,
	onSearchChange,
	transactionDetailSource = "grade",
}: StoreGradeWorkspaceProps) {
	const [selectedStoreRow, setSelectedStoreRow] = useState<StoreGradeItem | null>(null);
	const [selectedStore, setSelectedStore] = useState<Store | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState("");
	const [gradeFilter, setGradeFilter] = useState<GradeFilter>("ALL");

	const filteredRows = useMemo(
		() => (gradeFilter === "ALL" ? rows : rows.filter((row) => row.grade === gradeFilter)),
		[gradeFilter, rows],
	);

	const gradeCounts = useMemo(
		() =>
			rows.reduce(
				(acc, row) => {
					acc[row.grade] += 1;
					return acc;
				},
				{ N: 0, A: 0, B: 0, C: 0, D: 0, E: 0 } as Record<StoreGradeItem["grade"], number>,
			),
		[rows],
	);

	const summary = useMemo(
		() => ({
			totalStores: filteredRows.length,
			verifiedStores: filteredRows.filter((row) => row.verificationStatus === "VERIFIED").length,
			totalOutstanding: filteredRows.reduce((sum, row) => sum + row.totalOutstandingAmount, 0),
			topRiskStores: filteredRows.filter((row) => row.grade === "D" || row.grade === "E").length,
		}),
		[filteredRows],
	);

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

	return (
		<div className="space-y-6">
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Toko</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalStores}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Terverifikasi</p>
					<p className="mt-2 text-3xl font-semibold text-emerald-700">{summary.verifiedStores}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sisa Piutang</p>
					<p className="mt-2 text-lg font-semibold text-slate-900">{formatRupiah(summary.totalOutstanding)}</p>
				</div>
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Grade Risiko Tinggi</p>
					<p className="mt-2 text-3xl font-semibold text-rose-700">{summary.topRiskStores}</p>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
					<input
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Cari nama toko, email, atau grade"
						className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
					/>
					<select
						value={gradeFilter}
						onChange={(event) => setGradeFilter(event.target.value as GradeFilter)}
						className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
					>
						{gradeOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.value === "ALL"
									? `${option.label} (${rows.length})`
									: `${option.label} (${gradeCounts[option.value]})`}
							</option>
						))}
					</select>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Grade</th>
							<th className="px-4 py-3">Verifikasi</th>
							<th className="px-4 py-3">Ringkasan Penilaian</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Memuat grade toko...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={5}>
									Tidak ada data grade toko pada filter ini.
								</td>
							</tr>
						) : (
							filteredRows.map((row) => (
								<tr key={row.storeId}>
									<td className="px-4 py-3 align-top">
										<div className="font-medium text-slate-900">{row.storeName}</div>
										<div className="text-slate-500">{row.email}</div>
										<div className="mt-1 text-xs text-slate-500">Usia toko {row.storeAgeDays} hari</div>
									</td>
									<td className="px-4 py-3 align-top">
										<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gradeTone(row.grade)}`}>
											Grade {row.grade}
										</span>
									</td>
									<td className="px-4 py-3 align-top text-slate-700">
										{verificationLabel[row.verificationStatus] ?? row.verificationStatus}
									</td>
									<td className="px-4 py-3 align-top text-slate-700">
										<div className="font-medium text-slate-900">{row.recentInvoices} invoice aktif</div>
										<div className="text-xs text-slate-500">
											Piutang {formatRupiah(row.recentOutstandingAmount)}
										</div>
									</td>
									<td className="px-4 py-3 align-top">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => void handleOpenStoreDetail(row)}
												className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
											>
												Detail Toko
											</button>
											<Link
												href={transactionDetailHref(row.storeId, transactionDetailSource)}
												className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
											>
												Detail Transaksi
											</Link>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
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
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status Verifikasi</p>
										<p className="mt-2 font-semibold text-slate-900">
											{verificationLabel[selectedStore?.verificationStatus ?? selectedStoreRow.verificationStatus] ??
												(selectedStore?.verificationStatus ?? selectedStoreRow.verificationStatus)}
										</p>
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
										<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Piutang Periode Evaluasi</p>
										<p className="mt-2 font-semibold text-slate-900">{formatRupiah(selectedStoreRow.recentOutstandingAmount)}</p>
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
