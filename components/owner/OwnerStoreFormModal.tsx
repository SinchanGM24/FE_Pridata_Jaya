"use client";

import Modal from "@/components/shared/Modal";
import type { City } from "@/services/cities";
import type { OwnerSalesDirectoryItem } from "@/services/owner";

export interface OwnerStoreFormState {
	ownerName: string;
	ownerEmail: string;
	ownerPassword: string;
	storeName: string;
	phone: string;
	address: string;
	cityId: string;
	cityName: string;
	province: string;
	storeType: "RETAILER" | "WHOLESALER" | "DISTRIBUTOR";
	creditLimit: string;
	assignedSalesUserId: string;
}

interface OwnerStoreFormModalProps {
	open: boolean;
	form: OwnerStoreFormState;
	cities: City[];
	salesDirectory: OwnerSalesDirectoryItem[];
	saving: boolean;
	error: string;
	onClose: () => void;
	onChange: (patch: Partial<OwnerStoreFormState>) => void;
	onSubmit: () => void;
}

export default function OwnerStoreFormModal({
	open,
	form,
	cities,
	salesDirectory,
	saving,
	error,
	onClose,
	onChange,
	onSubmit,
}: OwnerStoreFormModalProps) {
	return (
		<Modal isOpen={open} onClose={onClose} title="Tambah Toko">
			<div className="space-y-4">
				{error ? (
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				) : null}

				<div className="grid gap-4 md:grid-cols-2">
					<label className="space-y-2 text-sm text-slate-700">
						<span>Nama Pemilik</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.ownerName}
							onChange={(e) => onChange({ ownerName: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Email Login Toko</span>
						<input
							type="email"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.ownerEmail}
							onChange={(e) => onChange({ ownerEmail: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Password Login</span>
						<input
							type="password"
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.ownerPassword}
							onChange={(e) => onChange({ ownerPassword: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Nama Toko</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.storeName}
							onChange={(e) => onChange({ storeName: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Nomor Telepon</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.phone}
							onChange={(e) => onChange({ phone: e.target.value })}
							disabled={saving}
							placeholder="081234567890"
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Kota</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.cityId}
							onChange={(e) => onChange({ cityId: e.target.value })}
							disabled={saving}
						>
							<option value="">Pilih kota</option>
							{cities.map((city) => (
								<option key={city.id} value={city.id}>
									{city.name}, {city.province}
								</option>
							))}
						</select>
						<p className="text-xs text-slate-500">
							Jika kota belum ada, kosongkan pilihan lalu isi nama kota dan provinsi di bawah.
						</p>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Tipe Toko</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.storeType}
							onChange={(e) =>
								onChange({
									storeType: e.target.value as OwnerStoreFormState["storeType"],
								})
							}
							disabled={saving}
						>
							<option value="RETAILER">Retailer</option>
							<option value="WHOLESALER">Wholesaler</option>
							<option value="DISTRIBUTOR">Distributor</option>
						</select>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Credit Limit</span>
						<input
							type="number"
							min={0}
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.creditLimit}
							onChange={(e) => onChange({ creditLimit: e.target.value })}
							disabled={saving}
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Nama Kota Baru</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.cityName}
							onChange={(e) => onChange({ cityName: e.target.value })}
							disabled={saving || Boolean(form.cityId)}
							placeholder="Contoh: Medan"
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Provinsi Baru</span>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.province}
							onChange={(e) => onChange({ province: e.target.value })}
							disabled={saving || Boolean(form.cityId)}
							placeholder="Contoh: Sumatera Utara"
						/>
					</label>
					<label className="space-y-2 text-sm text-slate-700 md:col-span-2">
						<span>Sales Penanggung Jawab</span>
						<select
							className="w-full rounded-xl border border-slate-300 px-3 py-2"
							value={form.assignedSalesUserId}
							onChange={(e) => onChange({ assignedSalesUserId: e.target.value })}
							disabled={saving}
						>
							<option value="">Belum ditugaskan</option>
							{salesDirectory.map((sales) => (
								<option key={sales.userId} value={sales.userId}>
									{sales.name} ({sales.managedStoreCount} toko)
								</option>
							))}
						</select>
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
						className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
						disabled={saving}
					>
						{saving ? "Menyimpan..." : "Simpan Toko"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
