'use client';

import Link from 'next/link';

const cards = [
	{ title: 'Products', description: 'Kelola produk, stok, kategori, dan brand.', href: '/admin/master-data/products' },
	{ title: 'Categories', description: 'Kelola kategori master data produk.', href: '/admin/master-data/categories' },
	{ title: 'Brands', description: 'Kelola brand master data produk.', href: '/admin/master-data/brands' },
];

export default function MasterDataPage() {
	return (
		<div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold text-slate-900">Master Data</h1>
				<p className="max-w-2xl text-sm text-slate-600">
					Kelola data master untuk produk, kategori, dan brand.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				{cards.map((card) => (
					<Link key={card.title} href={card.href} className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm">
						<h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
						<p className="mt-2 text-sm text-slate-600">{card.description}</p>
						<span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700">Buka <span aria-hidden>→</span></span>
					</Link>
				))}
			</div>
		</div>
	);
}
