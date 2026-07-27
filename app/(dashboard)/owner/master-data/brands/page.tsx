'use client';

export const dynamic = "force-dynamic";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { brandService, type Brand } from '@/services/brand';
import { getApiErrorMessage } from '@/lib/api-errors';
import DataTable from '@/components/shared/DataTable';
import FormInput from '@/components/shared/FormInput';
import { FeaturePage } from '@/components/shared/FeaturePage';

const initialFormState = { name: '' };

function OwnerBrandMasterDataPageContent() {
	const searchParams = useSearchParams();
	const [brands, setBrands] = useState<Brand[]>([]);
	const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
	const [formState, setFormState] = useState(initialFormState);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const search = searchParams.get('search') ?? '';

	useEffect(() => {
		let cancelled = false;

		const loadBrands = async () => {
			try {
				const brandResult = await brandService.getAll(1, 100);
				if (cancelled) return;
				setBrands(brandResult.data ?? []);
			} catch (error: unknown) {
				if (cancelled) return;
				setErrorMessage(getApiErrorMessage(error, 'Gagal memuat brand.'));
			}
		};

		void loadBrands();

		return () => {
			cancelled = true;
		};
	}, []);

	const resetForm = () => {
		setSelectedBrand(null);
		setFormState(initialFormState);
		setErrorMessage('');
	};

	const handleEdit = (brand: Brand) => {
		setSelectedBrand(brand);
		setFormState({ name: brand.name });
	};

	const handleSave = async () => {
		if (!formState.name.trim()) {
			return;
		}

		setIsSaving(true);
		setErrorMessage('');
		try {
			if (selectedBrand) {
				await brandService.update(selectedBrand.id, {
					name: formState.name,
				});
			} else {
				await brandService.create({ name: formState.name });
			}
			resetForm();
			const brandResult = await brandService.getAll(1, 100);
			setBrands(brandResult.data ?? []);
		} catch (error: unknown) {
			setErrorMessage(getApiErrorMessage(error, 'Gagal menyimpan brand.'));
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm('Hapus brand ini?')) {
			return;
		}

		try {
			await brandService.delete(id);
			setBrands((current) => current.filter((item) => item.id !== id));
		} catch (error: unknown) {
			setErrorMessage(getApiErrorMessage(error, 'Gagal menghapus brand.'));
		}
	};

	return (
		<FeaturePage title="Brand" description="Kelola master data brand untuk produk.">
			{errorMessage ? (
				<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
					{errorMessage}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
				<section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Daftar Brand</h2>
					<DataTable
						columns={[
							{ key: 'name', head: 'Nama Brand' },
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
						data={brands.filter((item) =>
							search.trim()
								? item.name.toLowerCase().includes(search.trim().toLowerCase())
								: true,
						)}
						emptyText="Belum ada brand terdaftar"
					/>
				</section>

				<aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">
						{selectedBrand ? 'Edit Brand' : 'Tambah Brand Baru'}
					</h2>
					<FormInput
						label="Nama Brand"
						value={formState.name}
						onChange={(event) => setFormState({ name: event.target.value })}
						placeholder="Masukkan nama brand"
					/>
					<button
						onClick={handleSave}
						disabled={isSaving}
						className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
					>
						{isSaving ? 'Menyimpan...' : selectedBrand ? 'Perbarui Brand' : 'Simpan Brand'}
					</button>
					{selectedBrand ? (
						<button
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

export default function OwnerBrandMasterDataPage() {
	return (
		<Suspense fallback={null}>
			<OwnerBrandMasterDataPageContent />
		</Suspense>
	);
}


export default function OwnerBrandMasterDataPage() {
	return (
		<Suspense fallback={
			<div className="flex min-h-[400px] items-center justify-center p-8">
				<div className="text-sm text-slate-500 animate-pulse">Memuat...</div>
			</div>
		}>
			<OwnerBrandMasterDataPageContent />
		</Suspense>
	);
}
