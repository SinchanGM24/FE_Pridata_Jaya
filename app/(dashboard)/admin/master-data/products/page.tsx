'use client';

import { useEffect, useMemo, useState } from 'react';
import { categoryService } from '@/services/category';
import { brandService } from '@/services/brand';
import { productService, type Product } from '@/services/product';
import { getApiErrorMessage } from '@/lib/api-errors';
import DataTable from '@/components/shared/DataTable';
import FormInput from '@/components/shared/FormInput';
import SelectInput from '@/components/shared/SelectInput';

const initialFormState = {
	name: '',
	categoryId: '',
	brandId: '',
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

export default function ProductMasterDataPage() {
	const [products, setProducts] = useState<Product[]>([]);
	const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
	const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
	const [formState, setFormState] = useState(initialFormState);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		let cancelled = false;

		const loadData = async () => {
			try {
				const [productResult, categoryResult, brandResult] = await Promise.all([
					productService.getAll(1, 50),
					categoryService.getAll(1, 100),
					brandService.getAll(1, 100),
				]);

				if (cancelled) return;
				setProducts(productResult.data ?? []);
				setCategories(categoryResult.data ?? []);
				setBrands(brandResult.data ?? []);
			} catch (error: unknown) {
				if (cancelled) return;
				setErrorMessage(getApiErrorMessage(error, 'Gagal memuat master data produk.'));
			}
		};

		void loadData();

		return () => {
			cancelled = true;
		};
	}, []);

	const categoryMap = useMemo(() => {
		return Object.fromEntries(categories.map((item) => [item.id, item.name]));
	}, [categories]);

	const brandMap = useMemo(() => {
		return Object.fromEntries(brands.map((item) => [item.id, item.name]));
	}, [brands]);

	const handleChange = (field: string, value: string | number | boolean) => {
		setFormState((current) => ({ ...current, [field]: value }));
	};

	const resetForm = () => {
		setSelectedProduct(null);
		setFormState(initialFormState);
		setErrorMessage('');
	};

	const handleEdit = (product: Product) => {
		setSelectedProduct(product);
		setFormState({
			name: product.name || '',
			categoryId: product.categoryId ?? '',
			brandId: product.brandId ?? '',
		});
	};

	const handleSave = async () => {
		setErrorMessage('');
		setIsSaving(true);
		try {
			const name = sanitizeText(formState.name);
			if (!name) {
				throw new Error('Nama produk wajib diisi.');
			}
			if (selectedProduct) {
				await productService.update(selectedProduct.id, {
					name,
					categoryId: formState.categoryId || undefined,
					brandId: formState.brandId || undefined,
				});
			} else {
				await productService.create({
					name,
					categoryId: formState.categoryId || undefined,
					brandId: formState.brandId || undefined,
				});
			}
			resetForm();
			const [productResult, categoryResult, brandResult] = await Promise.all([
				productService.getAll(1, 50),
				categoryService.getAll(1, 100),
				brandService.getAll(1, 100),
			]);
			setProducts(productResult.data ?? []);
			setCategories(categoryResult.data ?? []);
			setBrands(brandResult.data ?? []);
		} catch (error: unknown) {
			setErrorMessage(getApiErrorMessage(error, 'Gagal menyimpan produk. Periksa kembali input.'));
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm('Hapus produk ini?')) {
			return;
		}

		try {
			await productService.delete(id);
			setProducts((current) => current.filter((item) => item.id !== id));
		} catch (error: unknown) {
			setErrorMessage(getApiErrorMessage(error, 'Gagal menghapus produk.'));
		}
	};

	return (
		<div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold text-slate-900">Produk</h1>
				<p className="max-w-2xl text-sm text-slate-600">
					Kelola daftar produk dan hubungkan dengan kategori serta brand.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
				<section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold text-slate-900">Daftar Produk</h2>
						<p className="text-sm text-slate-500">Total produk: {products.length}</p>
					</div>
					<DataTable
						columns={[
							{ key: 'name', head: 'Nama Produk' },
							{ key: 'categoryId', head: 'Kategori', render: (item) => categoryMap[item.categoryId ?? ''] ?? item.categoryId ?? '-' },
							{ key: 'brandId', head: 'Brand', render: (item) => brandMap[item.brandId ?? ''] ?? item.brandId ?? '-' },
							{ key: 'stockQuantity', head: 'Stok', render: (item) => item.stockQuantity ?? '-' },
							{ key: 'isPublished', head: 'Publish', render: () => 'Kelola di katalog' },
							{ key: 'actions', head: 'Aksi', render: (item) => (
								<div className="flex items-center gap-2">
									<button
										onClick={() => handleEdit(item)}
										className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
									>
										Edit
									</button>
									<button
										onClick={() => handleDelete(item.id)}
										className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
									>
										Hapus
									</button>
								</div>
							)},
						]}
						data={products}
						emptyText="Belum ada produk yang terdaftar"
					/>
				</section>

				<aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">{selectedProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
					<div className="space-y-4">
						<FormInput
							label="Nama Produk"
							value={formState.name}
							onChange={(event) => handleChange('name', event.target.value)}
							placeholder="Masukkan nama produk"
						/>

						<SelectInput
							label="Kategori"
							value={formState.categoryId}
							onChange={(event) => handleChange('categoryId', event.target.value)}
						>
							<option value="">Pilih kategori</option>
							{categories.map((category) => (
								<option key={category.id} value={category.id}>
									{category.name}
								</option>
							))}
						</SelectInput>

						<SelectInput
							label="Brand"
							value={formState.brandId}
							onChange={(event) => handleChange('brandId', event.target.value)}
						>
							<option value="">Pilih brand</option>
							{brands.map((brand) => (
								<option key={brand.id} value={brand.id}>
									{brand.name}
								</option>
							))}
						</SelectInput>
						<p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
							Stok dikelola dari transaksi gudang. Publish dikelola dari halaman katalog.
						</p>

						{errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
						<button
							onClick={handleSave}
							disabled={isSaving}
							className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
						>
							{isSaving ? 'Menyimpan...' : selectedProduct ? 'Perbarui Produk' : 'Simpan Produk'}
						</button>
						{selectedProduct ? (
							<button
								onClick={resetForm}
								className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
							>
								Batal Edit
							</button>
						) : null}
					</div>
				</aside>
			</div>
		</div>
	);
}
