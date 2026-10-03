"use client";

import { useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import DataTable from "@/components/shared/DataTable";
import PaginationControls from "@/components/shared/PaginationControls";
import FormInput from "@/components/shared/FormInput";
import { usePagedList } from "@/hooks/usePagedList";
import SearchCombobox from "@/components/shared/SearchCombobox";
import { getApiErrorMessage } from "@/lib/api-errors";
import { citiesService } from "@/services/cities";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

type FormState = {
	name: string;
	address: string;
	cityId: string;
	cityName: string;
	province: string;
};

const emptyForm: FormState = {
	name: "",
	address: "",
	cityId: "",
	cityName: "",
	province: "",
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

const PAGE_SIZE = 20;

export default function OwnerWarehouseMasterDataPage() {
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [selected, setSelected] = useState<WarehouseListItem | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);

	const list = usePagedList(
		(page, limit) => warehousesService.list({ page, limit }),
		{ filterKey: "", errorMessage: "Gagal memuat master gudang.", pageSize: PAGE_SIZE },
	);
	const { reload } = list;

	const resetForm = () => {
		setSelected(null);
		setForm(emptyForm);
	};

	const handleSave = async () => {
		setError("");

		const name = sanitizeText(form.name);
		const address = sanitizeText(form.address);
		const cityName = sanitizeText(form.cityName);
		const province = sanitizeText(form.province);
		if (!name || !address) {
			setError("Nama gudang dan alamat wajib diisi.");
			return;
		}

		if (!form.cityId && (!cityName || !province)) {
			setError("Pilih kota, atau isi nama kota dan provinsi baru.");
			return;
		}

		setSaving(true);
		try {
			const resolvedCityId = form.cityId
				? form.cityId
				: (
						await citiesService.create({
							name: cityName,
							province,
						})
					).id;

			if (selected) {
				await warehousesService.update(selected.id, {
					name,
					address,
					cityId: resolvedCityId,
				});
			} else {
				await warehousesService.create({
					name,
					address,
					cityId: resolvedCityId,
				});
			}

			resetForm();
			reload();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menyimpan gudang."));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (warehouse: WarehouseListItem) => {
		if (!confirm(`Hapus gudang ${warehouse.name}?`)) {
			return;
		}

		setSaving(true);
		setError("");
		try {
			await warehousesService.delete(warehouse.id);
			reload();
			if (selected?.id === warehouse.id) resetForm();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menghapus gudang."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<FeaturePage title="Master Gudang" description="Kelola gudang untuk kebutuhan stok, transfer, dan pengiriman.">
			{error || list.error ? (
				<div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					<span>{error || list.error}</span>
					{!error ? (
						<button type="button" onClick={reload} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">
							Coba lagi
						</button>
					) : null}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Daftar Gudang</h2>
							<p className="mt-1 text-sm text-slate-600">Total: {list.totalItems}</p>
						</div>
						<div className="flex gap-2">
						</div>
					</div>

					<DataTable
						columns={[
							{ key: "name", head: "Nama" },
							{
								key: "city",
								head: "Kota",
								render: (item) => item.city?.name ?? "-",
							},
							{
								key: "actions",
								head: "Aksi",
								render: (item) => (
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => {
												setSelected(item);
												setForm({
													name: item.name ?? "",
													address: item.address ?? "",
													cityId: item.cityId ?? "",
													cityName: "",
													province: "",
												});
										}}
											className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
										>
											Edit
										</button>
										<button
											type="button"
											onClick={() => handleDelete(item)}
											className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
										>
											Hapus
										</button>
									</div>
								),
							},
						]}
						data={list.items}
						emptyText={list.loading ? "Memuat gudang..." : list.error ? "Data tidak dapat dimuat." : "Belum ada gudang"}
					/>
					<PaginationControls currentPage={list.page} totalPages={list.totalPages} totalItems={list.totalItems} pageSize={PAGE_SIZE} itemLabel="gudang" loading={list.loading} onPageChange={list.setPage} />
				</section>

				<aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit Gudang" : "Tambah Gudang"}</h2>
					<FormInput
						label="Nama Gudang"
						value={form.name}
						onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
						placeholder="Contoh: Gudang Utama"
					/>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Alamat</span>
						<textarea
							className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={form.address}
							onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
							disabled={saving}
						/>
					</label>
					<SearchCombobox
						label="Kota"
						value={form.cityId}
						selectedOption={selected?.city ? { value: selected.city.id, label: selected.city.name, description: selected.city.province } : null}
						loadOptions={async (query) => (await citiesService.search(query)).map((city) => ({ value: city.id, label: city.name, description: city.province }))}
						onChange={(cityId) => setForm((current) => ({ ...current, cityId, cityName: cityId ? "" : current.cityName, province: cityId ? "" : current.province }))}
						disabled={saving}
						placeholder="Cari kota atau provinsi"
					/>
					<p className="text-xs text-slate-500">
						Jika kota belum ada, kosongkan pilihan lalu isi nama kota dan provinsi di bawah.
					</p>
					<div className="grid gap-4 md:grid-cols-2">
						<FormInput
							label="Nama Kota Baru"
							value={form.cityName}
							onChange={(event) => setForm((current) => ({ ...current, cityName: event.target.value }))}
							disabled={saving || Boolean(form.cityId)}
							placeholder="Contoh: Medan"
						/>
						<FormInput
							label="Provinsi Baru"
							value={form.province}
							onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))}
							disabled={saving || Boolean(form.cityId)}
							placeholder="Contoh: Sumatera Utara"
						/>
					</div>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
					>
						{saving ? "Menyimpan..." : selected ? "Perbarui Gudang" : "Simpan Gudang"}
					</button>
					{selected ? (
						<button
							type="button"
							onClick={resetForm}
							className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
							disabled={saving}
						>
							Batal Edit
						</button>
					) : null}
				</aside>
			</div>
		</FeaturePage>
	);
}
