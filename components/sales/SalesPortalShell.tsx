"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";

interface SalesPortalShellProps {
	title: string;
	profileName?: string;
	children: ReactNode;
}

const navItems = [
	{ label: "Dasbor", href: "/sales/dashboard" },
	{ label: "Toko Kelolaan", href: "/sales/toko-kelolaan" },
	{ label: "Grade Toko", href: "/sales/grade-toko" },
	{ label: "Aging Piutang", href: "/sales/aging-piutang" },
	{ label: "Konfirmasi Pembayaran", href: "/sales/konfirmasi-pembayaran" },
	{ label: "Riwayat", href: "/sales/riwayat-transaksi" },
	{ label: "Profil", href: "/sales/profile" },
];

const initials = (value?: string | null) => {
	const words = String(value || "Sales").trim().split(/\s+/).filter(Boolean);
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0]?.[0] ?? "S"}${words[1]?.[0] ?? "A"}`.toUpperCase();
};

export default function SalesPortalShell({ title, profileName, children }: SalesPortalShellProps) {
	const pathname = usePathname();
	const { user } = useAuth();
	const resolvedProfileName = profileName?.trim() || user?.name || "Sales";

	const handleLogout = async () => {
		await authService.logout();
		window.location.href = "/login";
	};

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
				<header className="overflow-hidden rounded-lg border border-sky-100 bg-sky-600 p-5 text-white shadow-sm">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
								Portal Sales
							</p>
							<h1 className="mt-1 text-2xl font-bold lg:text-3xl">{title}</h1>
							<p className="mt-2 text-sm text-sky-100">
								Kelola toko naungan, purchase order, grade, dan follow-up piutang.
							</p>
						</div>
						<div className="flex items-center gap-3 rounded-lg bg-white/15 px-4 py-3 backdrop-blur">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 text-sm font-bold">
								{initials(resolvedProfileName)}
							</div>
							<div className="min-w-0">
								<p className="truncate font-semibold">{resolvedProfileName}</p>
								<p className="text-xs font-semibold uppercase text-sky-100">SALES</p>
							</div>
						</div>
					</div>
				</header>

				<nav className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
					{navItems.map((item) => {
						const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
									active ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100"
								}`}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>

				{children}

				<footer className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
					<p className="inline-flex items-center gap-2">
						<UserRound className="h-4 w-4" />
						Portal eksternal sales tanpa sidebar dashboard internal.
					</p>
					<button
						type="button"
						onClick={handleLogout}
						className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
					>
						<LogOut className="h-4 w-4" />
						Keluar
					</button>
				</footer>
			</main>
		</div>
	);
}
