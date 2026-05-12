'use client';

import { useEffect, useState } from 'react';
import { categoryService, type Category } from '@/services/category';
import DataTable from '@/components/shared/DataTable';
import FormInput from '@/components/shared/FormInput';

const initialFormState = { name: '' };

export default function OwnerCategoryMasterDataPage() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
	const [formState, setFormState] = useState(initialFormState);
	const [isSaving, setIsSaving] = useState(false);

	const loadCategories = async () => {
		try {
			const categoryResult = await categoryService.getAll(1, 100);
			setCategories(categoryResult.data ?? []);
		} catch (error) {
			console.error(error);
		}
	};

	useEffect(() => {
		loadCategories();
	}, []);

	const resetForm = () => {
		setSelectedCategory(null);
		setFormState(initialFormState);
	};

	const handleEdit = (category: Category) => {
		setSelectedCategory(category);
		setFormState({ name: category.name });
	};

	const handleSave = async () => {
		if (!formState.name.trim()) {
			return;
		}

		setIsSaving(true);
		try {
			if (selectedCategory) {
				await categoryService.update(selectedCategory.id, {
					name: formState.name,
				});
			} else {
				await categoryService.create({ name: formState.name });
			}
			resetForm();
			await loadCategories();
		} catch (error) {
			console.error(error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm('Hapus kategori ini?')) {
			return;
		}

		try {
			await categoryService.delete(id);
			setCategories((current) => current.filter((item) => item.id !== id));
		} catch (error) {
			console.error(error);
		}
	};

	return (
		<div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold text-slate-900">Kategori</h1>
				<p className="max-w-2xl text-sm text-slate-600">Kelola kategori produk yang digunakan di master data.</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
				<section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Daftar Kategori</h2>
					<DataTable
						columns={[
							{ key: 'name', head: 'Nama Kategori' },
							{ key: 'createdAt', head: 'Dibuat' },
							{
								key: 'actions',
								head: 'Aksi',
								render: (item) => (
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
								),
							},
						]}
						data={categories}
						emptyText="Belum ada kategori terdaftar"
					/>
				</section>

				<aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">
						{selectedCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
					</h2>
					<FormInput
						label="Nama Kategori"
						value={formState.name}
						onChange={(event) => setFormState({ name: event.target.value })}
						placeholder="Masukkan nama kategori"
					/>
					<button
						onClick={handleSave}
						disabled={isSaving}
						className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
					>
						{isSaving ? 'Menyimpan...' : selectedCategory ? 'Perbarui Kategori' : 'Simpan Kategori'}
					</button>
					{selectedCategory ? (
						<button
							onClick={resetForm}
							className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
						>
							Batal Edit
						</button>
					) : null}
				</aside>
			</div>
		</div>
	);
}
