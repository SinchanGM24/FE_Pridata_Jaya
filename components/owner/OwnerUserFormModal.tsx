"use client";

import Modal from "@/components/shared/Modal";

type UserFormRole = "owner" | "invoicist" | "warehouse_staff" | "accountant" | "sales" | "store_customer";

export interface OwnerUserFormState {
	email: string;
	name: string;
	password: string;
	role: UserFormRole;
}

interface OwnerUserFormModalProps {
	open: boolean;
	form: OwnerUserFormState;
	saving: boolean;
	error: string;
	onClose: () => void;
	onChange: (patch: Partial<OwnerUserFormState>) => void;
	onSubmit: () => void;
}

const roleOptions: Array<{ value: UserFormRole; label: string }> = [
	{ value: "owner", label: "Owner" },
	{ value: "invoicist", label: "Fakturis" },
	{ value: "warehouse_staff", label: "Gudang" },
	{ value: "accountant", label: "Akuntan" },
	{ value: "sales", label: "Sales" },
	{ value: "store_customer", label: "Toko" },
];

export default function OwnerUserFormModal({
	open,
	form,
	saving,
	error,
	onClose,
	onChange,
	onSubmit,
}: OwnerUserFormModalProps) {
	return (
		<Modal isOpen={open} onClose={onClose} title="Tambah User">
			<div className="space-y-4">
				{error ? (
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				) : null}

				<div className="grid gap-4 md:grid-cols-2">
					<label className="space-y-2 text-sm text-slate-700">
						<span>Nama Lengkap</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.name}
							onChange={(e) => onChange({ name: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Email</span>
						<input
							type="email"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.email}
							onChange={(e) => onChange({ email: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Password Login</span>
						<input
							type="password"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.password}
							onChange={(e) => onChange({ password: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Role</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.role}
							onChange={(e) => onChange({ role: e.target.value as UserFormRole })}
							disabled={saving}
						>
							{roleOptions.map((role) => (
								<option key={role.value} value={role.value}>
									{role.label}
								</option>
							))}
						</select>
					</label>
				</div>

				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
						disabled={saving}
					>
						Batal
					</button>
					<button
						type="button"
						onClick={onSubmit}
						className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
						disabled={saving}
					>
						{saving ? "Menyimpan..." : "Simpan User"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
