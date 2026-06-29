"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/shared/DataTable";
import { FeaturePage } from "@/components/shared/FeaturePage";
import FormInput from "@/components/shared/FormInput";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	driversService,
	type CreateDriverPayload,
	type DriverListItem,
	type UpdateDriverPayload,
} from "@/services/drivers";

type FormState = {
	name: string;
	phone: string;
	isActive: boolean;
};

const emptyForm: FormState = {
	name: "",
	phone: "",
	isActive: true,
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function OwnerDriverMasterDataPage() {
	const [rows, setRows] = useState<DriverListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [selected, setSelected] = useState<DriverListItem | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const drivers = await driversService.listAll({ sortBy: "name", sortOrder: "asc" });
			setRows(drivers);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat data driver."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);

		return () => window.clearTimeout(timer);
	}, []);

	const resetForm = () => {
		setSelected(null);
		setForm(emptyForm);
	};

	const handleSave = async () => {
		setError("");

		const name = sanitizeText(form.name);
		const phone = sanitizeText(form.phone);

		if (!name) {
			setError("Nama driver wajib diisi.");
			return;
		}

		setSaving(true);
		try {
			if (selected) {
				const payload: UpdateDriverPayload = {
					name,
					phone: phone || undefined,
					isActive: form.isActive,
				};
				await driversService.update(selected.id, payload);
			} else {
				const payload: CreateDriverPayload = {
					name,
					phone: phone || undefined,
					isActive: form.isActive,
				};
				await driversService.create(payload);
			}

			resetForm();
			await load();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menyimpan driver."));
		} finally {
			setSaving(false);
		}
	};

	const handleEdit = (driver: DriverListItem) => {
		setSelected(driver);
		setForm({
			name: driver.name,
			phone: driver.phone ?? "",
			isActive: driver.isActive,
		});
	};

	const handleToggleStatus = async (driver: DriverListItem) => {
		const nextStatus = !driver.isActive;
		const actionText = nextStatus ? "aktifkan" : "nonaktifkan";

		if (!confirm(`${actionText.charAt(0).toUpperCase() + actionText.slice(1)} driver "${driver.name}"?`)) {
			return;
		}

		setSaving(true);
		setError("");
		try {
			const updated = await driversService.updateStatus(driver.id, nextStatus);
			setRows((current) => current.map((row) => (row.id === driver.id ? updated : row)));
			if (selected?.id === driver.id) {
				setSelected(updated);
				setForm({
					name: updated.name,
					phone: updated.phone ?? "",
					isActive: updated.isActive,
				});
			}
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal mengubah status driver."));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (driver: DriverListItem) => {
		if (!confirm(`Nonaktifkan akses driver "${driver.name}"?`)) return;

		setSaving(true);
		setError("");
		try {
			await driversService.delete(driver.id);
			setRows((current) =>
				current.map((row) => (row.id === driver.id ? { ...row, isActive: false } : row)),
			);
			if (selected?.id === driver.id) {
				setForm((current) => ({ ...current, isActive: false }));
			}
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menonaktifkan driver."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<FeaturePage
			title="Master Driver"
			description="Kelola driver/kurir yang boleh dipilih gudang saat memproses pengiriman."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Daftar Driver</h2>
						<p className="mt-1 text-sm text-slate-600">Total: {rows.length}</p>
					</div>

					<DataTable
						columns={[
							{ key: "name", head: "Nama Driver" },
							{ key: "phone", head: "Nomor HP", render: (item) => item.phone || "-" },
							{
								key: "status",
								head: "Status",
								render: (item) => (
									<span
										className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
											item.isActive
												? "border border-emerald-200 bg-emerald-50 text-emerald-700"
												: "border border-slate-200 bg-slate-50 text-slate-600"
										}`}
									>
										{item.isActive ? "Aktif" : "Nonaktif"}
									</span>
								),
							},
							{
								key: "actions",
								head: "Aksi",
								render: (item) => (
									<div className="flex flex-wrap items-center gap-2">
										<button
											type="button"
											onClick={() => handleEdit(item)}
											className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
										>
											Edit
										</button>
										<button
											type="button"
											onClick={() => handleToggleStatus(item)}
											className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold transition ${
												item.isActive
													? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
													: "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
											}`}
										>
											{item.isActive ? "Nonaktifkan" : "Aktifkan"}
										</button>
										<button
											type="button"
											onClick={() => handleDelete(item)}
											className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
										>
											Hapus Akses
										</button>
									</div>
								),
							},
						]}
						data={rows}
						emptyText={loading ? "Memuat driver..." : "Belum ada driver"}
					/>
				</section>

				<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">
							{selected ? "Edit Driver" : "Tambah Driver"}
						</h2>
						<p className="mt-1 text-sm text-slate-600">
							Driver aktif akan muncul sebagai pilihan di halaman pengiriman gudang.
						</p>
					</div>

					<FormInput
						label="Nama Driver"
						value={form.name}
						onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
						placeholder="Contoh: Budi Santoso"
					/>
					<FormInput
						label="Nomor HP"
						value={form.phone}
						onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
						placeholder="Contoh: 081234567890"
					/>
					<label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
						<input
							type="checkbox"
							checked={form.isActive}
							onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
						/>
						Aktif dan bisa dipilih oleh gudang
					</label>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => void handleSave()}
							disabled={saving}
							className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
						>
							{saving ? "Menyimpan..." : selected ? "Perbarui Driver" : "Simpan Driver"}
						</button>
						{selected ? (
							<button
								type="button"
								onClick={resetForm}
								disabled={saving}
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
							>
								Batal
							</button>
						) : null}
					</div>
				</section>
			</div>
		</FeaturePage>
	);
}
