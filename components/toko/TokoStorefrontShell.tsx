"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Home, LogOut, Menu, ReceiptText, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { getSalesActingStoreProfile, setSalesActingStoreProfile } from "@/services/sales-toko-cart";
import { meService, type MyProfile } from "@/services/me";

interface TokoStorefrontShellProps {
	title: string;
	hideTitle?: boolean;
	children: ReactNode;
	cartCount?: number;
	basePath?: string;
	profileName?: string;
	profileRoleLabel?: string;
	salesName?: string | null;
	showAccountFooter?: boolean;
	catalogSearch?: {
		value: string;
		onChange: (value: string) => void;
		placeholder?: string;
	};
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
	hideTitle = false,
	children,
	cartCount = 0,
	basePath = "/toko",
	profileName,
	profileRoleLabel,
	salesName,
	showAccountFooter = false,
	catalogSearch,
}: TokoStorefrontShellProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { user } = useAuth();
	const [menuOpen, setMenuOpen] = useState(false);
	const [headerSearch, setHeaderSearch] = useState("");
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
	const activeCatalogSearch = catalogSearch?.value ?? headerSearch;
	const setActiveCatalogSearch = catalogSearch?.onChange ?? setHeaderSearch;

	useEffect(() => {
		if (isSalesStoreMode || catalogSearch) return;
		const keyword = headerSearch.trim();
		if (!keyword) return;
		const timeoutId = window.setTimeout(() => {
			router.push(`${basePath}/katalog?q=${encodeURIComponent(keyword)}`);
		}, 300);
		return () => window.clearTimeout(timeoutId);
	}, [basePath, catalogSearch, headerSearch, isSalesStoreMode, router]);
	const mobileNavItems = [
		{ label: "Beranda", href: isSalesStoreMode ? basePath : `${basePath}/dashboard`, icon: Home },
		{ label: "Katalog", href: `${basePath}/katalog`, icon: ShoppingBag },
		{ label: "Pesanan", href: `${basePath}/purchase-order`, icon: ReceiptText },
		{ label: "Akun", href: `${basePath}/profile`, icon: UserRound },
	];
	const accountNavItems = [
		{ label: "Profil", href: `${basePath}/profile` },
		{ label: "Riwayat Transaksi", href: `${basePath}/riwayat-transaksi` },
		{ label: "Grade Toko", href: `${basePath}/grade-saya` },
		{ label: "Tagihan & Pembayaran", href: `${basePath}/hutang-toko` },
		{ label: "Retur", href: `${basePath}/retur` },
	];

	const handleLogout = async () => {
		await authService.logout();
		window.location.href = "/login";
	};
	const exitSalesStoreMode = () => {
		setSalesActingStoreProfile(null);
		setMenuOpen(false);
		router.push("/sales/toko-kelolaan");
	};

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
				<div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-4 md:px-6 md:py-3">
					{isSalesStoreMode ? (
						<div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
							<span>Sedang sebagai toko:</span>
							<span className="text-sky-900">{resolvedProfileName}</span>
						</div>
					) : null}
					<div className="flex items-center justify-between gap-3 lg:gap-6">
						<Link
							href={`${basePath}${isSalesStoreMode ? "/katalog" : "/dashboard"}`}
							className="group flex min-w-0 items-center gap-2 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:gap-3 lg:shrink-0"
							aria-label="Pridata Store"
						>
							<span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-100 bg-sky-50 shadow-sm transition group-hover:border-sky-200 group-hover:bg-white sm:h-11 sm:w-11">
								<Image src="/pridata-logo.png" alt="" width={44} height={44} unoptimized className="h-full w-full scale-125 object-contain" />
							</span>
							<span className="min-w-0 leading-tight">
								<span className="block truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Pridata <span className="text-sky-600">Store</span></span>
								<span className="hidden text-[11px] font-medium text-slate-500 sm:block">Belanja kebutuhan toko</span>
							</span>
						</Link>
						<div className="flex items-center gap-2 lg:min-w-0 lg:flex-1 lg:justify-end">
							<button type="button" onClick={() => setMenuOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden" aria-label="Buka menu akun toko"><Menu className="h-5 w-5" /></button>
							{(!isSalesStoreMode || catalogSearch) ? (
								<div className="hidden min-w-0 items-center gap-2 lg:flex lg:flex-1 lg:justify-end">
									<label className="relative min-w-0 lg:flex-1 lg:max-w-4xl">
										<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
										<input
											value={activeCatalogSearch}
											onChange={(event) => setActiveCatalogSearch(event.target.value)}
											placeholder="Cari produk"
											aria-label="Cari produk katalog"
											className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
										/>
									</label>
									<Link
										href={`${basePath}/purchase-order`}
										className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
									>
										<ShoppingBag className="h-4 w-4" />
										Keranjang
										{cartCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 py-0.5 text-[11px] font-bold text-white">{cartCount}</span> : null}
									</Link>
									<Link
										href={`${basePath}/profile`}
										className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
									>
										<UserRound className="h-4 w-4" />
										Profil
									</Link>
								</div>
							) : null}
							{isSalesStoreMode && !catalogSearch ? (
								<>
									<div className="hidden items-center gap-2 lg:flex">
										<Link href={`${basePath}/purchase-order`} className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><ShoppingBag className="h-4 w-4" />Keranjang{cartCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 py-0.5 text-[11px] font-bold text-white">{cartCount}</span> : null}</Link>
										<Link href={`${basePath}/profile`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><UserRound className="h-4 w-4" />Profil</Link>
									</div>
									<Link href="/sales/toko-kelolaan" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Kembali</span></Link>
								</>
							) : null}
						</div>
					</div>
					{catalogSearch ? (
						<div className="md:hidden">
							<input
								value={catalogSearch.value}
								onChange={(event) => catalogSearch.onChange(event.target.value)}
								placeholder={catalogSearch.placeholder ?? "Cari produk"}
								aria-label="Cari katalog"
								className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
							/>
						</div>
					) : null}
				</div>
			</header>

			{menuOpen ? <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu akun toko"><button type="button" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-slate-950/35" /><aside className="absolute bottom-0 right-0 top-0 flex w-[min(19rem,85vw)] flex-col bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Menu Akun</p><p className="mt-1 font-semibold text-slate-900">{resolvedProfileName}</p></div><button type="button" onClick={() => setMenuOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700"><X className="h-5 w-5" /></button></div><nav className="flex-1 space-y-1 p-3">{accountNavItems.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`block rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>{item.label}</Link>; })}</nav><div className="border-t border-slate-200 p-3"><button type="button" onClick={isSalesStoreMode ? exitSalesStoreMode : () => void handleLogout()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" />{isSalesStoreMode ? "Kembali ke Portal Sales" : "Keluar"}</button></div></aside></div> : null}

			<main className="mx-auto max-w-7xl space-y-4 px-3 py-4 pb-24 sm:px-4 sm:py-5 md:px-6 md:py-6">
				{hideTitle ? null : <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>}
				{children}
			</main>

			<footer className="mt-8 hidden border-t border-sky-100 bg-sky-50 md:block">
				<div className="mx-auto grid max-w-7xl gap-5 px-3 py-5 sm:px-4 md:grid-cols-[1.2fr_1fr_1.2fr] md:items-center md:px-6 md:py-8">
					<div className="flex items-center gap-3 sm:gap-4">
						<span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-100 bg-white text-lg font-bold text-sky-700 shadow-sm sm:h-24 sm:w-24 sm:rounded-2xl sm:text-2xl">
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
							<div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-sky-100 sm:h-24 sm:w-24 sm:rounded-2xl">
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

			<nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden" aria-label="Navigasi utama toko">
				<div className="mx-auto grid max-w-md grid-cols-4 gap-1">
					{mobileNavItems.map((item) => {
						const active = pathname === item.href || (item.label === "Beranda" && pathname === `${basePath}/`);
						const Icon = item.icon;
						return <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${active ? "bg-sky-50 text-sky-700" : "text-slate-500"}`}><Icon className="h-4 w-4" />{item.label}</Link>;
					})}
				</div>
			</nav>
		</div>
	);
}
