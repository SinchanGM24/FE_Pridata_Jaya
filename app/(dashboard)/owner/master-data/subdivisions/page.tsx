"use client";

import { useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import DataTable from "@/components/shared/DataTable";
import PaginationControls from "@/components/shared/PaginationControls";
import FormInput from "@/components/shared/FormInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import SearchCombobox from "@/components/shared/SearchCombobox";
import { categoryService } from "@/services/category";
import { divisionsService } from "@/services/divisions";
import { subDivisionsService, type SubDivisionListItem } from "@/services/subdivisions";

const dateOnly = (value?: string) => (value ? String(value).slice(0, 10) : "-");
const getErrorMessage = (error: unknown, fallback: string) =>
	typeof error === "object" &&
	error !== null &&
	"response" in error &&
	typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
		? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
		: fallback;

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

const PAGE_SIZE = 20;

export default function OwnerSubDivisionMasterDataPage() {
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	const [selected, setSelected] = useState<SubDivisionListItem | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);

	const debouncedSearch = useDebouncedValue(search.trim());
	const list = usePagedList(
		(page, limit) => subDivisionsService.list({ page, limit, search: debouncedSearch || undefined, sortBy: "name", sortOrder: "asc" }),
		{ filterKey: debouncedSearch, errorMessage: "Gagal memuat subdivisi.", pageSize: PAGE_SIZE },
	);
	const { reload } = list;

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
			reload();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal menyimpan subdivisi."));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus subdivisi ini?")) return;
		setError("");
		try {
			await subDivisionsService.delete(id);
			reload();
			if (selected?.id === id) resetForm();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal menghapus subdivisi."));
		}
	};

	return (
		<FeaturePage
			title="Master Subdivisi"
			description="Kelola subdivisi per kategori dan divisi untuk mapping produk."
		>
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
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Daftar Subdivisi</h2>
							<p className="mt-1 text-sm text-slate-600">Total: {list.totalItems}</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Cari subdivisi / kategori / divisi..."
								className="w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<DataTable
						columns={[
							{ key: "name", head: "Nama" },
							{
								key: "category",
								head: "Kategori",
								render: (item) => item.category?.name ?? "-",
							},
							{
								key: "division",
								head: "Divisi",
								render: (item) => item.division?.name ?? "-",
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
						data={list.items}
						emptyText={list.loading ? "Memuat subdivisi..." : list.error ? "Data tidak dapat dimuat." : "Belum ada subdivisi"}
					/>
					<PaginationControls currentPage={list.page} totalPages={list.totalPages} totalItems={list.totalItems} pageSize={PAGE_SIZE} itemLabel="subdivisi" loading={list.loading} onPageChange={list.setPage} />
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
					<SearchCombobox label="Kategori" required value={form.categoryId} selectedOption={selected?.category ? { value: selected.category.id, label: selected.category.name } : null} loadOptions={async (query) => (await categoryService.search(query)).map((item) => ({ value: item.id, label: item.name }))} onChange={(categoryId) => setForm((current) => ({ ...current, categoryId }))} placeholder="Cari kategori" />
					<SearchCombobox label="Divisi" required value={form.divisionId} selectedOption={selected?.division ? { value: selected.division.id, label: selected.division.name } : null} loadOptions={async (query) => (await divisionsService.list({ page: 1, limit: 10, search: query, sortBy: "name", sortOrder: "asc" })).items.map((item) => ({ value: item.id, label: item.name }))} onChange={(divisionId) => setForm((current) => ({ ...current, divisionId }))} placeholder="Cari divisi" />
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
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
