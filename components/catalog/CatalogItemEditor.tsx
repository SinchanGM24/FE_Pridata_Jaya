"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import SearchCombobox from "@/components/shared/SearchCombobox";
import { getApiErrorMessage } from "@/lib/api-errors";
import type { CatalogProductPayload } from "@/services/catalog-products";
import { digitalMarketingCatalogService } from "@/services/digital-marketing-catalog";
import type { DivisionListItem } from "@/services/divisions";
import type { Product } from "@/services/products";
import type { SubDivisionListItem } from "@/services/subdivisions";

type FormState = {
	marketingName: string;
	sellingPrice: string;
	description: string;
	divisionId: string;
	subDivisionId: string;
	imageList: string[];
	imageUrl: string;
	isPublished: boolean;
};

const emptyForm: FormState = { marketingName: "", sellingPrice: "", description: "", divisionId: "", subDivisionId: "", imageList: [], imageUrl: "", isPublished: false };
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const sanitize = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

function Field({ label, required = false, helper, children }: { label: string; required?: boolean; helper?: string; children: ReactNode }) {
	return <label className="block space-y-2 text-sm text-slate-700"><span className="font-medium">{label}{required ? <span className="text-rose-600"> *</span> : null}</span>{children}{helper ? <span className="block text-xs leading-5 text-slate-500">{helper}</span> : null}</label>;
}

export default function CatalogItemEditor({ productId }: { productId: string }) {
	const router = useRouter();
	const [product, setProduct] = useState<Product | null>(null);
	const [stock, setStock] = useState(0);
	const [warehouses, setWarehouses] = useState<string[]>([]);
	const [divisions, setDivisions] = useState<DivisionListItem[]>([]);
	const [subDivisions, setSubDivisions] = useState<SubDivisionListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [form, setForm] = useState<FormState>(emptyForm);

	useEffect(() => {
		let cancelled = false;
		void digitalMarketingCatalogService.getWorkspace()
			.then(({ products, inventory, divisions: divisionRows, subDivisions: subDivisionRows }) => {
				if (cancelled) return;
				const productRow = products.find((item) => item.id === productId);
				if (!productRow) throw new Error("Produk tidak ditemukan.");
				const inventoryRows = inventory.filter((item) => item.productId === productId);
				const catalog = productRow.catalogProduct;
				setProduct(productRow);
				setStock(inventoryRows.reduce((sum, row) => sum + row.quantity, 0));
				setWarehouses(Array.from(new Set(inventoryRows.map((row) => row.warehouse?.name).filter((name): name is string => Boolean(name)))));
				setDivisions(divisionRows);
				setSubDivisions(subDivisionRows);
				setForm({
					marketingName: catalog?.marketingName ?? productRow.name,
					sellingPrice: catalog ? String(catalog.sellingPrice) : "",
					description: catalog?.description ?? productRow.productDetail?.description ?? "",
					divisionId: catalog?.divisionId ?? productRow.divisionId ?? "",
					subDivisionId: catalog?.subDivisionId ?? productRow.subDivisionId ?? "",
					imageList: catalog?.imageList ?? productRow.productDetail?.imageList ?? [],
					imageUrl: "",
					isPublished: catalog?.isPublished ?? false,
				});
			})
			.catch((loadError: unknown) => {
				if (!cancelled) setError(getApiErrorMessage(loadError, "Gagal memuat detail katalog."));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => { cancelled = true; };
	}, [productId]);

	const availableSubDivisions = useMemo(
		() => subDivisions.filter((item) => !form.divisionId || item.divisionId === form.divisionId).filter((item) => !product?.categoryId || item.categoryId === product.categoryId),
		[form.divisionId, product, subDivisions],
	);

	const addImageUrl = () => {
		const url = sanitize(form.imageUrl);
		if (!url) return;
		setForm((current) => ({ ...current, imageList: current.imageList.includes(url) ? current.imageList : [...current.imageList, url], imageUrl: "" }));
	};

	const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { setError("Ukuran gambar maksimal 2MB."); return; }
		setUploading(true);
		setError("");
		try {
			const imageUrl = await digitalMarketingCatalogService.uploadImage(file);
			setForm((current) => ({ ...current, imageList: current.imageList.includes(imageUrl) ? current.imageList : [...current.imageList, imageUrl] }));
		} catch (uploadError: unknown) {
			setError(getApiErrorMessage(uploadError, "Gagal mengunggah gambar."));
		} finally {
			setUploading(false);
		}
	};

	const save = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!product) return;
		const sellingPrice = Number(form.sellingPrice);
		if (!sanitize(form.marketingName)) { setError("Nama marketing wajib diisi."); return; }
		if (!Number.isInteger(sellingPrice) || sellingPrice < 0) { setError("Harga jual harus berupa angka bulat 0 atau lebih."); return; }
		if (stock <= 0) { setError("Produk harus memiliki stok aktif sebelum masuk katalog."); return; }
		setSaving(true);
		setError("");
		setSuccess("");
		const payload: CatalogProductPayload = {
			productId: product.id,
			marketingName: sanitize(form.marketingName),
			sellingPrice,
			description: sanitize(form.description),
			divisionId: form.divisionId || null,
			subDivisionId: form.subDivisionId || null,
			imageList: form.imageList.map(sanitize).filter(Boolean),
			isPublished: form.isPublished,
		};
		try {
			const updated = await digitalMarketingCatalogService.save(product, payload);
			setProduct((current) => current ? { ...current, catalogProduct: updated } : current);
			setSuccess("Katalog berhasil disimpan.");
		} catch (saveError: unknown) {
			setError(getApiErrorMessage(saveError, "Gagal menyimpan katalog."));
		} finally {
			setSaving(false);
		}
	};

	const deactivate = async () => {
		if (!product?.catalogProduct?.id || !window.confirm("Nonaktifkan katalog produk ini?")) return;
		setSaving(true);
		setError("");
		setSuccess("");
		try {
			await digitalMarketingCatalogService.save(product, { isPublished: false });
			setForm((current) => ({ ...current, isPublished: false }));
			setProduct((current) => current?.catalogProduct ? { ...current, catalogProduct: { ...current.catalogProduct, isPublished: false } } : current);
			setSuccess("Katalog berhasil dinonaktifkan.");
		} catch (deactivateError: unknown) {
			setError(getApiErrorMessage(deactivateError, "Gagal menonaktifkan katalog."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<FeaturePage title="Detail Katalog Produk" description="Lengkapi informasi pemasaran, media, klasifikasi, dan status tayang untuk satu produk.">
			<PageFeedback error={error} success={success} onDismissError={() => setError("")} onDismissSuccess={() => setSuccess("")} />
			<div><Link href="/digital-marketing/kelola-katalog" className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Kembali ke Daftar</Link></div>

			{loading ? (
				<div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Memuat detail katalog...</div>
			) : !product ? (
				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Produk tidak ditemukan.</div>
			) : (
				<form onSubmit={save} className="space-y-6">
					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div>
							<div className="max-w-2xl">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Produk Master</p>
								<h2 className="mt-2 text-xl font-semibold text-slate-900">{product.name}</h2>
								<p className="mt-1 text-sm text-slate-500">Data produk dasar bersifat referensi dan tidak diubah dari halaman ini.</p>
							</div>
							<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
								<div className="min-w-32 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Stok Aktif</p><p className="mt-1 text-lg font-semibold text-slate-900">{stock.toLocaleString("id-ID")}</p></div>
								<div className="min-w-32 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Status</p><p className="mt-1 text-sm font-semibold text-slate-900">{product.catalogProduct ? "Sudah Dibuat" : "Belum Dibuat"}</p></div>
								<div className="min-w-32 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Kategori</p><p className="mt-1 text-sm font-semibold text-slate-900">{product.category?.name ?? "-"}</p></div>
								<div className="min-w-32 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Brand</p><p className="mt-1 text-sm font-semibold text-slate-900">{product.brand?.name ?? "-"}</p></div>
								<div className="min-w-44 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Lokasi Gudang</p><p className="mt-1 text-sm font-semibold text-slate-900">{warehouses.join(", ") || "-"}</p></div>
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="border-b border-slate-200 pb-4"><h2 className="text-lg font-semibold text-slate-900">Informasi Katalog</h2><p className="mt-1 text-sm text-slate-600">Informasi utama dan pengelompokan produk yang akan dibaca oleh toko dan sales.</p></div>
						<div className="mt-5 grid gap-5 md:grid-cols-2">
							<Field label="Nama Marketing" required><input value={form.marketingName} onChange={(event) => setForm((current) => ({ ...current, marketingName: event.target.value }))} className={inputClass} /></Field>
							<Field label="Harga Jual" required helper="Gunakan angka tanpa titik atau simbol rupiah."><input type="number" min={0} value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} className={inputClass} /></Field>
							<div className="md:col-span-2"><Field label="Deskripsi Produk"><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} min-h-32 resize-y`} /></Field></div>
							<SearchCombobox label="Divisi" value={form.divisionId} options={divisions.map((item) => ({ value: item.id, label: item.name }))} onChange={(divisionId) => setForm((current) => ({ ...current, divisionId, subDivisionId: "" }))} placeholder="Cari divisi (opsional)" />
							<SearchCombobox label="Subdivisi" value={form.subDivisionId} options={availableSubDivisions.map((item) => ({ value: item.id, label: item.name }))} dependencyKey={`${product.categoryId ?? ""}:${form.divisionId}`} disabled={!form.divisionId} onChange={(subDivisionId) => setForm((current) => ({ ...current, subDivisionId }))} placeholder={form.divisionId ? "Cari subdivisi (opsional)" : "Pilih divisi dahulu"} />
						</div>
					</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="border-b border-slate-200 pb-4"><h2 className="text-lg font-semibold text-slate-900">Media Produk</h2><p className="mt-1 text-sm text-slate-600">Tambahkan gambar melalui unggahan atau URL. Ukuran file maksimal 2MB.</p></div><div className="mt-5 space-y-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://alamat-gambar..." className={inputClass} /><button type="button" onClick={addImageUrl} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Tambah URL</button></div><label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40"><span className="text-sm font-semibold text-slate-800">{uploading ? "Mengunggah gambar..." : "Pilih gambar dari perangkat"}</span><span className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP · Maksimal 2MB</span><input type="file" accept="image/*" onChange={uploadImage} disabled={uploading || saving} className="sr-only" /></label>{form.imageList.length === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Belum ada gambar katalog.</div> : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{form.imageList.map((url, index) => <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><Image src={url} alt={`Gambar katalog ${index + 1}`} width={240} height={160} unoptimized className="h-36 w-full object-cover" />{index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-white">Utama</span> : null}<button type="button" onClick={() => setForm((current) => ({ ...current, imageList: current.imageList.filter((_, imageIndex) => imageIndex !== index) }))} className="absolute bottom-2 right-2 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50">Hapus</button></div>)}</div>}</div></section>

					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
							<div><h2 className="text-lg font-semibold text-slate-900">Status Penayangan</h2><p className="mt-1 text-sm text-slate-600">Pilih satu status untuk menentukan apakah produk ditampilkan pada katalog toko dan sales.</p></div>
							<div role="group" aria-label="Status penayangan katalog" className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
								<button
									type="button"
									aria-pressed={!form.isPublished}
									disabled={saving}
									onClick={() => setForm((current) => ({ ...current, isPublished: false }))}
									className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${!form.isPublished ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
								>
									Draft
								</button>
								<button
									type="button"
									aria-pressed={form.isPublished}
									disabled={saving}
									onClick={() => setForm((current) => ({ ...current, isPublished: true }))}
									className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${form.isPublished ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
								>
									Published
								</button>
							</div>
						</div>
						<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
							<button type="button" onClick={deactivate} disabled={!product.catalogProduct || saving || !product.catalogProduct.isPublished} className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">Nonaktifkan Katalog</button>
							<div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => router.push("/digital-marketing/kelola-katalog")} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Batal</button><button type="submit" disabled={saving || uploading} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan Katalog"}</button></div>
						</div>
					</section>
				</form>
			)}
		</FeaturePage>
	);
}
