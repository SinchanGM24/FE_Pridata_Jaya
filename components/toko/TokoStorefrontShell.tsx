"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
	Award,
	ChevronLeft,
	FileText,
	History,
	Home,
	LogOut,
	MoreHorizontal,
	ReceiptText,
	ShoppingBag,
	ShoppingCart,
	Undo2,
	UserRound,
	Wallet,
} from "lucide-react";
import BottomTabBar, { type TabItem } from "@/components/shared/BottomTabBar";
import { BrandIdentity } from "@/components/layout/BrandIdentity";
import Modal from "@/components/shared/Modal";
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
	cartCount = 0,
	basePath = "/toko",
	profileName,
	profileRoleLabel,
	salesName,
	showAccountFooter = false,
}: TokoStorefrontShellProps) {
	const { user } = useAuth();
	const [actingStore, setActingStore] = useState<ReturnType<typeof getSalesActingStoreProfile>>(null);
	const [moreOpen, setMoreOpen] = useState(false);
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

	// Empat tujuan tersering di zona jempol; sisanya di sheet "Lainnya".
	const tabs = useMemo<TabItem[]>(
		() => [
			{
				label: "Beranda",
				href: isSalesStoreMode ? basePath : `${basePath}/dashboard`,
				icon: Home,
				matchPrefix: !isSalesStoreMode,
			},
			{ label: "Katalog", href: `${basePath}/katalog`, icon: ShoppingBag },
			{
				label: "Keranjang",
				href: `${basePath}/purchase-order`,
				icon: ShoppingCart,
				badge: cartCount,
			},
			{ label: "Tagihan", href: `${basePath}/hutang-toko`, icon: ReceiptText },
		],
		[basePath, cartCount, isSalesStoreMode],
	);

	const moreLinks = useMemo(() => {
		const shared = [
			{ label: "Riwayat Transaksi", href: `${basePath}/riwayat-transaksi`, icon: History },
			{ label: "Grade Toko", href: `${basePath}/grade-saya`, icon: Award },
			{ label: "Pengajuan Retur", href: `${basePath}/retur`, icon: Undo2 },
		];
		if (isSalesStoreMode) {
			return [...shared, { label: "Profil Toko", href: `${basePath}/profile`, icon: UserRound }];
		}
		return [
			...shared,
			{ label: "Kredit Toko", href: `${basePath}/store-credits`, icon: Wallet },
			{ label: "Pengajuan Pembayaran", href: `${basePath}/payment-requests`, icon: FileText },
			{ label: "Profil Toko", href: `${basePath}/profile`, icon: UserRound },
		];
	}, [basePath, isSalesStoreMode]);

	return (
		<div className="min-h-dvh bg-slate-50 text-slate-900">
			{/*
			 * Dengan header lengket, nav, dan kartu filter sebelum konten, pengguna
			 * papan ketik menekan Tab belasan kali untuk sampai ke tabel.
			 */}
			<a
				href="#konten-utama"
				className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:text-sm focus:font-semibold focus:text-white"
			>
				Lewati ke konten
			</a>
			<header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-6 md:py-3">
					<Link
						href={isSalesStoreMode ? `${basePath}/katalog` : `${basePath}/dashboard`}
						className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
						aria-label="Beranda portal toko Pridata Jaya"
					>
						<BrandIdentity variant="compact" />
					</Link>
					<div className="flex items-center gap-2">
						<Link
							href={`${basePath}/katalog`}
							className="hidden min-h-10 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex"
						>
							Buka Katalog
						</Link>
						<Link
							href={`${basePath}/purchase-order`}
							aria-label={`Keranjang${cartCount > 0 ? `, ${cartCount} item` : ", kosong"}`}
							className="relative hidden min-h-10 items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3 text-sm font-semibold text-accent-700 transition hover:bg-accent-100 md:inline-flex"
						>
							<ShoppingCart className="h-4 w-4" />
							Keranjang
							{cartCount > 0 ? (
								<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-[11px] font-bold text-white">
									{cartCount > 99 ? "99+" : cartCount}
								</span>
							) : null}
						</Link>
						<Link
							href={`${basePath}/profile`}
							className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-brand-200 bg-brand-50 text-sm font-bold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
							aria-label="Profil toko"
						>
							{resolvedProfileImage ? (
								<Image
									src={resolvedProfileImage}
									alt=""
									width={44}
									height={44}
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
								className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex"
							>
								<LogOut className="h-4 w-4" />
								Kembali
							</Link>
						) : null}
					</div>
				</div>

				{/* Konteks "sedang sebagai toko" tidak boleh tergulir hilang. */}
				{isSalesStoreMode ? (
					<div className="border-t border-brand-100 bg-brand-50 px-4 py-1.5 md:px-6">
						<div className="mx-auto flex max-w-7xl items-center gap-2 text-xs font-semibold text-brand-800">
							<span className="text-brand-600">Sedang sebagai toko:</span>
							<span className="truncate">{resolvedProfileName}</span>
						</div>
					</div>
				) : null}
			</header>

			<main
				id="konten-utama"
				tabIndex={-1}
				className="mx-auto max-w-7xl space-y-4 px-4 pt-5 pb-tabbar-gap outline-none md:px-6 md:pb-8 md:pt-6"
			>
				<h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
				{children}
			</main>

			{/* Footer besar memakan satu layar penuh di HP — isinya pindah ke sheet Lainnya. */}
			<footer className="mt-8 hidden border-t border-brand-100 bg-brand-50 md:block">
				<div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1.2fr_1fr_1.2fr] md:items-center md:px-6">
					<div className="flex items-center gap-4">
						<span className="inline-flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-100 bg-white text-2xl font-bold text-brand-700">
							{resolvedProfileImage ? (
								<Image
									src={resolvedProfileImage}
									alt=""
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
							<p className="type-label text-brand-700">
								{resolvedRoleLabel}
							</p>
							<p className="type-title mt-1 text-slate-800">{resolvedProfileName}</p>
							{resolvedSalesName ? (
								<p className="text-sm text-slate-600">Sales: {resolvedSalesName}</p>
							) : null}
						</div>
					</div>
					<div className="md:text-center">
						<p className="type-title text-slate-800">Hubungi Kami</p>
						<p className="type-body mt-2 text-slate-600">+62 752 186 174</p>
						<p className="type-body text-slate-600">lisajocktan@gmail.com</p>
					</div>
					{showCompanyFooter ? (
						<div className="flex items-center justify-start gap-4 md:justify-end">
							<div className="md:text-right">
								<p className="type-label text-brand-700">
									Didukung oleh
								</p>
								<p className="type-title mt-1 text-slate-800">CV. Pridata Jaya</p>
								<p className="type-body text-slate-600">Sistem Manajemen Distribusi</p>
							</div>
							<div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-brand-100">
								<Image
									src="/pridata-logo.png"
									alt="Logo Pridata Jaya"
									width={96}
									height={96}
									className="h-full w-full scale-125 object-contain"
									// Footer desktop, di bawah lipatan: tidak ada alasan eager.
									loading="lazy"
								/>
							</div>
						</div>
					) : (
						<div className="md:text-right">
							<p className="type-title text-slate-800">Akun</p>
							<div className="mt-2 flex flex-wrap gap-2 md:justify-end">
								<button
									type="button"
									onClick={handleLogout}
									className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
								>
									<LogOut className="h-4 w-4" />
									Keluar
								</button>
							</div>
						</div>
					)}
				</div>
			</footer>

			<BottomTabBar
				items={tabs}
				moreIcon={MoreHorizontal}
				moreActive={moreOpen}
				onMoreClick={() => setMoreOpen(true)}
			/>

			<Modal isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="Menu Toko">
				<nav>
					<ul className="space-y-1">
						{moreLinks.map((link) => {
							const Icon = link.icon;
							return (
								<li key={link.href}>
									<Link
										href={link.href}
										onClick={() => setMoreOpen(false)}
										className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
									>
										<Icon className="h-5 w-5 text-slate-400" />
										{link.label}
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>
				<div className="mt-4 border-t border-slate-200 pt-4">
					{isSalesStoreMode ? (
						<Link
							href="/sales/toko-kelolaan"
							onClick={() => setMoreOpen(false)}
							className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
						>
							<ChevronLeft className="h-5 w-5" />
							Kembali ke Portal Sales
						</Link>
					) : (
						<button
							type="button"
							onClick={handleLogout}
							className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
						>
							<LogOut className="h-5 w-5" />
							Keluar
						</button>
					)}
				</div>
				<p className="mt-4 px-3 text-xs text-slate-500">
					{resolvedRoleLabel} · {resolvedProfileName}
					{resolvedSalesName ? ` · Sales: ${resolvedSalesName}` : ""}
				</p>
			</Modal>
		</div>
	);
}
