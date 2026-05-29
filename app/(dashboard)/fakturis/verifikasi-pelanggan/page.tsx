"use client";

import { useEffect, useState } from "react";
import VerificationNotesModal from "@/components/fakturis/VerificationNotesModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	storesService,
	type StoreDocuments,
	type Store,
	type VerificationStatus,
} from "@/services/stores";

const formatRupiah = (value?: number | null) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value || 0);

export default function VerifikasiPelangganPage() {
	const [items, setItems] = useState<Store[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);
	const [detailStore, setDetailStore] = useState<Store | null>(null);
	const [verificationTarget, setVerificationTarget] = useState<{
		store: Store;
		status: VerificationStatus;
	} | null>(null);
	const [verificationNotes, setVerificationNotes] = useState("");

	const load = async (options?: { withLoader?: boolean }) => {
		if (options?.withLoader !== false) {
			setLoading(true);
			setError("");
		}
		try {
			const res = await storesService.listByVerificationStatus("PENDING");
			setItems(res);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat store yang pending."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load({ withLoader: false });
		}, 0);

		return () => window.clearTimeout(timer);
	}, []);

	const openVerificationModal = (store: Store, status: VerificationStatus) => {
		setDetailStore(null);
		setVerificationTarget({ store, status });
		setVerificationNotes("");
	};

	const updateStatus = async () => {
		if (!verificationTarget) return;

		setActionId(verificationTarget.store.id);
		setError("");
		setSuccess("");
		try {
			await storesService.updateVerificationStatus({
				id: verificationTarget.store.id,
				verificationStatus: verificationTarget.status,
				verificationNotes: verificationNotes.trim() || undefined,
			});
			setSuccess(
				verificationTarget.status === "VERIFIED"
					? `${verificationTarget.store.name} berhasil diverifikasi.`
					: `${verificationTarget.store.name} berhasil ditolak.`,
			);
			setVerificationTarget(null);
			setVerificationNotes("");
			await load();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal update verifikasi store."));
		} finally {
			setActionId(null);
		}
	};

	return (
		<FeaturePage
			title="Verifikasi Pelanggan"
			description="Daftar toko/pelanggan dengan status verifikasi PENDING. Verifikasi atau tolak pendaftaran toko sebelum mereka dapat melakukan transaksi."
		>
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}
			{success ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
			) : null}

			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
					<h2 className="font-semibold text-slate-900">Toko Menunggu Verifikasi ({items.length})</h2>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Refresh
					</button>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Nama</th>
							<th className="px-4 py-3">Email</th>
							<th className="px-4 py-3">Phone</th>
							<th className="px-4 py-3">Nama Pemilik</th>
							<th className="px-4 py-3">Sales</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
						) : items.length === 0 ? (
							<tr><td colSpan={6} className="px-4 py-4 text-slate-600">Tidak ada store pending.</td></tr>
						) : (
							items.map((s) => (
								(() => {
									const docs = (s.documents ?? {}) as StoreDocuments;
									return (
								<tr key={s.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
									<td className="px-4 py-3 text-slate-700">{s.email}</td>
									<td className="px-4 py-3 text-slate-700">{s.phone}</td>
									<td className="px-4 py-3 text-slate-700">{docs.ownerName || "-"}</td>
									<td className="px-4 py-3 text-slate-700">{s.assignedSalesUser?.name || "-"}</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setDetailStore(s)}
												disabled={actionId === s.id}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
											>
												Detail
											</button>
										</div>
									</td>
								</tr>
									);
								})()
							))
						)}
					</tbody>
				</table>
			</section>

			<Modal
				isOpen={Boolean(detailStore)}
				onClose={() => setDetailStore(null)}
				title="Detail Pelanggan"
				maxWidthClassName="max-w-3xl"
			>
				{detailStore ? (
					<div className="space-y-4 text-sm text-slate-700">
						{(() => {
							const docs = (detailStore.documents ?? {}) as StoreDocuments;
							const businessRows = [
								{ label: "Nama Pemilik", value: docs.ownerName || "-" },
								{ label: "NIK", value: docs.ownerNik || "-" },
								{ label: "NPWP", value: docs.ownerNpwp || "-" },
								{ label: "NIB", value: docs.ownerNib || "-" },
								{ label: "Izin Usaha", value: docs.businessLicense || "-" },
								{ label: "Lama Usaha", value: `${docs.yearsInBusiness ?? 0} tahun` },
								{ label: "Estimasi Omzet", value: formatRupiah(docs.estimatedMonthlyRevenue) },
								{ label: "Sales", value: detailStore.assignedSalesUser?.name || "-" },
							];

							return (
								<>
									<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
										<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
											<div>
												<p className="text-xs font-semibold uppercase text-slate-500">Nama Toko</p>
												<p className="mt-1 text-lg font-semibold text-slate-900">{detailStore.name}</p>
												<p className="mt-1 text-slate-600">{detailStore.address}</p>
											</div>
											<div className="text-left md:text-right">
												<p className="text-xs font-semibold uppercase text-slate-500">Kontak</p>
												<p className="mt-1 font-medium text-slate-900">{detailStore.email}</p>
												<p className="mt-1 text-slate-600">{detailStore.phone}</p>
											</div>
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-2">
										{businessRows.map((row) => (
											<div key={row.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
												<p className="text-xs font-semibold uppercase text-slate-500">{row.label}</p>
												<p className="mt-1 font-medium text-slate-900">{row.value}</p>
											</div>
										))}
									</div>

									<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
										<p className="text-xs font-semibold uppercase text-slate-500">Catatan Sales</p>
										<p className="mt-1 whitespace-pre-wrap text-slate-700">{docs.salesNotes || "-"}</p>
									</div>

									<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
										<button
											type="button"
											onClick={() => setDetailStore(null)}
											className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
										>
											Tutup
										</button>
										<button
											type="button"
											onClick={() => openVerificationModal(detailStore, "REJECTED")}
											disabled={actionId === detailStore.id}
											className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
										>
											Tolak
										</button>
										<button
											type="button"
											onClick={() => openVerificationModal(detailStore, "VERIFIED")}
											disabled={actionId === detailStore.id}
											className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
										>
											Verifikasi
										</button>
									</div>
								</>
							);
						})()}
					</div>
				) : null}
			</Modal>

			<VerificationNotesModal
				isOpen={Boolean(verificationTarget)}
				storeName={verificationTarget?.store.name ?? ""}
				status={verificationTarget?.status ?? "VERIFIED"}
				notes={verificationNotes}
				submitting={Boolean(actionId)}
				onNotesChange={setVerificationNotes}
				onClose={() => {
					setVerificationTarget(null);
					setVerificationNotes("");
				}}
				onConfirm={updateStatus}
			/>
		</FeaturePage>
	);
}
