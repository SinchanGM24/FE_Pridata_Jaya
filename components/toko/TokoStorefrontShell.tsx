"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ShoppingCart, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";

interface TokoStorefrontShellProps {
	title: string;
	children: ReactNode;
	cartCount?: number;
}

const navItems = [
	{ label: "Katalog", href: "/toko/katalog" },
	{ label: "Keranjang", href: "/toko/purchase-order" },
	{ label: "Riwayat", href: "/toko/riwayat-transaksi" },
	{ label: "Tagihan", href: "/toko/hutang-toko" },
	{ label: "Pembayaran", href: "/toko/pembayaran-online" },
	{ label: "Profil", href: "/toko/profile" },
];

const initials = (value?: string | null) => {
	const words = String(value || "Toko").trim().split(/\s+/).filter(Boolean);
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0]?.[0] ?? "T"}${words[1]?.[0] ?? "K"}`.toUpperCase();
};

export default function TokoStorefrontShell({
	title,
	children,
	cartCount = 0,
}: TokoStorefrontShellProps) {
	const pathname = usePathname();
	const { user } = useAuth();

	const handleLogout = async () => {
		await authService.logout();
		window.location.href = "/login";
	};

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
				<div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6">
					<div className="flex items-center justify-between gap-3">
						<Link href="/toko/katalog" className="text-3xl font-extrabold tracking-tight text-sky-500">
							Online-Shop
						</Link>
						<div className="flex items-center gap-2">
							<Link
								href="/toko/purchase-order"
								className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
								aria-label="Keranjang"
							>
								<ShoppingCart className="h-5 w-5" />
								{cartCount > 0 ? (
									<span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
										{cartCount}
									</span>
								) : null}
							</Link>
							<Link
								href="/toko/profile"
								className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sm font-bold text-sky-700"
								aria-label="Profil toko"
							>
								{initials(user?.name)}
							</Link>
						</div>
					</div>
					<nav className="flex gap-2 overflow-x-auto">
						{navItems.map((item) => {
							const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
										active
											? "bg-sky-600 text-white"
											: "text-slate-600 hover:bg-slate-100"
									}`}
								>
									{item.label}
								</Link>
							);
						})}
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
				<h1 className="text-2xl font-bold text-slate-900">{title}</h1>
				{children}
			</main>

			<footer className="mt-8 border-t border-sky-100 bg-sky-50">
				<div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-3 md:px-6">
					<div className="flex items-center gap-3">
						<span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-700">
							<UserRound className="h-5 w-5" />
						</span>
						<div>
							<p className="font-semibold text-slate-800">{user?.name || "Toko"}</p>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">TOKO</p>
						</div>
					</div>
					<div>
						<p className="text-lg font-semibold text-slate-800">Contact Us</p>
						<p className="mt-2 text-sm text-slate-600">+62 752 186 174</p>
						<p className="text-sm text-slate-600">lisajocktan@gmail.com</p>
					</div>
					<div className="md:text-right">
						<p className="text-lg font-semibold text-slate-800">Account</p>
						<button
							type="button"
							onClick={handleLogout}
							className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
						>
							Keluar
						</button>
					</div>
				</div>
			</footer>
		</div>
	);
}
