"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import DataTable from "@/components/shared/DataTable";
import FormInput from "@/components/shared/FormInput";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	suppliersService,
	type SupplierListItem,
	type CreateSupplierPayload,
	type UpdateSupplierPayload,
} from "@/services/suppliers";

type FormState = {
	name: string;
	contactPerson: string;
	phone: string;
	email: string;
	address: string;
};

const emptyForm: FormState = {
	name: "",
	contactPerson: "",
	phone: "",
	email: "",
	address: "",
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function OwnerSuppliersMasterDataPage() {
	const [rows, setRows] = useState<SupplierListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [selected, setSelected] = useState<SupplierListItem | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const supplierResult = await suppliersService.listAll({});
			setRows(supplierResult);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat data supplier."));
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
		const contactPerson = sanitizeText(form.contactPerson);
		const phone = sanitizeText(form.phone);
		const email = sanitizeText(form.email);
		const address = sanitizeText(form.address);

		if (!name) {
			setError("Nama supplier wajib diisi.");
			return;
		}

		setSaving(true);
		try {
			if (selected) {
				const payload: UpdateSupplierPayload = {
					name,
					contactPerson: contactPerson || undefined,
					phone: phone || undefined,
					email: email || undefined,
					address: address || undefined,
				};
				await suppliersService.update(selected.id, payload);
			} else {
				const payload: CreateSupplierPayload = {
					name,
					contactPerson: contactPerson || undefined,
					phone: phone || undefined,
					email: email || undefined,
					address: address || undefined,
				};
				await suppliersService.create(payload);
			}

			resetForm();
			await load();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menyimpan supplier."));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (supplier: SupplierListItem) => {
		if (!confirm(`Hapus supplier "${supplier.name}"?`)) {
			return;
		}

		setSaving(true);
		setError("");
		try {
			await suppliersService.delete(supplier.id);
			setRows((current) => current.filter((row) => row.id !== supplier.id));
			if (selected?.id === supplier.id) resetForm();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menghapus supplier."));
		} finally {
			setSaving(false);
		}
	};

	const handleToggleStatus = async (supplier: SupplierListItem) => {
		const newStatus = supplier.status === "active" ? "inactive" : "active";
		const actionText = newStatus === "active" ? "aktifkan" : "nonaktifkan";

		if (!confirm(`${actionText.charAt(0).toUpperCase() + actionText.slice(1)} supplier "${supplier.name}"?`)) {
			return;
		}

		setSaving(true);
		setError("");
		try {
			await suppliersService.updateStatus(supplier.id, newStatus);
			setRows((current) =>
				current.map((row) =>
					row.id === supplier.id ? { ...row, status: newStatus } : row,
				),
			);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, `Gagal mengubah status supplier.`));
		} finally {
			setSaving(false);
		}
	};

	const handleEdit = (supplier: SupplierListItem) => {
		setSelected(supplier);
		setForm({
			name: supplier.name ?? "",
			contactPerson: supplier.contactPerson ?? "",
			phone: supplier.phone ?? "",
			email: supplier.email ?? "",
			address: supplier.address ?? "",
		});
	};

	return (
		<FeaturePage
			title="Master Supplier"
			description="Kelola data supplier untuk kebutuhan pengadaan barang."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Daftar Supplier</h2>
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
							{ key: "name", head: "Nama Supplier" },
							{ key: "contactPerson", head: "Contact Person" },
							{
								key: "contact",
								head: "Telepon/Email",
								render: (item) => (
									<div className="space-y-0.5">
										{item.phone ? (
											<div className="text-slate-700">{item.phone}</div>
										) : null}
										{item.email ? (
											<div className="text-slate-500">{item.email}</div>
										) : null}
										{!item.phone && !item.email ? "-" : null}
									</div>
								),
							},
							{
								key: "status",
								head: "Status",
								render: (item) => (
									<span
										className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
											item.status === "active"
												? "bg-emerald-100 text-emerald-700"
												: "bg-slate-100 text-slate-600"
										}`}
									>
										{item.status === "active" ? "Aktif" : "Nonaktif"}
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
											className={`rounded-full px-3 py-1 text-xs font-medium transition ${
												item.status === "active"
													? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
													: "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
											}`}
										>
											{item.status === "active" ? "Nonaktifkan" : "Aktifkan"}
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
						emptyText={loading ? "Memuat supplier..." : "Belum ada supplier"}
					/>
				</section>

				<aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">
						{selected ? "Edit Supplier" : "Tambah Supplier"}
					</h2>
					<FormInput
						label="Nama Supplier"
						value={form.name}
						onChange={(event) =>
							setForm((current) => ({ ...current, name: event.target.value }))
						}
						placeholder="Contoh: PT. Sumber Makmur"
						disabled={saving}
					/>
					<FormInput
						label="Contact Person"
						value={form.contactPerson}
						onChange={(event) =>
							setForm((current) => ({ ...current, contactPerson: event.target.value }))
						}
						placeholder="Nama kontak person"
						disabled={saving}
					/>
					<FormInput
						label="Telepon"
						value={form.phone}
						onChange={(event) =>
							setForm((current) => ({ ...current, phone: event.target.value }))
						}
						placeholder="Nomor telepon"
						disabled={saving}
					/>
					<FormInput
						label="Email"
						type="email"
						value={form.email}
						onChange={(event) =>
							setForm((current) => ({ ...current, email: event.target.value }))
						}
						placeholder="Alamat email"
						disabled={saving}
					/>
					<label className="space-y-2 text-sm text-slate-700">
						<span>Alamat</span>
						<textarea
							className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							value={form.address}
							onChange={(event) =>
								setForm((current) => ({ ...current, address: event.target.value }))
							}
							disabled={saving}
						/>
					</label>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
					>
						{saving
							? "Menyimpan..."
							: selected
								? "Perbarui Supplier"
								: "Simpan Supplier"}
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
