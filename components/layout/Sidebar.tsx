"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authService } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { getRoleUi } from "@/constants";
import { resolveDashboardRole } from "@/lib/auth";
import type { DashboardRole } from "@/types";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
	hideNavigation?: boolean;
}

interface MenuItem {
	label: string;
	href: string;
	roles: DashboardRole[];
}

const menuItems: MenuItem[] = [
	{
		label: "Pesanan Masuk",
		href: "/fakturis/pesanan-masuk",
		roles: ["fakturis"],
	},
	{
		label: "Verifikasi Pelanggan",
		href: "/fakturis/verifikasi-pelanggan",
		roles: ["fakturis"],
	},
	{
		label: "Riwayat Transaksi",
		href: "/fakturis/riwayat-transaksi",
		roles: ["fakturis"],
	},
	{ label: "Grade Toko", href: "/grade-toko", roles: ["fakturis"] },

	{ label: "Stok Barang", href: "/gudang/stok-barang", roles: ["gudang"] },
	{
		label: "Penerimaan Barang",
		href: "/gudang/penerimaan-barang",
		roles: ["gudang"],
	},
	{ label: "Pengiriman", href: "/gudang/pengiriman", roles: ["gudang"] },
	{
		label: "Transfer Gudang",
		href: "/gudang/transfer-gudang",
		roles: ["gudang"],
	},
	{ label: "Retur Barang", href: "/gudang/retur-barang", roles: ["gudang"] },
	{ label: "Barang Rusak", href: "/gudang/barang-rusak", roles: ["gudang"] },
	{ label: "Grade Toko", href: "/grade-toko", roles: ["gudang"] },

	{
		label: "Dashboard Akuntan",
		href: "/akuntan/dashboard-penjualan",
		roles: ["akuntan"],
	},
	{
		label: "Invoice Pembayaran",
		href: "/akuntan/invoice-pembayaran",
		roles: ["akuntan"],
	},
	{
		label: "Aging Piutang",
		href: "/akuntan/aging-piutang",
		roles: ["akuntan"],
	},
	{ label: "Grade Toko", href: "/grade-toko", roles: ["akuntan"] },
	{ label: "Log Ekspor", href: "/dashboard/export-logs", roles: ["akuntan"] },

	{
		label: "Dashboard Owner",
		href: "/owner/dashboard-owner",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Kelola User",
		href: "/owner/kelola-user",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Members",
		href: "/owner/members",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Roles",
		href: "/owner/roles",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Kelola Katalog",
		href: "/owner/kelola-katalog",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Master Data",
		href: "/owner/master-data",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Kelola Toko",
		href: "/owner/kelola-toko",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Grade Toko",
		href: "/grade-toko",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Log Ekspor",
		href: "/dashboard/export-logs",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Reports",
		href: "/akuntan/reports",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Monthly Reports",
		href: "/akuntan/monthly-reports",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Export Logs",
		href: "/dashboard/export-logs",
		roles: ["admin", "owner", "superowner"],
	},

	{ label: "Dashboard Toko", href: "/toko/dashboard", roles: ["toko"] },
	{ label: "Home Katalog", href: "/toko/katalog", roles: ["toko"] },
	{
		label: "Keranjang (Invoice Sementara)",
		href: "/toko/purchase-order",
		roles: ["toko"],
	},
	{
		label: "Riwayat Transaksi",
		href: "/toko/riwayat-transaksi",
		roles: ["toko"],
	},
	{ label: "Tagihan Toko", href: "/toko/hutang-toko", roles: ["toko"] },
	{
		label: "Pembayaran Online",
		href: "/toko/pembayaran-online",
		roles: ["toko"],
	},
	{ label: "Payment Request", href: "/toko/payment-requests", roles: ["toko"] },
	{ label: "Store Credits", href: "/toko/store-credits", roles: ["toko"] },
	{ label: "Retur Toko", href: "/toko/retur", roles: ["toko"] },

	{ label: "Dasbor Sales", href: "/sales/dashboard", roles: ["sales"] },
	{ label: "Toko Kelolaan", href: "/sales/toko-kelolaan", roles: ["sales"] },
	{
		label: "Riwayat Transaksi",
		href: "/sales/riwayat-transaksi",
		roles: ["sales"],
	},
	{ label: "Aging Piutang", href: "/sales/aging-piutang", roles: ["sales"] },
	{
		label: "Log Ekspor",
		href: "/dashboard/export-logs",
		roles: ["sales", "fakturis"],
	},

	{
		label: "Profil",
		href: "/profile",
		roles: [
			"admin",
			"owner",
			"superowner",
			"fakturis",
			"gudang",
			"akuntan",
			"toko",
			"sales",
		],
	},
	{
		label: "Notifikasi",
		href: "/notifications",
		roles: [
			"admin",
			"owner",
			"superowner",
			"fakturis",
			"gudang",
			"akuntan",
			"toko",
			"sales",
		],
	},
];

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

export function Sidebar({
	isOpen,
	onClose,
	hideNavigation = false,
}: SidebarProps) {
	const pathname = usePathname();
	const { user } = useAuth();

	const dashboardRole = resolveDashboardRole(user);
	const roleUi = getRoleUi(dashboardRole, user?.name);
	const visibleItems = dashboardRole
		? menuItems
				.filter((item) => item.roles.includes(dashboardRole))
				.filter(
					(item, index, source) =>
						source.findIndex(
							(candidate) =>
								candidate.href === item.href && candidate.label === item.label,
						) === index,
				)
		: [];

	const currentPath = normalizePath(pathname);

	const source = user?.name?.trim() || roleUi.fullName;
	const words = source.split(/\s+/).filter(Boolean);
	const initials = !words.length
		? "US"
		: words.length === 1
			? words[0].slice(0, 2).toUpperCase()
			: `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();

	const handleLogout = async () => {
		await authService.logout();
		window.location.href = "/login";
	};

	return (
		<>
			{isOpen ? (
				<button
					type="button"
					onClick={onClose}
					className="fixed inset-0 z-20 bg-slate-950/20 backdrop-blur-[1px] md:hidden"
					aria-label="Tutup sidebar"
				/>
			) : null}

			<aside
				className={`fixed inset-y-0 left-0 z-30 flex h-screen overflow-hidden border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(253,254,255,0.98),rgba(247,249,252,0.96))] text-slate-800 backdrop-blur-xl transition-all duration-300 md:sticky md:top-0 md:shrink-0 ${
					isOpen
						? "pointer-events-auto w-80 translate-x-0 md:w-80"
						: "pointer-events-none w-80 -translate-x-full md:w-0 md:-translate-x-full"
				}`}
			>
				<div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-slate-200/80" />
				<div className="flex h-full w-full min-h-0 flex-col">
					<div className="border-b border-slate-200/80 px-4 py-5">
						<div className="rounded-[28px] border border-white/90 bg-white/78 px-4 py-4">
							<div className="flex items-center gap-4">
								<div className="flex h-[6.5rem] w-[6.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[28px] bg-white p-1.5">
									<Image
										src="/pridata-logo.png"
										alt="Logo Pridata Jaya"
										width={104}
										height={104}
										loading="eager"
										className="h-full w-full object-contain"
									/>
								</div>
								<div className="min-w-0 flex-1">
									<p className="whitespace-nowrap text-[11px] font-medium leading-none text-slate-700">
										Sistem Manajemen Distribusi
									</p>
									<p className="mt-1.5 whitespace-nowrap text-[16px] font-semibold leading-none tracking-[0.01em] text-slate-950">
										CV. Pridata Jaya
									</p>
									<p className="mt-1.5 whitespace-nowrap text-[12px] leading-none text-slate-600">
										{roleUi.sidebarSubtitle}
									</p>
								</div>
							</div>
						</div>
					</div>

					{hideNavigation ? (
						<div className="flex-1" />
					) : (
						<nav className="flex-1 overflow-y-auto px-4 py-5">
							<div className="mb-3 px-2">
								<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
									Navigasi
								</p>
							</div>
							<div className="space-y-1.5">
								{visibleItems.map((item) => {
									const href = normalizePath(item.href);
									const isActive =
										currentPath === href ||
										(href !== "/" && currentPath.startsWith(`${href}/`));

									return (
										<Link
											key={item.href}
											href={item.href}
											onClick={() => {
												if (window.innerWidth < 768) {
													onClose();
												}
											}}
											className={`group relative block overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
												isActive
													? "bg-white text-slate-950 ring-1 ring-slate-200/80"
													: "text-slate-600 hover:bg-white/80 hover:text-slate-900"
											}`}
										>
											<span
												className={`absolute inset-y-2 left-2 w-1 rounded-full transition-all ${
													isActive
														? roleUi.accentSolidClass
														: "bg-transparent group-hover:bg-slate-300"
												}`}
											/>
											<span className="relative block pl-3">{item.label}</span>
										</Link>
									);
								})}
							</div>
						</nav>
					)}

					<div className="border-t border-slate-200/80 px-4 py-4">
						<div className="rounded-[24px] border border-white/90 bg-white/88 p-3">
							<div className="flex items-center gap-3">
								{user?.image ? (
									<Image
										src={user.image}
										alt={`Foto profil ${user?.name || roleUi.fullName}`}
										width={44}
										height={44}
										unoptimized
										className="h-11 w-11 rounded-2xl border border-slate-200 object-cover"
									/>
								) : (
									<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
										{initials}
									</div>
								)}
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-slate-900">
										{user?.name || roleUi.fullName}
									</p>
									<p
										className={`mt-0.5 text-[11px] uppercase tracking-[0.18em] ${roleUi.accentTextClass}`}
									>
										{roleUi.roleLabel}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={handleLogout}
								className="mt-4 w-full rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
							>
								Keluar
							</button>
						</div>
					</div>
				</div>
			</aside>
		</>
	);
}
