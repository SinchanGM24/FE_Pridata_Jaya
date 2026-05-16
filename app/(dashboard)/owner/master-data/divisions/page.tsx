"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import DataTable from "@/components/shared/DataTable";
import FormInput from "@/components/shared/FormInput";
import { divisionsService, type DivisionListItem } from "@/services/divisions";

const dateOnly = (value?: string) => (value ? String(value).slice(0, 10) : "-");
const getErrorMessage = (error: unknown, fallback: string) =>
	typeof error === "object" &&
	error !== null &&
	"response" in error &&
	typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
		? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
		: fallback;

export default function OwnerDivisionMasterDataPage() {
	const [rows, setRows] = useState<DivisionListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	const [selected, setSelected] = useState<DivisionListItem | null>(null);
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const result = await divisionsService.listAll({ sortBy: "name", sortOrder: "asc" });
			setRows(result);
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal memuat divisi."));
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

	const filteredRows = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((row) => row.name.toLowerCase().includes(q));
	}, [rows, search]);

	const resetForm = () => {
		setSelected(null);
		setName("");
	};

	const handleSave = async () => {
		if (!name.trim()) return;
		setSaving(true);
		setError("");
		try {
			if (selected) {
				await divisionsService.update(selected.id, { name: name.trim() });
			} else {
				await divisionsService.create({ name: name.trim() });
			}
			resetForm();
			await load();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal menyimpan divisi."));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus divisi ini?")) return;
		setError("");
		try {
			await divisionsService.delete(id);
			setRows((current) => current.filter((row) => row.id !== id));
			if (selected?.id === id) resetForm();
		} catch (error: unknown) {
			setError(getErrorMessage(error, "Gagal menghapus divisi."));
		}
	};

	return (
		<FeaturePage
			title="Master Divisi"
			description="Kelola divisi untuk mapping produk di katalog."
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
							<h2 className="text-lg font-semibold text-slate-900">Daftar Divisi</h2>
							<p className="mt-1 text-sm text-slate-600">Total: {rows.length}</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Cari divisi..."
								className="w-56 rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
												setName(item.name);
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
						emptyText={loading ? "Memuat divisi..." : "Belum ada divisi"}
					/>
				</section>

				<aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">
						{selected ? "Edit Divisi" : "Tambah Divisi"}
					</h2>
					<FormInput
						label="Nama Divisi"
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Contoh: Elektronik"
					/>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
					>
						{saving ? "Menyimpan..." : selected ? "Perbarui Divisi" : "Simpan Divisi"}
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
