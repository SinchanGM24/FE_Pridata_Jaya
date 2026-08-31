'use client';

import { useEffect, useState } from 'react';
import { categoryService } from '@/services/category';
import { brandService } from '@/services/brand';
import { productService, type Product } from '@/services/product';
import { getApiErrorMessage } from '@/lib/api-errors';
import DataTable from '@/components/shared/DataTable';
import FormInput from '@/components/shared/FormInput';
import SearchCombobox from '@/components/shared/SearchCombobox';
import { FeaturePage } from '@/components/shared/FeaturePage';

const initialFormState = {
	name: '',
	categoryId: '',
	brandId: '',
};

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

export default function ProductMasterDataPage() {
	const [products, setProducts] = useState<Product[]>([]);
	const [formState, setFormState] = useState(initialFormState);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		let cancelled = false;

		const loadData = async () => {
			try {
				const productResult = await productService.getAll(1, 50);

				if (cancelled) return;
				setProducts(productResult.data ?? []);
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
			const productResult = await productService.getAll(1, 50);
			setProducts(productResult.data ?? []);
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
		<FeaturePage title="Produk" description="Kelola daftar produk dan hubungkan dengan kategori serta brand.">
			<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
				<section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold text-slate-900">Daftar Produk</h2>
						<p className="text-sm text-slate-500">Total produk: {products.length}</p>
					</div>
					<DataTable
						columns={[
							{ key: 'name', head: 'Nama Produk' },
							{ key: 'categoryId', head: 'Kategori', render: (item) => item.category?.name ?? '-' },
							{ key: 'brandId', head: 'Brand', render: (item) => item.brand?.name ?? '-' },
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

						<SearchCombobox label="Kategori" value={formState.categoryId} selectedOption={selectedProduct?.category ? { value: selectedProduct.category.id, label: selectedProduct.category.name } : null} loadOptions={async (query) => (await categoryService.search(query)).map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => handleChange('categoryId', value)} placeholder="Cari kategori" />

						<SearchCombobox label="Brand" value={formState.brandId} selectedOption={selectedProduct?.brand ? { value: selectedProduct.brand.id, label: selectedProduct.brand.name } : null} loadOptions={async (query) => (await brandService.search(query)).map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => handleChange('brandId', value)} placeholder="Cari brand" />
						<p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
							Stok dikelola dari transaksi gudang. Publish dikelola dari halaman katalog.
						</p>

						{errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
						<button
							onClick={handleSave}
							disabled={isSaving}
							className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
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
		</FeaturePage>
	);
}
