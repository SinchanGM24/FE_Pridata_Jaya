"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";

interface TokoStorefrontShellProps {
	title: string;
	children: ReactNode;
	cartCount?: number;
	basePath?: string;
	profileName?: string;
	profileRoleLabel?: string;
	salesName?: string | null;
}

const initials = (value?: string | null) => {
	const words = String(value || "Toko").trim().split(/\s+/).filter(Boolean);
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0]?.[0] ?? "T"}${words[1]?.[0] ?? "K"}`.toUpperCase();
};

export default function TokoStorefrontShell({
	title,
	children,
	basePath = "/toko",
	profileName,
	profileRoleLabel,
	salesName,
}: TokoStorefrontShellProps) {
	const { user } = useAuth();
	const actingStore = useMemo(
		() => (basePath.startsWith("/sales/toko-kelolaan/") ? getSalesActingStoreProfile() : null),
		[basePath],
	);
	const isSalesStoreMode = Boolean(actingStore?.storeId) || basePath.startsWith("/sales/toko-kelolaan/");

	const resolvedProfileName = profileName || actingStore?.storeName || user?.name || "Toko";
	const resolvedRoleLabel = profileRoleLabel || (isSalesStoreMode ? "Sales Mode Toko" : "Toko");
	const resolvedSalesName = salesName || actingStore?.salesName || null;

	const handleLogout = async () => {
		await authService.logout();
		window.location.href = "/login";
	};

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
				<div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6">
					{isSalesStoreMode ? (
						<div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
							<span>Sedang sebagai toko:</span>
							<span className="text-sky-900">{resolvedProfileName}</span>
						</div>
					) : null}
					<div className="flex items-center justify-between gap-3">
						<Link href={`${basePath}${isSalesStoreMode ? "/katalog" : "/dashboard"}`} className="text-3xl font-extrabold tracking-tight text-sky-500">
							Online-Shop
						</Link>
						<div className="flex items-center gap-2">
							<Link
								href={`${basePath}/katalog`}
								className="hidden rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:inline-flex"
							>
								Buka Katalog
							</Link>
							<Link
								href={`${basePath}/purchase-order`}
								className="rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600"
							>
								Keranjang
							</Link>
							<Link
								href={`${basePath}/profile`}
								className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sm font-bold text-sky-700"
								aria-label="Profil toko"
							>
								{initials(resolvedProfileName)}
							</Link>
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
				<h1 className="text-2xl font-bold text-slate-900">{title}</h1>
				{children}
			</main>

			<footer className="mt-8 border-t border-sky-100 bg-sky-50">
				<div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-3 md:px-6">
					<div className="flex items-center gap-3">
						<span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-200 bg-white text-sm font-bold text-sky-700">
							{initials(resolvedProfileName)}
						</span>
						<div>
							<p className="font-semibold text-slate-800">{resolvedProfileName}</p>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								{resolvedRoleLabel}
							</p>
							{resolvedSalesName ? (
								<p className="text-xs text-slate-500">Sales: {resolvedSalesName}</p>
							) : null}
						</div>
					</div>
					<div>
						<p className="text-lg font-semibold text-slate-800">Contact Us</p>
						<p className="mt-2 text-sm text-slate-600">+62 752 186 174</p>
						<p className="text-sm text-slate-600">lisajocktan@gmail.com</p>
					</div>
					<div className="md:text-right">
						<p className="text-lg font-semibold text-slate-800">Account</p>
						<div className="mt-2 flex flex-wrap justify-end gap-2">
							{isSalesStoreMode ? (
								<Link
									href="/sales/toko-kelolaan"
									className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								>
									Keluar Mode Toko
								</Link>
							) : null}
							<button
								type="button"
								onClick={handleLogout}
								className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								<LogOut className="h-4 w-4" />
								Keluar
							</button>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
