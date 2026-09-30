"use client";

import Link from "next/link";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { useAuth } from "@/hooks/useAuth";
import { canManageProductTaxonomy, canManageWarehouseOperationalMasterData } from "@/lib/role-capabilities";

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

const operationalMasterDataItems = [
	{ title: "Gudang", description: "Buat dan kelola lokasi gudang untuk stok, transfer, dan pengiriman.", href: "/gudang/master-data/warehouses" },
	{ title: "Supplier", description: "Buat dan kelola data supplier untuk penerimaan barang.", href: "/gudang/master-data/suppliers" },
	{ title: "Driver", description: "Kelola driver aktif yang dipilih saat pengiriman barang.", href: "/gudang/master-data/drivers" },
] as const;

export default function WarehouseMasterDataPage() {
	const { user } = useAuth();
	const canManageTaxonomy = canManageProductTaxonomy(user);
	const canManageOperationalMasterData = canManageWarehouseOperationalMasterData(user);
	if (!canManageTaxonomy && !canManageOperationalMasterData) {
		return <FeaturePage title="Master Data Gudang" description="Master data gudang hanya dapat dikelola oleh tim gudang yang berwenang." />;
	}

	return (
		<FeaturePage
			title="Master Data Gudang"
			description="Kelola data master yang dipakai dalam penerimaan, stok, transfer, dan pengiriman gudang."
		>
			<section className="grid gap-4 md:grid-cols-2">
				{(canManageTaxonomy ? masterDataItems : []).map((item) => (
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
				{(canManageOperationalMasterData ? operationalMasterDataItems : []).map((item) => (
					<Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow">
						<h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
						<p className="mt-1 text-sm text-slate-600">{item.description}</p>
						<span className="mt-4 inline-flex text-sm font-semibold text-emerald-700">Kelola Data</span>
					</Link>
				))}
			</section>
		</FeaturePage>
	);
}
