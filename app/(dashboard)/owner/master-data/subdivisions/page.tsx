"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import DataTable from "@/components/shared/DataTable";
import FormInput from "@/components/shared/FormInput";
import SelectInput from "@/components/shared/SelectInput";
import { categoryService, type Category } from "@/services/category";
import { divisionsService, type DivisionListItem } from "@/services/divisions";
import { subDivisionsService, type SubDivisionListItem } from "@/services/subdivisions";

const dateOnly = (value?: string) => (value ? String(value).slice(0, 10) : "-");

type FormState = {
	name: string;
	categoryId: string;
	divisionId: string;
};

const emptyForm: FormState = {
	name: "",
	categoryId: "",
	divisionId: "",
};

export default function OwnerSubDivisionMasterDataPage() {
	const [rows, setRows] = useState<SubDivisionListItem[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [divisions, setDivisions] = useState<DivisionListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	const [selected, setSelected] = useState<SubDivisionListItem | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [subDivisionResult, categoryResult, divisionResult] = await Promise.all([
				subDivisionsService.list({
					page: 1,
					limit: 100,
					sortBy: "name",
					sortOrder: "asc",
				}),
				categoryService.getAll(1, 100),
				divisionsService.list({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
			]);

			setRows(subDivisionResult.items);
			setCategories(categoryResult.data ?? []);
			setDivisions(divisionResult.items);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat subdivisi.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const filteredRows = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((row) => {
			const categoryName = row.category?.name ?? categories.find((c) => c.id === row.categoryId)?.name ?? "";
			const divisionName = row.division?.name ?? divisions.find((d) => d.id === row.divisionId)?.name ?? "";
			return (
				row.name.toLowerCase().includes(q) ||
				categoryName.toLowerCase().includes(q) ||
				divisionName.toLowerCase().includes(q)
			);
		});
	}, [categories, divisions, rows, search]);

	const resetForm = () => {
		setSelected(null);
		setForm(emptyForm);
	};

	const handleSave = async () => {
		if (!form.name.trim() || !form.categoryId || !form.divisionId) return;
		setSaving(true);
		setError("");
		try {
			if (selected) {
				await subDivisionsService.update(selected.id, {
					name: form.name.trim(),
					categoryId: form.categoryId,
					divisionId: form.divisionId,
				});
			} else {
				await subDivisionsService.create({
					name: form.name.trim(),
					categoryId: form.categoryId,
					divisionId: form.divisionId,
				});
			}
			resetForm();
			await load();
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal menyimpan subdivisi.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus subdivisi ini?")) return;
		setError("");
		try {
			await subDivisionsService.delete(id);
			setRows((current) => current.filter((row) => row.id !== id));
			if (selected?.id === id) resetForm();
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal menghapus subdivisi.");
		}
	};

	const categoryNameById = useMemo(() => {
		return Object.fromEntries(categories.map((category) => [category.id, category.name]));
	}, [categories]);

	const divisionNameById = useMemo(() => {
		return Object.fromEntries(divisions.map((division) => [division.id, division.name]));
	}, [divisions]);

	return (
		<FeaturePage
			title="Master Subdivisi"
			description="Kelola subdivisi per kategori dan divisi untuk mapping produk."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Daftar Subdivisi</h2>
							<p className="mt-1 text-sm text-slate-600">Total: {rows.length}</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Cari subdivisi / kategori / divisi..."
								className="w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
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
								key: "category",
								head: "Kategori",
								render: (item) => item.category?.name ?? categoryNameById[item.categoryId] ?? "-",
							},
							{
								key: "division",
								head: "Divisi",
								render: (item) => item.division?.name ?? divisionNameById[item.divisionId] ?? "-",
							},
							{
								key: "createdAt",
								head: "Dibuat",
								render: (item) => dateOnly(item.createdAt),
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
													name: item.name,
													categoryId: item.categoryId,
													divisionId: item.divisionId,
												});
											}}
											className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
										>
											Edit
										</button>
										<button
											type="button"
											onClick={() => handleDelete(item.id)}
											className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
										>
											Hapus
										</button>
									</div>
								),
							},
						]}
						data={filteredRows}
						emptyText={loading ? "Memuat subdivisi..." : "Belum ada subdivisi"}
					/>
				</section>

				<aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">
						{selected ? "Edit Subdivisi" : "Tambah Subdivisi"}
					</h2>
					<FormInput
						label="Nama Subdivisi"
						value={form.name}
						onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
						placeholder="Contoh: Smartphone"
					/>
					<SelectInput
						label="Kategori"
						value={form.categoryId}
						onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
					>
						<option value="">Pilih kategori</option>
						{categories.map((category) => (
							<option key={category.id} value={category.id}>
								{category.name}
							</option>
						))}
					</SelectInput>
					<SelectInput
						label="Divisi"
						value={form.divisionId}
						onChange={(event) => setForm((current) => ({ ...current, divisionId: event.target.value }))}
					>
						<option value="">Pilih divisi</option>
						{divisions.map((division) => (
							<option key={division.id} value={division.id}>
								{division.name}
							</option>
						))}
					</SelectInput>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
					>
						{saving ? "Menyimpan..." : selected ? "Perbarui Subdivisi" : "Simpan Subdivisi"}
					</button>
					{selected ? (
						<button
							type="button"
							onClick={resetForm}
							className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
						>
							Batal Edit
						</button>
					) : null}
				</aside>
			</div>
		</FeaturePage>
	);
}
