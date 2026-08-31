"use client";

import Link from "next/link";
import { FeaturePage } from "@/components/shared/FeaturePage";

const masterDataItems = [
	{
		title: "Kategori",
		description: "Buat dan kelola kategori produk yang digunakan pada item gudang.",
		href: "/gudang/master-data/categories",
	},
	{
		title: "Brand",
		description: "Buat dan kelola brand produk untuk kebutuhan penerimaan dan stok.",
		href: "/gudang/master-data/brands",
	},
	{
		title: "Divisi",
		description: "Kelola divisi untuk pengelompokan produk dan katalog.",
		href: "/gudang/master-data/divisions",
	},
	{
		title: "Subdivisi",
		description: "Kelola subdivisi berdasarkan pasangan kategori dan divisi.",
		href: "/gudang/master-data/subdivisions",
	},
] as const;

export default function WarehouseMasterDataPage() {
	return (
		<FeaturePage
			title="Master Data Gudang"
			description="Kelola kategori, brand, divisi, dan subdivisi yang dipakai bersama oleh item gudang dan katalog."
		>
			<section className="grid gap-4 md:grid-cols-2">
				{masterDataItems.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow"
					>
						<h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
						<p className="mt-1 text-sm text-slate-600">{item.description}</p>
						<span className="mt-4 inline-flex text-sm font-semibold text-emerald-700">Kelola Data</span>
					</Link>
				))}
			</section>
		</FeaturePage>
	);
}
