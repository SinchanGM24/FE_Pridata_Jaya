"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";
import { meService, type MyProfile } from "@/services/me";

interface TokoStorefrontShellProps {
	title: string;
	children: ReactNode;
	cartCount?: number;
	basePath?: string;
	profileName?: string;
	profileRoleLabel?: string;
	salesName?: string | null;
	showAccountFooter?: boolean;
}

const initials = (value?: string | null) => {
	const words = String(value || "Toko").trim().split(/\s+/).filter(Boolean);
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0]?.[0] ?? "T"}${words[1]?.[0] ?? "K"}`.toUpperCase();
};

const TOKO_PROFILE_UPDATED_EVENT = "toko-profile-updated";

const resolveProfileSnapshot = (profile: MyProfile | null) => ({
	name: profile?.store?.name || profile?.name || "",
	image: profile?.image || null,
	salesName: profile?.store?.assignedSalesUser?.name || null,
});

export default function TokoStorefrontShell({
	title,
	children,
	basePath = "/toko",
	profileName,
	profileRoleLabel,
	salesName,
	showAccountFooter = false,
}: TokoStorefrontShellProps) {
	const { user } = useAuth();
	const [actingStore, setActingStore] = useState<ReturnType<typeof getSalesActingStoreProfile>>(null);
	const [profileSnapshot, setProfileSnapshot] = useState<ReturnType<typeof resolveProfileSnapshot>>({
		name: "",
		image: null,
		salesName: null,
	});

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			if (!basePath.startsWith("/sales/toko-kelolaan/")) {
				setActingStore(null);
				return;
			}
			setActingStore(getSalesActingStoreProfile());
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [basePath]);

	useEffect(() => {
		if (basePath.startsWith("/sales/toko-kelolaan/")) return;

		let cancelled = false;
		const loadProfile = async () => {
			try {
				const profile = await meService.getProfile();
				if (!cancelled) setProfileSnapshot(resolveProfileSnapshot(profile));
			} catch {
				if (!cancelled) {
					setProfileSnapshot({
						name: user?.name || "",
						image: user?.image || null,
						salesName: null,
					});
				}
			}
		};

		const handleProfileUpdated = (event: Event) => {
			const detail = (event as CustomEvent<MyProfile>).detail;
			setProfileSnapshot(resolveProfileSnapshot(detail));
		};

		void loadProfile();
		window.addEventListener(TOKO_PROFILE_UPDATED_EVENT, handleProfileUpdated);
		return () => {
			cancelled = true;
			window.removeEventListener(TOKO_PROFILE_UPDATED_EVENT, handleProfileUpdated);
		};
	}, [basePath, user?.image, user?.name]);

	const isSalesStoreMode = Boolean(actingStore?.storeId) || basePath.startsWith("/sales/toko-kelolaan/");

	const resolvedProfileName = profileName || actingStore?.storeName || profileSnapshot.name || user?.name || "Toko";
	const resolvedProfileImage = isSalesStoreMode ? null : profileSnapshot.image || user?.image || null;
	const resolvedRoleLabel = profileRoleLabel || (isSalesStoreMode ? "Sales Mode Toko" : "Toko");
	const resolvedSalesName = salesName || actingStore?.salesName || profileSnapshot.salesName || null;
	const showCompanyFooter = isSalesStoreMode || !showAccountFooter;

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
								className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-sky-200 bg-sky-50 text-sm font-bold text-sky-700"
								aria-label="Profil toko"
							>
								{resolvedProfileImage ? (
									<Image
										src={resolvedProfileImage}
										alt="Profil toko"
										width={40}
										height={40}
										unoptimized
										className="h-full w-full object-cover"
									/>
								) : (
									initials(resolvedProfileName)
								)}
							</Link>
							{isSalesStoreMode ? (
								<Link
									href="/sales/toko-kelolaan"
									className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								>
									<LogOut className="h-4 w-4" />
									Kembali
								</Link>
							) : null}
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
				<h1 className="text-2xl font-bold text-slate-900">{title}</h1>
				{children}
			</main>

			<footer className="mt-8 border-t border-sky-100 bg-sky-50">
				<div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1.2fr_1fr_1.2fr] md:items-center md:px-6">
					<div className="flex items-center gap-4">
						<span className="inline-flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sky-100 bg-white text-2xl font-bold text-sky-700 shadow-sm">
							{resolvedProfileImage ? (
								<Image
									src={resolvedProfileImage}
									alt="Profil toko"
									width={96}
									height={96}
									unoptimized
									className="h-full w-full object-cover"
								/>
							) : (
								initials(resolvedProfileName)
							)}
						</span>
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
								{resolvedRoleLabel}
							</p>
							<p className="mt-1 text-lg font-semibold text-slate-800">{resolvedProfileName}</p>
							{resolvedSalesName ? (
								<p className="text-sm text-slate-600">Sales: {resolvedSalesName}</p>
							) : null}
						</div>
					</div>
					<div className="md:text-center">
						<p className="text-lg font-semibold text-slate-800">Contact Us</p>
						<p className="mt-2 text-sm text-slate-600">+62 752 186 174</p>
						<p className="text-sm text-slate-600">lisajocktan@gmail.com</p>
					</div>
					{showCompanyFooter ? (
						<div className="flex items-center justify-start gap-4 md:justify-end">
							<div className="md:text-right">
								<p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
									Powered by
								</p>
								<p className="mt-1 text-lg font-semibold text-slate-800">CV. Pridata Jaya</p>
								<p className="text-sm text-slate-600">Sistem Manajemen Distribusi</p>
							</div>
							<div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sky-100">
								<Image
									src="/pridata-logo.png"
									alt="Logo Pridata Jaya"
									width={96}
									height={96}
									className="h-full w-full scale-125 object-contain"
									loading="eager"
								/>
							</div>
						</div>
					) : (
						<div className="md:text-right">
							<p className="text-lg font-semibold text-slate-800">Account</p>
							<div className="mt-2 flex flex-wrap justify-end gap-2">
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
					)}
				</div>
			</footer>
		</div>
	);
}
