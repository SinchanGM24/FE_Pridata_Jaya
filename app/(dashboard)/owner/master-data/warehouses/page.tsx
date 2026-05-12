"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import DataTable from "@/components/shared/DataTable";
import FormInput from "@/components/shared/FormInput";
import SelectInput from "@/components/shared/SelectInput";
import { getApiErrorMessage } from "@/lib/api-errors";
import { citiesService, type City } from "@/services/cities";
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

const MASTER_DATA_LIMIT = 100;
const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function OwnerWarehouseMasterDataPage() {
	const [rows, setRows] = useState<WarehouseListItem[]>([]);
	const [cities, setCities] = useState<City[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [selected, setSelected] = useState<WarehouseListItem | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [warehouseResult, cityRows] = await Promise.all([
				warehousesService.list({ page: 1, limit: MASTER_DATA_LIMIT, search: "" }),
				citiesService.list({ page: 1, limit: MASTER_DATA_LIMIT, sortBy: "name", sortOrder: "asc" }),
			]);
			setRows(warehouseResult.items);
			setCities(cityRows);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat master gudang."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const cityNameById = useMemo(() => {
		return Object.fromEntries(cities.map((city) => [city.id, `${city.name}, ${city.province}`]));
	}, [cities]);

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
			await load();
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
			setRows((current) => current.filter((row) => row.id !== warehouse.id));
			if (selected?.id === warehouse.id) resetForm();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menghapus gudang."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<FeaturePage title="Master Gudang" description="Kelola gudang untuk kebutuhan stok, transfer, dan pengiriman.">
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Daftar Gudang</h2>
							<p className="mt-1 text-sm text-slate-600">Total: {rows.length}</p>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={load}
								disabled={loading}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
							>
								Refresh
							</button>
						</div>
					</div>

					<DataTable
						columns={[
							{ key: "name", head: "Nama" },
							{
								key: "city",
								head: "Kota",
								render: (item) => item.city?.name ?? cityNameById[item.cityId ?? ""] ?? "-",
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
						data={rows}
						emptyText={loading ? "Memuat gudang..." : "Belum ada gudang"}
					/>
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
					<SelectInput
						label="Kota"
						value={form.cityId}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								cityId: event.target.value,
							}))
						}
						disabled={saving}
					>
						<option value="">Pilih kota</option>
						{cities.map((city) => (
							<option key={city.id} value={city.id}>
								{city.name}, {city.province}
							</option>
						))}
					</SelectInput>
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
						className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
