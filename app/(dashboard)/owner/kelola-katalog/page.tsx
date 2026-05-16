"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import { getApiErrorMessage } from "@/lib/api-errors";
import { productsService, type Product } from "@/services/products";
import {
	catalogProductsService,
	type CatalogProductPayload,
} from "@/services/catalog-products";
import { divisionsService, type DivisionListItem } from "@/services/divisions";
import { subDivisionsService, type SubDivisionListItem } from "@/services/subdivisions";
import { filesService } from "@/services/files";
import {
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";

type CatalogFormState = {
	productId: string;
	marketingName: string;
	sellingPrice: string;
	description: string;
	isPublished: boolean;
	divisionId: string;
	subDivisionId: string;
	imageList: string[];
	imageUrl: string;
};

const emptyForm: CatalogFormState = {
	productId: "",
	marketingName: "",
	sellingPrice: "",
	description: "",
	isPublished: false,
	divisionId: "",
	subDivisionId: "",
	imageList: [],
	imageUrl: "",
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function KelolaKatalogPage() {
	const [items, setItems] = useState<Product[]>([]);
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [divisions, setDivisions] = useState<DivisionListItem[]>([]);
	const [subDivisions, setSubDivisions] = useState<SubDivisionListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [referencesLoading, setReferencesLoading] = useState(false);
	const [error, setError] = useState("");
	const [modalError, setModalError] = useState("");
	const [form, setForm] = useState<CatalogFormState>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [productItems, inventoryItems] = await Promise.all([
				productsService.listAll({ sortBy: "createdAt", sortOrder: "desc" }),
				warehouseInventoryService.listAll({ sortBy: "updatedAt", sortOrder: "desc" }),
			]);
			setItems(productItems);
			setInventory(inventoryItems);
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat katalog."));
		} finally {
			setLoading(false);
		}
	};

	const ensureCatalogReferences = async () => {
		if (divisions.length > 0 || subDivisions.length > 0) {
			return;
		}

		setReferencesLoading(true);
		try {
			const [divisionItems, subDivisionItems] = await Promise.all([
				divisionsService.listAll({ sortBy: "name", sortOrder: "asc" }),
				subDivisionsService.listAll({ sortBy: "name", sortOrder: "asc" }),
			]);
			setDivisions(divisionItems);
			setSubDivisions(subDivisionItems);
		} catch (error: unknown) {
			throw new Error(getApiErrorMessage(error, "Gagal memuat referensi divisi katalog."));
		} finally {
			setReferencesLoading(false);
		}
	};

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, []);

	const productById = useMemo(() => {
		const map = new Map<string, Product>();
		for (const product of items) {
			map.set(product.id, product);
		}
		for (const row of inventory) {
			if (!row.product || map.has(row.productId)) continue;
			map.set(row.productId, {
				id: row.product.id,
				name: row.product.name,
				stockQuantity: row.product.stockQuantity,
				category: row.product.category ?? null,
				brand: row.product.brand ?? null,
				division: row.product.division ?? null,
				subDivision: row.product.subDivision ?? null,
				categoryId: row.product.category?.id ?? null,
				brandId: row.product.brand?.id ?? null,
				divisionId: row.product.division?.id ?? null,
				subDivisionId: row.product.subDivision?.id ?? null,
			});
		}
		return map;
	}, [items, inventory]);

	const inventorySummaryByProductId = useMemo(() => {
		const map = new Map<string, { quantity: number; warehouses: Set<string>; conditions: Set<string> }>();
		for (const row of inventory) {
			const current = map.get(row.productId) ?? {
				quantity: 0,
				warehouses: new Set<string>(),
				conditions: new Set<string>(),
			};
			current.quantity += row.quantity;
			if (row.warehouse?.name) current.warehouses.add(row.warehouse.name);
			current.conditions.add(row.condition);
			map.set(row.productId, current);
		}
		return map;
	}, [inventory]);

	const inventoryProducts = useMemo(() => {
		return Array.from(inventorySummaryByProductId.entries())
			.filter(([, summary]) => summary.quantity > 0)
			.map(([productId, summary]) => {
				const product = productById.get(productId);
				return product ? { product, summary } : null;
			})
			.filter(
				(item): item is { product: Product; summary: { quantity: number; warehouses: Set<string>; conditions: Set<string> } } =>
					Boolean(item),
			)
			.sort((a, b) => a.product.name.localeCompare(b.product.name));
	}, [inventorySummaryByProductId, productById]);

	const selectedProduct = form.productId ? productById.get(form.productId) : null;
	const selectedSummary = form.productId ? inventorySummaryByProductId.get(form.productId) : null;
	const selectedWarehouses = selectedSummary ? Array.from(selectedSummary.warehouses).join(", ") : "-";
	const selectedConditions = selectedSummary ? Array.from(selectedSummary.conditions).join(", ") : "-";

	const availableSubDivisions = useMemo(() => {
		const divisionId = form.divisionId || selectedProduct?.divisionId || "";
		const categoryId = selectedProduct?.categoryId || "";
		return subDivisions
			.filter((subDivision) => (divisionId ? subDivision.divisionId === divisionId : true))
			.filter((subDivision) => (categoryId ? subDivision.categoryId === categoryId : true));
	}, [form.divisionId, selectedProduct?.divisionId, selectedProduct?.categoryId, subDivisions]);

	const setFormFromProduct = (product: Product) => {
		const catalog = product.catalogProduct;
		setForm({
			productId: product.id,
			marketingName: catalog?.marketingName ?? product.name,
			sellingPrice: typeof catalog?.sellingPrice === "number" ? String(catalog.sellingPrice) : "",
			description: catalog?.description ?? "",
			isPublished: catalog?.isPublished ?? false,
			divisionId: catalog?.divisionId ?? product.divisionId ?? product.division?.id ?? "",
			subDivisionId: catalog?.subDivisionId ?? product.subDivisionId ?? product.subDivision?.id ?? "",
			imageList: catalog?.imageList ?? [],
			imageUrl: "",
		});
	};

	const openCreate = async () => {
		const firstDraftProduct = inventoryProducts.find(({ product }) => !product.catalogProduct)?.product;
		const firstProduct = firstDraftProduct ?? inventoryProducts[0]?.product;
		if (!firstProduct) {
			setError("Belum ada item gudang dengan stok aktif.");
			return;
		}
		try {
			await ensureCatalogReferences();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat referensi katalog."));
			return;
		}
		setFormFromProduct(firstProduct);
		setEditingProduct(null);
		setModalError("");
		setCreateModalOpen(true);
	};

	const openEdit = async (product: Product) => {
		try {
			await ensureCatalogReferences();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal memuat referensi katalog."));
			return;
		}
		setFormFromProduct(product);
		setEditingProduct(product);
		setModalError("");
		setCreateModalOpen(true);
	};

	const handleAddImageUrl = () => {
		const url = sanitizeText(form.imageUrl);
		if (!url) return;
		setForm((current) => ({
			...current,
			imageList: current.imageList.includes(url) ? current.imageList : [...current.imageList, url],
			imageUrl: "",
		}));
	};

	const handleSelectImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			setModalError("Ukuran gambar maksimal 2MB.");
			return;
		}
		setUploadingImage(true);
		setModalError("");
		try {
			const result = await filesService.uploadProductImage(file);
			setForm((current) => ({
				...current,
				imageList: current.imageList.includes(result.url)
					? current.imageList
					: [...current.imageList, result.url],
			}));
		} catch (error: unknown) {
			const errorMessage = getApiErrorMessage(error, "Gagal upload gambar.");
			if (errorMessage.includes("SeaweedFS") || errorMessage.includes("STORAGE_NOT_CONFIGURED")) {
				setModalError("SeaweedFS storage belum dikonfigurasi. Untuk saat ini, silakan gunakan fitur 'Tambah URL gambar' dengan paste URL dari sumber eksternal.");
			} else {
				setModalError(errorMessage);
			}
		} finally {
			setUploadingImage(false);
		}
	};

	const removeImageAt = (index: number) => {
		setForm((current) => ({
			...current,
			imageList: current.imageList.filter((_, idx) => idx !== index),
		}));
	};

	const handleSave = async (event: React.FormEvent) => {
		event.preventDefault();
		setSaving(true);
		setModalError("");
		try {
			const productForSave = productById.get(form.productId);
			if (!productForSave) {
				throw new Error("Pilih item gudang yang valid.");
			}
			const stock = inventorySummaryByProductId.get(productForSave.id)?.quantity ?? 0;
			if (stock <= 0) {
				throw new Error("Item gudang harus sudah punya stok aktif sebelum bisa masuk katalog.");
			}
			const marketingName = sanitizeText(form.marketingName);
			const description = sanitizeText(form.description);
			if (!marketingName) {
				throw new Error("Nama produk marketing wajib diisi.");
			}
			const sellingPrice = Number(form.sellingPrice || 0);
			if (!Number.isInteger(sellingPrice) || sellingPrice < 0) {
				throw new Error("Harga jual harus berupa angka bulat 0 atau lebih.");
			}
			const selectedSubDivision = form.subDivisionId
				? subDivisions.find((item) => item.id === form.subDivisionId)
				: null;
			if (selectedSubDivision && form.divisionId && selectedSubDivision.divisionId !== form.divisionId) {
				throw new Error("Subdivisi yang dipilih tidak sesuai dengan divisi katalog.");
			}
			const payload: CatalogProductPayload = {
				productId: productForSave.id,
				marketingName,
				sellingPrice,
				description,
				imageList: form.imageList.map((item) => sanitizeText(item)).filter(Boolean),
				isPublished: form.isPublished,
				divisionId: form.divisionId || null,
				subDivisionId: form.subDivisionId || null,
			};
			if (productForSave.catalogProduct?.id) {
				await catalogProductsService.update(productForSave.catalogProduct.id, payload);
			} else {
				await catalogProductsService.create(payload);
			}
			setForm(emptyForm);
			setEditingProduct(null);
			setCreateModalOpen(false);
			await load();
		} catch (error: unknown) {
			setModalError(getApiErrorMessage(error, "Gagal menyimpan katalog."));
		} finally {
			setSaving(false);
		}
	};

	const handleDeactivate = async () => {
		if (!deletingProduct?.catalogProduct?.id) return;
		setSaving(true);
		setError("");
		try {
			await catalogProductsService.update(deletingProduct.catalogProduct.id, { isPublished: false });
			setDeletingProduct(null);
			await load();
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menonaktifkan katalog."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<FeaturePage
			title="Kelola Katalog"
			description="Katalog marketing dibuat dari item gudang yang sudah punya stok aktif. Nama marketing, harga jual, gambar, dan publish dipisah dari master item gudang."
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
					<h2 className="font-semibold text-slate-900">
						Item Gudang Siap Katalog ({inventoryProducts.length})
					</h2>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => {
								void openCreate();
							}}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
						>
							Tambah dari Gudang
						</button>
						<button
							type="button"
							onClick={() => void load()}
							disabled={loading}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
						>
							Refresh
						</button>
					</div>
				</div>
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Item Gudang</th>
							<th className="px-4 py-3">Nama Katalog</th>
							<th className="px-4 py-3">Kategori / Brand</th>
							<th className="px-4 py-3">Divisi</th>
							<th className="px-4 py-3 text-right">Stok</th>
							<th className="px-4 py-3 text-right">Harga Jual</th>
							<th className="px-4 py-3">Publish</th>
							<th className="px-4 py-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td colSpan={8} className="px-4 py-4 text-slate-600">
									Memuat...
								</td>
							</tr>
						) : inventoryProducts.length === 0 ? (
							<tr>
								<td colSpan={8} className="px-4 py-4 text-slate-600">
									Belum ada item gudang dengan stok aktif.
								</td>
							</tr>
						) : (
							inventoryProducts.map(({ product, summary }) => (
								<tr key={product.id}>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-900">{product.name}</div>
										<div className="text-xs text-slate-500">
											{Array.from(summary.warehouses).join(", ") || "-"}
										</div>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{product.catalogProduct?.marketingName ?? (
											<span className="text-slate-400">Belum dibuat</span>
										)}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{product.category?.name ?? "-"} / {product.brand?.name ?? "-"}
									</td>
									<td className="px-4 py-3 text-slate-700">
										{product.catalogProduct?.division?.name ?? product.division?.name ?? "-"}
										{product.catalogProduct?.subDivision?.name
											? ` / ${product.catalogProduct.subDivision.name}`
											: product.subDivision?.name
												? ` / ${product.subDivision.name}`
												: ""}
									</td>
									<td className="px-4 py-3 text-right text-slate-900">{summary.quantity}</td>
									<td className="px-4 py-3 text-right text-slate-900">
										{typeof product.catalogProduct?.sellingPrice === "number"
											? product.catalogProduct.sellingPrice.toLocaleString("id-ID")
											: "-"}
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-1 text-xs font-medium ${
												product.catalogProduct?.isPublished
													? "bg-emerald-100 text-emerald-800"
													: product.catalogProduct
														? "bg-amber-100 text-amber-800"
														: "bg-slate-100 text-slate-600"
											}`}
										>
											{product.catalogProduct?.isPublished
												? "Publish"
												: product.catalogProduct
													? "Draft"
													: "Belum Ada"}
										</span>
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => {
													void openEdit(product);
												}}
												className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
											>
												{product.catalogProduct ? "Edit" : "Buat Katalog"}
											</button>
											{product.catalogProduct ? (
												<button
													type="button"
													onClick={() => setDeletingProduct(product)}
													className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
												>
													Nonaktifkan
												</button>
											) : null}
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>

			<Modal
				isOpen={createModalOpen}
				onClose={() => {
					setCreateModalOpen(false);
					setEditingProduct(null);
					setModalError("");
				}}
				title={editingProduct?.catalogProduct ? "Edit Katalog" : "Tambah Katalog dari Gudang"}
			>
				<div className="flex max-h-[70vh] flex-col">
					{modalError ? (
						<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{modalError}
						</div>
					) : null}
					{referencesLoading ? (
						<div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
							Memuat referensi divisi dan subdivisi...
						</div>
					) : null}
					<form id="catalog-form" onSubmit={handleSave} className="flex-1 space-y-4 overflow-y-auto pr-2">
						<label className="block space-y-1 text-sm text-slate-700">
							<span>Item Gudang</span>
							<select
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
								value={form.productId}
								onChange={(event) => {
									const product = productById.get(event.target.value);
									if (product) setFormFromProduct(product);
								}}
								disabled={saving || Boolean(editingProduct?.catalogProduct)}
								required
							>
								{inventoryProducts.map(({ product, summary }) => (
									<option key={product.id} value={product.id}>
										{product.name} - stok {summary.quantity}
									</option>
								))}
							</select>
						</label>
						<div className="grid gap-4 md:grid-cols-2">
							<label className="block space-y-1 text-sm text-slate-700">
								<span>Kategori dari Gudang</span>
								<input
									className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
									value={selectedProduct?.category?.name ?? "-"}
									disabled
								/>
							</label>
							<label className="block space-y-1 text-sm text-slate-700">
								<span>Brand dari Gudang</span>
								<input
									className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
									value={selectedProduct?.brand?.name ?? "-"}
									disabled
								/>
							</label>
						</div>
						<div className="grid gap-4 md:grid-cols-3">
							<label className="block space-y-1 text-sm text-slate-700">
								<span>Stok Gudang</span>
								<input
									className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
									value={selectedSummary?.quantity ?? 0}
									disabled
								/>
							</label>
							<label className="block space-y-1 text-sm text-slate-700 md:col-span-2">
								<span>Lokasi Gudang</span>
								<input
									className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
									value={selectedWarehouses}
									disabled
								/>
							</label>
						</div>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Nama produk marketing"
							value={form.marketingName}
							onChange={(event) =>
								setForm((current) => ({ ...current, marketingName: event.target.value }))
							}
							disabled={saving}
							required
						/>
						<div className="grid gap-4 md:grid-cols-2">
							<label className="block space-y-1 text-sm text-slate-700">
								<span>Divisi Katalog</span>
								<select
									className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
									value={form.divisionId}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											divisionId: event.target.value,
											subDivisionId: "",
										}))
									}
									disabled={saving || referencesLoading}
								>
									<option value="">Tanpa divisi</option>
									{divisions.map((division) => (
										<option key={division.id} value={division.id}>
											{division.name}
										</option>
									))}
								</select>
							</label>
							<label className="block space-y-1 text-sm text-slate-700">
								<span>Subdivisi Katalog</span>
								<select
									className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
									value={form.subDivisionId}
									onChange={(event) =>
										setForm((current) => ({ ...current, subDivisionId: event.target.value }))
									}
									disabled={saving || referencesLoading || !form.divisionId}
								>
									<option value="">Tanpa subdivisi</option>
									{availableSubDivisions.map((subDivision) => (
										<option key={subDivision.id} value={subDivision.id}>
											{subDivision.name}
										</option>
									))}
								</select>
							</label>
						</div>
						<input
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Harga jual katalog"
							type="number"
							min={0}
							value={form.sellingPrice}
							onChange={(event) =>
								setForm((current) => ({ ...current, sellingPrice: event.target.value }))
							}
							disabled={saving}
							required
						/>
						<textarea
							className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							placeholder="Deskripsi marketing produk"
							value={form.description}
							onChange={(event) =>
								setForm((current) => ({ ...current, description: event.target.value }))
							}
							disabled={saving}
						/>
						<div className="space-y-2">
							<p className="text-sm font-medium text-slate-800">Gambar Katalog</p>
							<div className="grid gap-2 md:grid-cols-2">
								<input
									className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
									placeholder="Tempel URL gambar"
									value={form.imageUrl}
									onChange={(event) =>
										setForm((current) => ({ ...current, imageUrl: event.target.value }))
									}
									disabled={saving}
								/>
								<button
									type="button"
									onClick={handleAddImageUrl}
									disabled={saving || !form.imageUrl.trim()}
									className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
								>
									Tambah URL
								</button>
							</div>
							<input
								type="file"
								accept="image/*"
								onChange={handleSelectImageFile}
								disabled={saving || uploadingImage}
								className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-60"
							/>
							{form.imageList.length === 0 ? (
								<p className="text-xs text-slate-500">Belum ada gambar.</p>
							) : (
								<div className="grid grid-cols-2 gap-2 md:grid-cols-4">
									{form.imageList.map((url, index) => (
										<div
											key={`${url}-${index}`}
											className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
										>
											<Image
												src={url}
												alt=""
												width={160}
												height={80}
												className="h-20 w-full object-cover"
												unoptimized
											/>
											<button
												type="button"
												onClick={() => removeImageAt(index)}
												disabled={saving}
												className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-white disabled:opacity-60"
											>
												Hapus
											</button>
										</div>
									))}
								</div>
							)}
						</div>
						<label className="flex items-center gap-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={form.isPublished}
								onChange={(event) =>
									setForm((current) => ({ ...current, isPublished: event.target.checked }))
								}
								className="h-4 w-4"
								disabled={saving}
							/>
							Publish ke katalog toko dan sales
						</label>
						<p className="text-xs text-slate-500">
							Kondisi stok: {selectedConditions}. Hanya item gudang dengan stok aktif yang bisa tampil ke
							toko dan sales.
						</p>
					</form>
					<div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-4">
						<button
							type="button"
							onClick={() => setCreateModalOpen(false)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={saving || uploadingImage}
						>
							Batal
						</button>
						<button
							type="submit"
							form="catalog-form"
							disabled={saving || uploadingImage}
							className="rounded-xl bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{saving ? "Menyimpan..." : "Simpan"}
						</button>
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={Boolean(deletingProduct)}
				onClose={() => setDeletingProduct(null)}
				title="Nonaktifkan Katalog"
			>
				<div className="space-y-4">
					<p className="text-sm text-slate-700">
						Nonaktifkan{" "}
						<span className="font-semibold">
							{deletingProduct?.catalogProduct?.marketingName ?? deletingProduct?.name}
						</span>{" "}
						dari katalog toko dan sales?
					</p>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setDeletingProduct(null)}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
							disabled={saving}
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleDeactivate}
							disabled={saving}
							className="rounded-xl bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
						>
							{saving ? "Menonaktifkan..." : "Nonaktifkan"}
						</button>
					</div>
				</div>
			</Modal>
		</FeaturePage>
	);
}
