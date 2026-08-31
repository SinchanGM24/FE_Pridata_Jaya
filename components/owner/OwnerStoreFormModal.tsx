"use client";

import Modal from "@/components/shared/Modal";
import SearchCombobox from "@/components/shared/SearchCombobox";
import { citiesService, type City } from "@/services/cities";
import { ownerService, type OwnerSalesDirectoryItem } from "@/services/owner";

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
	mode?: "create" | "edit";
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
	mode = "create",
	onClose,
	onChange,
	onSubmit,
}: OwnerStoreFormModalProps) {
	const isEditMode = mode === "edit";

	return (
		<Modal isOpen={open} onClose={onClose} title={isEditMode ? "Edit Toko" : "Tambah Toko"}>
			<div className="space-y-4">
				{error ? (
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				) : null}

				<div className="grid gap-4 md:grid-cols-2">
					{isEditMode ? null : (
						<>
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
						</>
					)}
					{isEditMode ? (
						<label className="space-y-2 text-sm text-slate-700 md:col-span-2">
							<span>Password Baru Login Toko</span>
							<input
								type="password"
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={form.ownerPassword}
								onChange={(e) => onChange({ ownerPassword: e.target.value })}
								disabled={saving}
								placeholder="Kosongkan jika tidak ingin mengganti password"
							/>
							<p className="text-xs text-slate-500">
								Gunakan ini untuk membantu pemulihan akun toko jika pemilik lupa password.
							</p>
						</label>
					) : null}
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
					<div className="space-y-2 text-sm text-slate-700">
						<SearchCombobox label="Kota" value={form.cityId} selectedOption={cities.find((city) => city.id === form.cityId) ? { value: form.cityId, label: cities.find((city) => city.id === form.cityId)?.name ?? "Kota", description: cities.find((city) => city.id === form.cityId)?.province } : null} loadOptions={async (query) => (await citiesService.search(query)).map((city) => ({ value: city.id, label: city.name, description: city.province }))} onChange={(cityId) => onChange({ cityId, ...(cityId ? { cityName: "", province: "" } : {}) })} disabled={saving} placeholder="Cari kota atau provinsi" />
						<p className="text-xs text-slate-500">
							Jika kota belum ada, kosongkan pilihan lalu isi nama kota dan provinsi di bawah.
						</p>
					</div>
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
						<span>Limit Kredit</span>
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
					<SearchCombobox className="md:col-span-2" label="Sales Penanggung Jawab" value={form.assignedSalesUserId} selectedOption={salesDirectory.find((sales) => sales.userId === form.assignedSalesUserId) ? { value: form.assignedSalesUserId, label: salesDirectory.find((sales) => sales.userId === form.assignedSalesUserId)?.name ?? "Sales", description: salesDirectory.find((sales) => sales.userId === form.assignedSalesUserId)?.email } : null} loadOptions={async (query) => (await ownerService.getSalesDirectory({ search: query, page: 1, limit: 10, sortBy: "name", sortOrder: "asc" })).map((sales) => ({ value: sales.userId, label: sales.name, description: `${sales.email} · ${sales.managedStoreCount} toko` }))} onChange={(assignedSalesUserId) => onChange({ assignedSalesUserId })} disabled={saving} placeholder="Cari sales; kosongkan jika belum ditugaskan" />
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
						{saving ? "Menyimpan..." : isEditMode ? "Simpan Perubahan" : "Simpan Toko"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
