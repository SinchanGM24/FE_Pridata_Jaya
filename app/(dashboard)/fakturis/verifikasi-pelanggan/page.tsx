"use client";

import { useEffect, useState } from "react";
import VerificationNotesModal from "@/components/fakturis/VerificationNotesModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	storesService,
	type Store,
	type VerificationStatus,
} from "@/services/stores";

export default function VerifikasiPelangganPage() {
	const [items, setItems] = useState<Store[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);
	const [verificationTarget, setVerificationTarget] = useState<{
		store: Store;
		status: VerificationStatus;
	} | null>(null);
	const [verificationNotes, setVerificationNotes] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await storesService.listByVerificationStatus("PENDING");
			setItems(res);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat store yang pending.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const openVerificationModal = (store: Store, status: VerificationStatus) => {
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
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal update verifikasi store.");
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
					<h2 className="font-semibold text-slate-900">Store Pending ({items.length})</h2>
					<button
						type="button"
						onClick={load}
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
							<th className="px-4 py-3">Alamat</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Memuat...</td></tr>
						) : items.length === 0 ? (
							<tr><td colSpan={5} className="px-4 py-4 text-slate-600">Tidak ada store pending.</td></tr>
						) : (
							items.map((s) => (
								<tr key={s.id}>
									<td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
									<td className="px-4 py-3 text-slate-700">{s.email}</td>
									<td className="px-4 py-3 text-slate-700">{s.phone}</td>
									<td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{s.address}</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => openVerificationModal(s, "VERIFIED")}
												disabled={actionId === s.id}
												className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
											>
												Verifikasi
											</button>
											<button
												type="button"
												onClick={() => openVerificationModal(s, "REJECTED")}
												disabled={actionId === s.id}
												className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
											>
												Tolak
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

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
