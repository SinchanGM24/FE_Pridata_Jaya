"use client";

import Link from 'next/link';

export default function DashboardQuickActions() {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-sm font-semibold text-slate-800">Quick actions</p>
			<div className="mt-3 flex flex-wrap gap-2">
				<Link href="/owner/kelola-toko" className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white">
					Kelola toko
				</Link>
				<Link href="/owner/kelola-user" className="rounded-md border border-slate-200 px-3 py-2 text-xs">
					User & sales
				</Link>
				<Link href="/owner/kelola-katalog" className="rounded-md border border-slate-200 px-3 py-2 text-xs">
					Katalog
				</Link>
			</div>
		</div>
	);
}
