"use client";

import Modal from "@/components/shared/Modal";
import type { Store } from "@/services/stores";

interface OwnerStoreDetailModalProps {
	open: boolean;
	store: Store | null;
	onClose: () => void;
}

const formatCurrency = (value?: number | null) =>
	new Intl.NumberFormat("id-ID").format(value ?? 0);

const formatDate = (value?: string | null) => {
	if (!value) {
		return "-";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("id-ID", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	}).format(date);
};

export default function OwnerStoreDetailModal({
	open,
	store,
	onClose,
}: OwnerStoreDetailModalProps) {
	if (!store) {
		return null;
	}

	const rows = [
		{ label: "Nama Toko", value: store.name || "-" },
		{ label: "Status Toko", value: store.isActive === false ? "Nonaktif" : "Aktif" },
		{ label: "Status Verifikasi", value: store.verificationStatus || "-" },
		{ label: "Nama Owner", value: store.user?.name || "-" },
		{ label: "Email Login", value: store.user?.email || store.email || "-" },
		{ label: "Nomor Telepon", value: store.phone || "-" },
		{ label: "Tipe Toko", value: store.storeType || "-" },
		{ label: "Kota", value: store.city?.name || "-" },
		{ label: "Provinsi", value: store.city?.province || "-" },
		{ label: "Sales Penanggung Jawab", value: store.assignedSalesUser?.name || "Belum ditugaskan" },
		{ label: "Email Sales", value: store.assignedSalesUser?.email || "-" },
		{ label: "Limit Kredit", value: `Rp ${formatCurrency(store.creditLimit)}` },
		{ label: "Tanggal Verifikasi", value: formatDate(store.verificationDate) },
		{ label: "Catatan Verifikasi", value: store.verificationNotes || "-" },
		{ label: "Dibuat", value: formatDate(store.createdAt) },
		{ label: "Diperbarui", value: formatDate(store.updatedAt) },
		{ label: "Alamat Lengkap", value: store.address || "-" },
	];

	return (
		<Modal isOpen={open} onClose={onClose} title="Detail Toko">
			<div className="space-y-4">
				<div className="grid gap-3 md:grid-cols-2">
					{rows.map((row) => (
						<div
							key={row.label}
							className={
								row.label === "Alamat Lengkap"
									? "rounded-xl border border-slate-200 p-3 md:col-span-2"
									: "rounded-xl border border-slate-200 p-3"
							}
						>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
								{row.label}
							</p>
							<p className="mt-1 text-sm text-slate-800">{row.value}</p>
						</div>
					))}
				</div>

				{store.documents ? (
					<div className="rounded-xl border border-slate-200 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
							Dokumen / Metadata
						</p>
						<pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
							{JSON.stringify(store.documents, null, 2)}
						</pre>
					</div>
				) : null}

				<div className="flex justify-end">
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
					>
						Tutup
					</button>
				</div>
			</div>
		</Modal>
	);
}
