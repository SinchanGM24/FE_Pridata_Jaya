"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import SearchCombobox, { type SearchComboboxOption } from "@/components/shared/SearchCombobox";
import { getApiErrorMessage } from "@/lib/api-errors";
import { canManageWarehouseItems } from "@/lib/role-capabilities";
import { useAuth } from "@/hooks/useAuth";
import { brandService } from "@/services/brand";
import { categoryService } from "@/services/category";
import { divisionsService } from "@/services/divisions";
import { productsService, type CreateProductPayload, type Product } from "@/services/products";
import { subDivisionsService } from "@/services/subdivisions";
import { productImportsService, type ProductImportLog } from "@/services/product-imports";

type ProductFormState = {
	name: string;
	categoryId: string;
	brandId: string;
	divisionId: string;
	subDivisionId: string;
	description: string;
};

const emptyForm: ProductFormState = {
	name: "",
	categoryId: "",
	brandId: "",
	divisionId: "",
	subDivisionId: "",
	description: "",
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;

const buildPayload = (
	form: ProductFormState,
	current?: Product | null,
): CreateProductPayload => ({
	name: sanitizeText(form.name),
	categoryId: form.categoryId || null,
	brandId: form.brandId || null,
	divisionId: form.divisionId || null,
	subDivisionId: form.subDivisionId || null,
	productDetail: sanitizeText(form.description)
		? {
				description: sanitizeText(form.description),
				imageList: current?.productDetail?.imageList ?? undefined,
				spec: current?.productDetail?.spec ?? undefined,
			}
		: current?.productDetail
			? {
					description: undefined,
					imageList: current.productDetail.imageList ?? undefined,
					spec: current.productDetail.spec ?? undefined,
				}
			: undefined,
});

export default function KelolaItemGudangPage() {
	const { user } = useAuth();
	const canManageItems = canManageWarehouseItems(user);
	const [items, setItems] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [search, setSearch] = useState("");
	const [catalogFilter, setCatalogFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
	const [form, setForm] = useState<ProductFormState>(emptyForm);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<Product | null>(null);
	const [deletingItem, setDeletingItem] = useState<Product | null>(null);
	const [importOpen, setImportOpen] = useState(false);
	const [importFile, setImportFile] = useState<File | null>(null);
	const [importJob, setImportJob] = useState<ProductImportLog | null>(null);
	const [importLogs, setImportLogs] = useState<ProductImportLog[]>([]);

	const load = async () => {
		if (!canManageItems) return;
		setLoading(true);
		setError("");
		try {
			const productItems = await productsService.listAll({
				sortBy: "createdAt",
				sortOrder: "desc",
			});
			setItems(productItems);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat master item gudang."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [canManageItems]);

	const loadImportLogs = async () => {
		try { setImportLogs((await productImportsService.list({ limit: 10 })).items); } catch { /* history is supplementary */ }
	};

	useEffect(() => { if (!canManageItems) return; const timer = window.setTimeout(() => void loadImportLogs(), 0); return () => window.clearTimeout(timer); }, [canManageItems]);

	useEffect(() => {
		if (!canManageItems || !importJob || ["SUCCESS", "FAILED"].includes(importJob.status)) return;
		const timer = window.setInterval(async () => {
			try { const status = await productImportsService.getStatus(importJob.id); setImportJob(status); if (status.done) { await loadImportLogs(); if (status.status === "SUCCESS") await load(); } } catch { /* retain last known job state */ }
		}, 3000);
		return () => window.clearInterval(timer);
	}, [canManageItems, importJob, load]);

	const downloadImportTemplate = async (format: "xlsx" | "csv") => {
		try { const blob = await productImportsService.downloadTemplate(format); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `template-import-produk.${format}`; link.click(); URL.revokeObjectURL(url); } catch (cause) { setError(getApiErrorMessage(cause, "Gagal mengunduh template import.")); }
	};
	const uploadImport = async () => {
		if (!importFile) { setError("Pilih file CSV atau XLSX terlebih dahulu."); return; }
		if (!/\.(csv|xlsx)$/i.test(importFile.name) || importFile.size > MAX_IMPORT_FILE_SIZE) { setError("File harus CSV/XLSX dengan ukuran maksimal 20 MB."); return; }
		setSaving(true); try { const queued = await productImportsService.upload(importFile); const status = await productImportsService.getStatus(queued.importLogId); setImportJob(status); setSuccess("Import diproses di background. Status akan diperbarui otomatis."); } catch (cause) { setError(getApiErrorMessage(cause, "Gagal mengunggah file import.")); } finally { setSaving(false); }
	};
	const downloadImportErrors = () => {
		if (!importJob?.errors?.length) return;
		const rows = [["baris", "nama_produk", "pesan"], ...importJob.errors.map((entry) => [String(entry.row), entry.name, entry.message])];
		const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
		const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
		const link = document.createElement("a"); link.href = url; link.download = `error-import-${importJob.filename}.csv`; link.click(); URL.revokeObjectURL(url);
	};

	const filteredItems = useMemo(() => {
		const query = search.trim().toLowerCase();
		return items.filter((item) => {
			const matchSearch =
				!query ||
				item.name.toLowerCase().includes(query) ||
				(item.category?.name ?? "").toLowerCase().includes(query) ||
				(item.brand?.name ?? "").toLowerCase().includes(query) ||
				(item.division?.name ?? "").toLowerCase().includes(query) ||
				(item.subDivision?.name ?? "").toLowerCase().includes(query);
			const matchCatalog =
				catalogFilter === "ALL" ||
				(catalogFilter === "PUBLISHED"
					? Boolean(item.catalogProduct?.isPublished)
					: !item.catalogProduct?.isPublished);
			return matchSearch && matchCatalog;
		});
	}, [catalogFilter, items, search]);

	const summary = useMemo(
		() => ({
			total: items.length,
			published: items.filter((item) => item.catalogProduct?.isPublished).length,
			draft: items.filter((item) => !item.catalogProduct?.isPublished).length,
			withStock: items.filter((item) => (item.stockQuantity ?? 0) > 0).length,
		}),
		[items],
	);

	const resetForm = () => {
		setForm(emptyForm);
	};

	const openCreate = async () => {
		setEditingItem(null);
		resetForm();
		setModalOpen(true);
	};

	const openEdit = async (item: Product) => {
		setEditingItem(item);
		setForm({
			name: item.name,
			categoryId: item.categoryId ?? item.category?.id ?? "",
			brandId: item.brandId ?? item.brand?.id ?? "",
			divisionId: item.divisionId ?? item.division?.id ?? "",
			subDivisionId: item.subDivisionId ?? item.subDivision?.id ?? "",
			description: item.productDetail?.description ?? "",
		});
		setModalOpen(true);
	};

	const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalizedName = sanitizeText(form.name);
		const normalizedDescription = sanitizeText(form.description);
		if (!normalizedName) {
			setError("Nama item gudang wajib diisi.");
			return;
		}
		if (!form.categoryId) {
			setError("Kategori item gudang wajib dipilih.");
			return;
		}
		if (!form.brandId) {
			setError("Brand item gudang wajib dipilih.");
			return;
		}
		if (form.subDivisionId && !form.divisionId) {
			setError("Sub divisi hanya bisa dipilih jika divisi sudah diisi.");
			return;
		}

		setSaving(true);
		setError("");
		setSuccess("");
		try {
			const payload = buildPayload(
				{ ...form, name: normalizedName, description: normalizedDescription },
				editingItem,
			);
			if (editingItem) {
				await productsService.update(editingItem.id, payload);
				setSuccess("Item gudang berhasil diperbarui.");
			} else {
				await productsService.create(payload);
				setSuccess("Item gudang baru berhasil ditambahkan.");
			}
			setModalOpen(false);
			setEditingItem(null);
			resetForm();
			await load();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menyimpan item gudang."));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!deletingItem) return;

		if ((deletingItem.stockQuantity ?? 0) > 0) {
			setError("Item dengan stok aktif tidak bisa dihapus. Kosongkan stoknya lebih dulu.");
			setDeletingItem(null);
			return;
		}

		if (deletingItem.catalogProduct) {
			setError("Item yang masih publish di katalog tidak bisa dihapus. Nonaktifkan katalog lebih dulu.");
			setDeletingItem(null);
			return;
		}

		setSaving(true);
		setError("");
		setSuccess("");
		try {
			await productsService.delete(deletingItem.id);
			setDeletingItem(null);
			setSuccess("Item gudang berhasil dihapus.");
			await load();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menghapus item gudang."));
		} finally {
			setSaving(false);
		}
	};

	if (!canManageItems) {
		return <FeaturePage title="Kelola Item Gudang" description="Pengelolaan item dan import produk hanya tersedia untuk tim gudang." />;
	}

	return (
		<FeaturePage
			title="Kelola Item Gudang"
			description="Master item referensi gudang untuk penerimaan barang dan mapping katalog owner. Tambah item dilakukan di sini, bukan dari halaman input penerimaan."
		>
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>

			<section className="grid gap-4 md:grid-cols-4">
				{[
					{ label: "Total Item", value: summary.total },
					{ label: "Draft Katalog", value: summary.draft },
					{ label: "Publish Katalog", value: summary.published },
					{ label: "Punya Stok", value: summary.withStock },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-1 flex-col gap-3 md:flex-row">
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
							placeholder="Cari item, kategori, brand, divisi"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<select
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:w-52"
							value={catalogFilter}
							onChange={(event) =>
								setCatalogFilter(event.target.value as "ALL" | "PUBLISHED" | "DRAFT")
							}
						>
							<option value="ALL">Semua Status Katalog</option>
							<option value="PUBLISHED">Sudah Publish</option>
							<option value="DRAFT">Belum Publish</option>
						</select>
					</div>
					<div className="flex gap-2">
						<button type="button" onClick={() => { setImportOpen(true); void loadImportLogs(); }} className="rounded-xl border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Import Produk</button>
						<button
							type="button"
							onClick={() => {
								void openCreate();
							}}
							className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
						>
							Tambah Item
						</button>
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Item</th>
							<th className="px-4 py-3">Kategori / Brand</th>
							<th className="px-4 py-3">Divisi</th>
							<th className="px-4 py-3 text-right">Stok</th>
							<th className="px-4 py-3">Katalog</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Memuat item gudang...
								</td>
							</tr>
						) : filteredItems.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-4 text-slate-600">
									Belum ada item gudang.
								</td>
							</tr>
						) : (
							filteredItems.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{item.name}</div>
										<div className="text-xs text-slate-500">
											{item.productDetail?.description?.trim() || "Belum ada deskripsi"}
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{item.category?.name ?? "-"} / {item.brand?.name ?? "-"}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{item.division?.name ?? "-"}
										{item.subDivision?.name ? ` / ${item.subDivision.name}` : ""}
									</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">
										{item.stockQuantity ?? 0}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
												item.catalogProduct?.isPublished
													? "border border-emerald-200 bg-emerald-50 text-emerald-700"
													: "border border-slate-200 bg-slate-50 text-slate-600"
											}`}
										>
											{item.catalogProduct?.isPublished ? "Publish" : "Draft"}
										</span>
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => {
													void openEdit(item);
												}}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => setDeletingItem(item)}
												className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
											>
												Hapus
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<Modal
				isOpen={importOpen}
				onClose={() => setImportOpen(false)}
				title="Import Produk Massal"
			>
				<div className="space-y-4 text-sm">
					<p className="text-slate-600">Unduh template terlebih dahulu. Proses import berjalan di background dan dapat selesai dengan sebagian baris gagal.</p>
					<div className="flex gap-2"><button type="button" onClick={() => void downloadImportTemplate("xlsx")} className="rounded-lg border px-3 py-2">Template XLSX</button><button type="button" onClick={() => void downloadImportTemplate("csv")} className="rounded-lg border px-3 py-2">Template CSV</button></div>
					<input type="file" accept=".csv,.xlsx" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && (!/\.(csv|xlsx)$/i.test(file.name) || file.size > MAX_IMPORT_FILE_SIZE)) { setImportFile(null); setError("Pilih file CSV/XLSX dengan ukuran maksimal 20 MB."); return; } setImportFile(file); }} className="block w-full rounded-lg border p-2" />
					<p className="text-xs text-slate-500">CSV atau XLSX, maksimal 20 MB. Kategori, brand, dan divisi baru dari file dapat dibuat otomatis oleh sistem.</p>
					<button type="button" disabled={saving} onClick={() => void uploadImport()} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{saving ? "Mengunggah..." : "Upload & Import"}</button>
					{importJob ? <div className="rounded-xl bg-slate-50 p-3"><p className="font-semibold">{importJob.filename} — {importJob.status}</p><p>Diproses {importJob.processedRows}/{importJob.totalRows ?? "?"}; sukses {importJob.successRows}; gagal {importJob.failedRows}</p>{importJob.errorMessage ? <p className="mt-1 text-red-700">{importJob.errorMessage}</p> : null}{importJob.errors?.length ? <ul className="mt-2 max-h-32 overflow-auto text-xs text-red-700">{importJob.errors.map((row) => <li key={`${row.row}-${row.message}`}>Baris {row.row} ({row.name}): {row.message}</li>)}</ul> : null}{importJob.errorsTruncated ? <p className="text-xs text-amber-700">Daftar error dipotong oleh server.</p> : null}</div> : null}
					<div><p className="mb-2 font-semibold">Riwayat Import</p>{importLogs.length ? <ul className="space-y-1 text-xs">{importLogs.map((entry) => <li key={entry.id} className="flex justify-between rounded bg-slate-50 p-2"><span>{entry.filename}</span><span>{entry.status} · {entry.successRows}/{entry.totalRows ?? "?"}</span></li>)}</ul> : <p className="text-slate-500">Belum ada riwayat import.</p>}</div>
					{importJob ? <div className="rounded-xl border border-slate-200 p-3 text-xs"><p className="font-semibold text-slate-800">{importJob.status === "SUCCESS" && importJob.failedRows > 0 ? "Import selesai sebagian" : importJob.status === "SUCCESS" ? "Import berhasil" : importJob.status === "FAILED" ? "Import gagal" : "Progres import"}</p>{importJob.totalRows ? <><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.min(100, Math.round((importJob.processedRows / importJob.totalRows) * 100))}%` }} /></div><p className="mt-1 text-slate-600">{importJob.processedRows}/{importJob.totalRows} baris diproses.</p></> : <p className="mt-1 text-slate-600">Menunggu worker membaca dan menghitung baris file...</p>}{importJob.errors?.length ? <button type="button" onClick={downloadImportErrors} className="mt-2 font-semibold text-indigo-700 underline">Unduh daftar error CSV</button> : null}{importJob.errorsTruncated ? <p className="mt-1 text-amber-700">Daftar error dipotong oleh server.</p> : null}</div> : null}
				</div>
			</Modal>

			<Modal
				isOpen={modalOpen}
				onClose={() => {
					setModalOpen(false);
					setEditingItem(null);
				}}
				title={editingItem ? "Edit Item Gudang" : "Tambah Item Gudang"}
			>
				<form onSubmit={handleSave} className="space-y-4">
					<input
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Nama item gudang"
						value={form.name}
						onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
						disabled={saving}
						required
					/>
					<div className="grid gap-4 md:grid-cols-2">
						<SearchCombobox label="Kategori" required value={form.categoryId} disabled={saving} placeholder="Cari kategori" selectedOption={editingItem?.category ? { value: editingItem.category.id, label: editingItem.category.name } : null} loadOptions={async (query) => (await categoryService.search(query)).map((item): SearchComboboxOption => ({ value: item.id, label: item.name }))} onChange={(categoryId) => setForm((current) => ({ ...current, categoryId, subDivisionId: "" }))} />
						<SearchCombobox label="Brand" required value={form.brandId} disabled={saving} placeholder="Cari brand" selectedOption={editingItem?.brand ? { value: editingItem.brand.id, label: editingItem.brand.name } : null} loadOptions={async (query) => (await brandService.search(query)).map((item): SearchComboboxOption => ({ value: item.id, label: item.name }))} onChange={(brandId) => setForm((current) => ({ ...current, brandId }))} />
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<SearchCombobox label="Divisi" value={form.divisionId} disabled={saving} placeholder="Cari divisi (opsional)" selectedOption={editingItem?.division ? { value: editingItem.division.id, label: editingItem.division.name } : null} loadOptions={async (query) => (await divisionsService.list({ page: 1, limit: 10, search: query, sortBy: "name", sortOrder: "asc" })).items.map((item) => ({ value: item.id, label: item.name }))} onChange={(divisionId) => setForm((current) => ({ ...current, divisionId, subDivisionId: "" }))} />
						<SearchCombobox label="Subdivisi" value={form.subDivisionId} disabled={saving || !form.categoryId || !form.divisionId} dependencyKey={`${form.categoryId}:${form.divisionId}`} placeholder={form.categoryId && form.divisionId ? "Cari subdivisi (opsional)" : "Pilih kategori dan divisi dahulu"} selectedOption={editingItem?.subDivision ? { value: editingItem.subDivision.id, label: editingItem.subDivision.name } : null} loadOptions={async (query) => (await subDivisionsService.search({ search: query, categoryId: form.categoryId, divisionId: form.divisionId })).map((item) => ({ value: item.id, label: item.name }))} onChange={(subDivisionId) => setForm((current) => ({ ...current, subDivisionId }))} />
					</div>
					<p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
						Kategori, brand, divisi, dan subdivisi dapat dikelola oleh Owner maupun Gudang melalui{" "}
						<Link href="/gudang/master-data" className="font-semibold underline underline-offset-2">
							Master Data
						</Link>.
					</p>
					<textarea
						className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						placeholder="Deskripsi atau spesifikasi default item"
						value={form.description}
						onChange={(event) =>
							setForm((current) => ({ ...current, description: event.target.value }))
						}
						disabled={saving}
					/>
					<p className="text-xs text-slate-500">
						Item baru dibuat sebagai draft katalog. Publish ke customer tetap dikelola Owner dari halaman
						Kelola Katalog.
					</p>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setModalOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={saving}
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={saving}
							className="rounded-xl bg-indigo-600 px-5 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
						>
							{saving ? "Menyimpan..." : "Simpan"}
						</button>
					</div>
				</form>
			</Modal>

			<Modal
				isOpen={Boolean(deletingItem)}
				onClose={() => setDeletingItem(null)}
				title="Hapus Item Gudang"
			>
				<div className="space-y-4">
					<p className="text-sm text-slate-700">
						Hapus item <span className="font-semibold">{deletingItem?.name}</span> dari master gudang?
						Hanya item tanpa stok dan belum publish yang bisa dihapus.
					</p>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setDeletingItem(null)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={saving}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleDelete}
							disabled={saving}
							className="rounded-xl bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
						>
							{saving ? "Menghapus..." : "Hapus"}
						</button>
					</div>
				</div>
			</Modal>
		</FeaturePage>
	);
}
