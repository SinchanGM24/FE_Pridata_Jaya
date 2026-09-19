"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
	Award,
	BadgeCheck,
	History,
	LayoutDashboard,
	LogOut,
	MoreHorizontal,
	Store,
	TrendingDown,
	UserRound,
} from "lucide-react";
import BottomTabBar, { type TabItem } from "@/components/shared/BottomTabBar";
import Modal from "@/components/shared/Modal";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { meService, type MyProfile } from "@/services/me";

interface SalesPortalShellProps {
	title: string;
	profileName?: string;
	children: ReactNode;
}

const tabs: TabItem[] = [
	{ label: "Dashboard", href: "/sales/dashboard", icon: LayoutDashboard },
	{ label: "Toko", href: "/sales/toko-kelolaan", icon: Store },
	{ label: "Piutang", href: "/sales/aging-piutang", icon: TrendingDown },
	{ label: "Konfirmasi", href: "/sales/konfirmasi-pembayaran", icon: BadgeCheck },
];

const moreLinks = [
	{ label: "Grade Toko", href: "/sales/grade-toko", icon: Award },
	{ label: "Riwayat Transaksi", href: "/sales/riwayat-transaksi", icon: History },
	{ label: "Profil Sales", href: "/sales/profile", icon: UserRound },
];

const initials = (value?: string | null) => {
	const words = String(value || "Sales").trim().split(/\s+/).filter(Boolean);
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0]?.[0] ?? "S"}${words[1]?.[0] ?? "A"}`.toUpperCase();
};

const SALES_PROFILE_UPDATED_EVENT = "sales-profile-updated";

const resolveProfileSnapshot = (profile: MyProfile | null) => ({
	name: profile?.name || "",
	image: profile?.image || null,
});

export default function SalesPortalShell({ title, profileName, children }: SalesPortalShellProps) {
	const pathname = usePathname();
	const { user } = useAuth();
	const [moreOpen, setMoreOpen] = useState(false);
	const [profileSnapshot, setProfileSnapshot] = useState<ReturnType<typeof resolveProfileSnapshot>>({
		name: "",
		image: null,
	});

	useEffect(() => {
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
					});
				}
			}
		};

		const handleProfileUpdated = (event: Event) => {
			const detail = (event as CustomEvent<MyProfile>).detail;
			setProfileSnapshot(resolveProfileSnapshot(detail));
		};

		void loadProfile();
		window.addEventListener(SALES_PROFILE_UPDATED_EVENT, handleProfileUpdated);
		return () => {
			cancelled = true;
			window.removeEventListener(SALES_PROFILE_UPDATED_EVENT, handleProfileUpdated);
		};
	}, [user?.image, user?.name]);

	const resolvedProfileName = profileName?.trim() || profileSnapshot.name || user?.name || "Sales";
	const resolvedProfileImage = profileSnapshot.image || user?.image || null;

	const handleLogout = async () => {
		await authService.logout();
		window.location.href = "/login";
	};

	const avatar = (size: string) => (
		<span
			className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-bold`}
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
		</span>
	);

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
			<main
				id="konten-utama"
				tabIndex={-1}
				className="mx-auto max-w-7xl space-y-4 px-4 pt-4 pb-tabbar-gap outline-none md:px-6 md:pb-8 md:pt-6"
			>
				{/*
				 * Hero penuh memakan ~40% viewport HP sebelum konten. Di bawah md ia
				 * menyusut jadi satu baris judul + avatar; deskripsi hanya di desktop.
				 */}
				{/*
				 * brand-800: panel penuh berteks putih butuh 4.5:1, dan brand-600 yang
				 * dipakai sebelumnya hanya 3.58:1. Di sini juga 5.27:1 untuk subteks
				 * brand-100. Bayangan dicabut — kartu dibedakan garis dan permukaan.
				 */}
				<header className="overflow-hidden rounded-2xl bg-brand-800 px-4 py-3 text-white md:p-5">
					<div className="flex items-center justify-between gap-3 md:items-start lg:items-center">
						<div className="min-w-0">
							<p className="type-label text-brand-100 md:text-xs">
								Portal Sales
							</p>
							<h1 className="mt-0.5 truncate text-lg font-bold md:mt-1 md:text-2xl lg:text-3xl">
								{title}
							</h1>
							<p className="mt-2 hidden text-sm text-brand-100 md:block">
								Kelola toko naungan, purchase order, grade, dan follow-up piutang.
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/15 p-1.5 backdrop-blur md:px-4 md:py-3">
							{avatar("h-9 w-9 md:h-10 md:w-10")}
							<div className="hidden min-w-0 md:block">
								<p className="truncate font-semibold">{resolvedProfileName}</p>
								<p className="type-label text-brand-100">SALES</p>
							</div>
						</div>
					</div>
				</header>

				{/*
				 * Desktop dulu memuat tujuh tujuan dalam satu strip yang meluber —
				 * sampai butuh scrollIntoView untuk menemukan item aktifnya. Itu
				 * desain yang memberi tahu dirinya sendiri kelebaran. Sekarang IA-nya
				 * sama dengan HP: empat tujuan kerja, sisanya di sheet "Lainnya".
				 */}
				<nav
					aria-label="Navigasi portal sales"
					className="hidden gap-2 rounded-2xl border border-slate-200 bg-white p-2 md:flex"
				>
					{tabs.map((item) => {
						const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
						const Icon = item.icon;
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${
									active ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
								}`}
							>
								<Icon className="h-4 w-4" />
								{item.label}
							</Link>
						);
					})}
					<button
						type="button"
						onClick={() => setMoreOpen(true)}
						aria-expanded={moreOpen}
						className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
					>
						<MoreHorizontal className="h-4 w-4" />
						Lainnya
					</button>
				</nav>

				{children}

				<footer className="hidden items-center justify-end rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex">
					<button
						type="button"
						onClick={handleLogout}
						className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						<LogOut className="h-4 w-4" />
						Keluar
					</button>
				</footer>
			</main>

			<BottomTabBar
				items={tabs}
				moreIcon={MoreHorizontal}
				moreActive={moreOpen}
				onMoreClick={() => setMoreOpen(true)}
			/>

			<Modal isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="Menu Sales">
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
					<button
						type="button"
						onClick={handleLogout}
						className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
					>
						<LogOut className="h-5 w-5" />
						Keluar
					</button>
				</div>
				<p className="mt-4 px-3 text-xs text-slate-500">Sales · {resolvedProfileName}</p>
			</Modal>
		</div>
	);
}
