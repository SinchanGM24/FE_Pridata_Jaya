"use client";

import Modal from "@/components/shared/Modal";
import { USER_MANAGEMENT_ROLE_OPTIONS } from "@/constants";
import type { UserRole } from "@/types";

type UserFormRole = UserRole;

export interface OwnerUserFormState {
	email: string;
	name: string;
	password: string;
	role: UserFormRole;
	identityNumber: string;
	birthDate: string;
	gender: "" | "Laki-laki" | "Perempuan";
	phoneNumber: string;
	address: string;
	city: string;
	province: string;
	postalCode: string;
	joinDate: string;
}

interface OwnerUserFormModalProps {
	open: boolean;
	form: OwnerUserFormState;
	saving: boolean;
	error: string;
	roleReadOnly?: boolean;
	roleHelpText?: string;
	onClose: () => void;
	onChange: (patch: Partial<OwnerUserFormState>) => void;
	onSubmit: () => void;
}

const roleOptions = USER_MANAGEMENT_ROLE_OPTIONS;

export default function OwnerUserFormModal({
	open,
	form,
	saving,
	error,
	roleReadOnly = false,
	roleHelpText,
	onClose,
	onChange,
	onSubmit,
}: OwnerUserFormModalProps) {
	const roleLabel = roleOptions.find((role) => role.value === form.role)?.label ?? form.role;

	return (
		<Modal isOpen={open} onClose={onClose} title="Form Pengguna">
			<div className="space-y-4">
				{error ? (
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				) : null}

				<div className="space-y-1">
					<h3 className="text-sm font-semibold text-slate-900">Akun Login</h3>
					<p className="text-xs text-slate-500">Atur data akses masuk. Role dikelola dari halaman Anggota Organisasi.</p>
				</div>

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
						{roleReadOnly ? (
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
								{roleLabel}
							</div>
						) : (
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
						)}
						{roleHelpText ? <p className="text-xs text-slate-500">{roleHelpText}</p> : null}
					</label>
				</div>

				<div className="space-y-1 border-t border-slate-200 pt-4">
					<h3 className="text-sm font-semibold text-slate-900">Data Diri</h3>
					<p className="text-xs text-slate-500">Data ini tersimpan per akun dan dapat diperbarui kapan saja.</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<label className="space-y-2 text-sm text-slate-700">
						<span>NIK</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.identityNumber}
							onChange={(e) => onChange({ identityNumber: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Nomor Telepon</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.phoneNumber}
							onChange={(e) => onChange({ phoneNumber: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Tanggal Lahir</span>
						<input
							type="date"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.birthDate}
							onChange={(e) => onChange({ birthDate: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Jenis Kelamin</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.gender}
							onChange={(e) => onChange({ gender: e.target.value as OwnerUserFormState["gender"] })}
							disabled={saving}
						>
							<option value="">Pilih Jenis Kelamin</option>
							<option value="Laki-laki">Laki-laki</option>
							<option value="Perempuan">Perempuan</option>
						</select>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Kota</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.city}
							onChange={(e) => onChange({ city: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Provinsi</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.province}
							onChange={(e) => onChange({ province: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Kode Pos</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.postalCode}
							onChange={(e) => onChange({ postalCode: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Tanggal Bergabung</span>
						<input
							type="date"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.joinDate}
							onChange={(e) => onChange({ joinDate: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700 md:col-span-2">
						<span>Alamat Lengkap</span>
						<textarea
							className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.address}
							onChange={(e) => onChange({ address: e.target.value })}
							disabled={saving}
						/>
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
						className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
						disabled={saving}
					>
						{saving ? "Menyimpan..." : "Simpan Pengguna"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
