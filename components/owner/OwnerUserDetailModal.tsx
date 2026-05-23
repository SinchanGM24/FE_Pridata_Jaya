"use client";

import Modal from "@/components/shared/Modal";
import { ROLE_LABELS } from "@/constants";
import type { User, UserRole } from "@/types";

interface OwnerUserDetailModalProps {
	open: boolean;
	user: User | null;
	onClose: () => void;
}

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

const resolveRole = (user: User) => ((user.organizationRole as UserRole | null) ?? user.role);

const detailRows = (user: User) => [
	{ label: "NIK", value: user.profile?.identityNumber || "-" },
	{ label: "Nama Lengkap", value: user.name || "-" },
	{ label: "Email", value: user.email || "-" },
	{ label: "Role", value: ROLE_LABELS[resolveRole(user)] ?? resolveRole(user) },
	{ label: "Status Akun", value: user.banned ? "Nonaktif" : "Aktif" },
	{ label: "Nomor Telepon", value: user.profile?.phoneNumber || "-" },
	{ label: "Jenis Kelamin", value: user.profile?.gender || "-" },
	{ label: "Tanggal Lahir", value: formatDate(user.profile?.birthDate) },
	{ label: "Kota", value: user.profile?.city || "-" },
	{ label: "Provinsi", value: user.profile?.province || "-" },
	{ label: "Kode Pos", value: user.profile?.postalCode || "-" },
	{ label: "Tanggal Bergabung", value: formatDate(user.profile?.joinDate) },
	{ label: "Nama Toko", value: user.storeName || "-" },
	{ label: "Alamat Lengkap", value: user.profile?.address || "-" },
];

export default function OwnerUserDetailModal({
	open,
	user,
	onClose,
}: OwnerUserDetailModalProps) {
	if (!user) {
		return null;
	}

	return (
		<Modal isOpen={open} onClose={onClose} title="Detail User">
			<div className="space-y-4">
				<div className="grid gap-3 md:grid-cols-2">
					{detailRows(user).map((row) => (
						<div
							key={row.label}
							className={row.label === "Alamat Lengkap" ? "rounded-xl border border-slate-200 p-3 md:col-span-2" : "rounded-xl border border-slate-200 p-3"}
						>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{row.label}</p>
							<p className="mt-1 text-sm text-slate-800">{row.value}</p>
						</div>
					))}
				</div>

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
