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
	if (grade === "A") return "bg-emerald-100 text-emerald-700";
	if (grade === "B") return "bg-sky-100 text-sky-700";
	if (grade === "C") return "bg-amber-100 text-amber-700";
	if (grade === "D") return "bg-orange-100 text-orange-700";
	return "bg-rose-100 text-rose-700";
};

interface StoreGradeWorkspaceProps {
	rows: StoreGradeItem[];
	search: string;
	loading?: boolean;
	onSearchChange: (value: string) => void;
	onRefresh?: () => void;
	transactionDetailSource?: "grade" | "sales" | "toko";
}

export default function StoreGradeWorkspace({
	rows,
	search,
	loading = false,
	onSearchChange,
	onRefresh,
	transactionDetailSource = "grade",
}: StoreGradeWorkspaceProps) {
	const [selectedStoreRow, setSelectedStoreRow] = useState<StoreGradeItem | null>(null);
	const [selectedStore, setSelectedStore] = useState<Store | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState("");

	const summary = useMemo(
		() => ({
			totalStores: rows.length,
			verifiedStores: rows.filter((row) => row.verificationStatus === "VERIFIED").length,
			totalOutstanding: rows.reduce((sum, row) => sum + row.totalOutstandingAmount, 0),
			topRiskStores: rows.filter((row) => row.grade === "D" || row.grade === "E").length,
		}),
		[rows],
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
				<div className="flex flex-col gap-3 md:flex-row">
					<input
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Cari nama toko, email, atau grade"
						className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
					/>
					{onRefresh ? (
						<button
							type="button"
							onClick={onRefresh}
							className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>
							Muat Ulang
						</button>
					) : null}
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Grade</th>
							<th className="px-4 py-3">Verifikasi</th>
							<th className="px-4 py-3">Ringkasan 3 Bulan</th>
							<th className="px-4 py-3">Catatan</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Memuat grade toko...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={6}>
									Tidak ada data grade toko.
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<tr key={row.storeId}>
									<td className="px-4 py-3 align-top">
										<div className="font-medium text-slate-900">{row.storeName}</div>
										<div className="text-slate-500">{row.email}</div>
										<div className="mt-1 text-xs text-slate-500">Usia toko {row.storeAgeDays} hari</div>
									</td>
									<td className="px-4 py-3 align-top">
										<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${gradeTone(row.grade)}`}>
											Grade {row.grade}
										</span>
									</td>
									<td className="px-4 py-3 align-top text-slate-700">
										{verificationLabel[row.verificationStatus] ?? row.verificationStatus}
									</td>
									<td className="px-4 py-3 align-top text-slate-700">
										<div>{row.recentOrders} order</div>
										<div>{row.recentInvoices} invoice</div>
										<div className="font-medium text-slate-900">{formatRupiah(row.recentOutstandingAmount)}</div>
									</td>
									<td className="px-4 py-3 align-top text-slate-600">{row.gradeReason}</td>
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
												href={`/grade-toko/${row.storeId}/transaksi?from=${transactionDetailSource}`}
												className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
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
