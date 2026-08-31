"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import SearchCombobox, { type SearchComboboxOption } from "@/components/shared/SearchCombobox";
import { getApiErrorMessage } from "@/lib/api-errors";
import { brandService } from "@/services/brand";
import { categoryService } from "@/services/category";
import { divisionsService } from "@/services/divisions";
import { productsService, type CreateProductPayload, type Product } from "@/services/products";
import { subDivisionsService } from "@/services/subdivisions";

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

	const load = async () => {
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
	}, []);

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
