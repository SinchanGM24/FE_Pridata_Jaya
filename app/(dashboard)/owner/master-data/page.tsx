"use client";

import Link from "next/link";
import { FeaturePage } from "@/components/shared/FeaturePage";

export default function OwnerMasterDataPage() {
	return (
		<FeaturePage
			title="Master Data"
			description="Kelola data master pendukung katalog seperti divisi dan subdivisi."
		>
			<section className="grid gap-4 md:grid-cols-2">
				<Link
					href="/owner/master-data/categories"
					className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
				>
					<h2 className="text-lg font-semibold text-slate-900">Kategori</h2>
					<p className="mt-1 text-sm text-slate-600">Buat dan kelola kategori produk.</p>
					<span className="mt-4 inline-flex text-sm font-medium text-slate-700">Buka</span>
				</Link>
				<Link
					href="/owner/master-data/brands"
					className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
				>
					<h2 className="text-lg font-semibold text-slate-900">Brand</h2>
					<p className="mt-1 text-sm text-slate-600">Buat dan kelola brand produk.</p>
					<span className="mt-4 inline-flex text-sm font-medium text-slate-700">Buka</span>
				</Link>
				<Link
					href="/owner/master-data/warehouses"
					className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
				>
					<h2 className="text-lg font-semibold text-slate-900">Gudang</h2>
					<p className="mt-1 text-sm text-slate-600">Buat dan kelola master gudang.</p>
					<span className="mt-4 inline-flex text-sm font-medium text-slate-700">Buka</span>
				</Link>
				<Link
					href="/owner/master-data/divisions"
					className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
				>
					<h2 className="text-lg font-semibold text-slate-900">Divisi</h2>
					<p className="mt-1 text-sm text-slate-600">
						Buat dan kelola divisi untuk pengelompokan katalog.
					</p>
					<span className="mt-4 inline-flex text-sm font-medium text-slate-700">Buka</span>
				</Link>
			<Link
						href="/owner/master-data/subdivisions"
						className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
					>
						<h2 className="text-lg font-semibold text-slate-900">Subdivisi</h2>
						<p className="mt-1 text-sm text-slate-600">
							Buat subdivisi per kategori & divisi untuk mapping produk.
						</p>
						<span className="mt-4 inline-flex text-sm font-medium text-slate-700">Buka</span>
					</Link>
					<Link
						href="/owner/master-data/suppliers"
						className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
					>
						<h2 className="text-lg font-semibold text-slate-900">Supplier</h2>
						<p className="mt-1 text-sm text-slate-600">
							Buat dan kelola data supplier untuk pengadaan barang.
						</p>
						<span className="mt-4 inline-flex text-sm font-medium text-slate-700">Buka</span>
					</Link>
				</section>
		</FeaturePage>
	);
}
