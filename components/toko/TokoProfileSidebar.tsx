"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TokoProfileSidebarProps {
	basePath?: string;
	className?: string;
}

export default function TokoProfileSidebar({
	basePath = "/toko",
	className = "",
}: TokoProfileSidebarProps) {
	const pathname = usePathname();
	const items = [
		{ label: "Profil", href: `${basePath}/profile` },
		{ label: "Riwayat Transaksi", href: `${basePath}/riwayat-transaksi` },
		{ label: "Grade Toko", href: `${basePath}/grade-saya` },
		{ label: "Tagihan & Pembayaran", href: `${basePath}/hutang-toko` },
		{ label: "Retur", href: `${basePath}/retur` },
	];

	return (
		<aside
			className={`h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
		>
			<p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
				Menu Toko
			</p>
			<nav className="mt-2 space-y-1">
				{items.map((item) => {
					const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<Link
							key={item.href}
							href={item.href}
							aria-current={active ? "page" : undefined}
							className={`flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
								active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
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
