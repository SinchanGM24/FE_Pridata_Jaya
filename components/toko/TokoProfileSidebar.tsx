"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TokoProfileSidebarProps {
	basePath?: string;
}

export default function TokoProfileSidebar({
	basePath = "/toko",
}: TokoProfileSidebarProps) {
	const pathname = usePathname();
	const isSalesManagedStore = basePath.startsWith("/sales/toko-kelolaan/");
	const items = [
		{ label: "Profil", href: `${basePath}/profile` },
		{ label: "Riwayat Transaksi", href: `${basePath}/riwayat-transaksi` },
		{ label: "Grade Toko", href: `${basePath}/grade-saya` },
		{ label: "Tagihan", href: `${basePath}/hutang-toko` },
		...(isSalesManagedStore ? [{ label: "Aging Piutang", href: `${basePath}/aging-piutang` }] : []),
		...(isSalesManagedStore ? [] : [{ label: "Invoice Pembayaran", href: `${basePath}/invoice-cash` }]),
		{ label: "Retur", href: `${basePath}/retur` },
	];

	return (
		<aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
			<p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
				Menu Toko
			</p>
			<nav className="mt-2 space-y-1">
				{items.map((item) => {
					const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${
								active ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
							}`}
						>
							{item.label}
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}
