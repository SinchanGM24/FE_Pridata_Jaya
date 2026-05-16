"use client";

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
	{ label: "Pesanan Masuk", href: "/fakturis/pesanan-masuk", roles: ["fakturis"] },
	{ label: "Verifikasi Pelanggan", href: "/fakturis/verifikasi-pelanggan", roles: ["fakturis"] },
	{ label: "Riwayat Transaksi", href: "/fakturis/riwayat-transaksi", roles: ["fakturis"] },

	{ label: "Stok Barang", href: "/gudang/stok-barang", roles: ["gudang"] },
	{ label: "Penerimaan Barang", href: "/gudang/penerimaan-barang", roles: ["gudang"] },
	{ label: "Pengiriman", href: "/gudang/pengiriman", roles: ["gudang"] },
	{ label: "Transfer Gudang", href: "/gudang/transfer-gudang", roles: ["gudang"] },
	{ label: "Retur Barang", href: "/gudang/retur-barang", roles: ["gudang"] },
	{ label: "Barang Rusak", href: "/gudang/barang-rusak", roles: ["gudang"] },

	{ label: "Dashboard Penjualan", href: "/akuntan/dashboard-penjualan", roles: ["akuntan"] },
	{ label: "Kelola Sales", href: "/akuntan/kelola-sales", roles: ["akuntan"] },
	{ label: "Invoice Pembayaran", href: "/akuntan/invoice-cash", roles: ["akuntan"] },
	{ label: "Review Payment Request", href: "/akuntan/payment-requests", roles: ["akuntan"] },
	{ label: "Aging Piutang", href: "/akuntan/aging-piutang", roles: ["akuntan"] },
	{ label: "Store Credits", href: "/akuntan/store-credits", roles: ["akuntan"] },
	{ label: "Reports", href: "/akuntan/reports", roles: ["akuntan"] },
	{ label: "Monthly Reports", href: "/akuntan/monthly-reports", roles: ["akuntan"] },
	{ label: "Export Logs", href: "/dashboard/export-logs", roles: ["akuntan"] },

	{ label: "Dashboard", href: "/owner/dashboard-owner", roles: ["admin", "owner", "superowner"] },
	{ label: "Kelola User", href: "/owner/kelola-user", roles: ["admin", "owner", "superowner"] },
	{ label: "Members", href: "/owner/members", roles: ["admin", "owner", "superowner"] },
	{ label: "Roles", href: "/owner/roles", roles: ["admin", "owner", "superowner"] },
	{ label: "Kelola Katalog", href: "/owner/kelola-katalog", roles: ["admin", "owner", "superowner"] },
	{ label: "Master Data", href: "/owner/master-data", roles: ["admin", "owner", "superowner"] },
	{ label: "Kelola Toko", href: "/owner/kelola-toko", roles: ["admin", "owner", "superowner"] },
	{ label: "Reports", href: "/akuntan/reports", roles: ["admin", "owner", "superowner"] },
	{ label: "Monthly Reports", href: "/akuntan/monthly-reports", roles: ["admin", "owner", "superowner"] },
	{ label: "Export Logs", href: "/dashboard/export-logs", roles: ["admin", "owner", "superowner"] },

	{ label: "Dashboard Toko", href: "/toko/dashboard", roles: ["toko"] },
	{ label: "Home Katalog", href: "/toko/katalog", roles: ["toko"] },
	{ label: "Keranjang (Invoice Sementara)", href: "/toko/purchase-order", roles: ["toko"] },
	{ label: "Riwayat Transaksi", href: "/toko/riwayat-transaksi", roles: ["toko"] },
	{ label: "Tagihan Toko", href: "/toko/hutang-toko", roles: ["toko"] },
	{ label: "Pembayaran Online", href: "/toko/pembayaran-online", roles: ["toko"] },
	{ label: "Payment Request", href: "/toko/payment-requests", roles: ["toko"] },
	{ label: "Store Credits", href: "/toko/store-credits", roles: ["toko"] },
	{ label: "Retur Toko", href: "/toko/retur", roles: ["toko"] },

	{ label: "Dashboard Sales", href: "/sales/dashboard", roles: ["sales"] },
	{ label: "Toko Kelolaan", href: "/sales/toko-kelolaan", roles: ["sales"] },
	{ label: "Riwayat Transaksi", href: "/sales/riwayat-transaksi", roles: ["sales"] },
	{ label: "Aging Piutang", href: "/sales/aging-piutang", roles: ["sales"] },
	{ label: "Export Logs", href: "/dashboard/export-logs", roles: ["sales", "fakturis", "owner", "superowner"] },

	{ label: "Profil", href: "/profile", roles: ["admin", "owner", "superowner", "fakturis", "gudang", "akuntan", "toko", "sales"] },
	{ label: "Notifikasi", href: "/notifications", roles: ["admin", "owner", "superowner", "fakturis", "gudang", "akuntan", "toko", "sales"] },
];

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

export function Sidebar({ isOpen, onClose, hideNavigation = false }: SidebarProps) {
	const pathname = usePathname();
	const { user } = useAuth();

	const dashboardRole = resolveDashboardRole(user);
	const roleUi = getRoleUi(dashboardRole, user?.name);
	const visibleItems = dashboardRole
		? menuItems.filter((item) => item.roles.includes(dashboardRole))
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
					className="fixed inset-0 z-20 bg-black/30 md:hidden"
					aria-label="Tutup sidebar"
				/>
			) : null}

			<aside
				className={`fixed inset-y-0 left-0 z-30 flex h-screen overflow-hidden border-r border-slate-200 bg-slate-900 text-slate-100 transition-all duration-300 md:sticky md:top-0 ${
					isOpen ? "translate-x-0 md:w-72" : "-translate-x-full md:w-0 md:-translate-x-full"
				}`}
			>
				<div className="flex h-full w-full min-h-0 flex-col">
					<div className="border-b border-slate-800 px-4 py-4">
						<div className="flex items-center gap-3">
							<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white text-lg font-semibold text-slate-900">
								PJ
							</div>
							<div>
								<p className="text-sm font-semibold tracking-wide">CV. Pridata Jaya</p>
								<p className="text-xs text-slate-300">{roleUi.sidebarSubtitle}</p>
							</div>
						</div>
					</div>

					{hideNavigation ? (
						<div className="flex-1" />
					) : (
						<nav className="flex-1 space-y-1 overflow-y-auto p-3">
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
										className={`block rounded-md px-3 py-2 text-sm transition ${
											isActive
												? `${roleUi.accentSolidClass} text-white`
												: "text-slate-200 hover:bg-slate-800"
										}`}
									>
										{item.label}
									</Link>
								);
							})}
						</nav>
					)}

					<div className="border-t border-slate-800 px-4 py-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
								{initials}
							</div>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-white">
									{user?.name || roleUi.fullName}
								</p>
								<p className={`text-xs uppercase ${roleUi.accentTextClass}`}>
									{roleUi.roleLabel}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={handleLogout}
							className="mt-4 w-full rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
						>
							Logout
						</button>
					</div>
				</div>
			</aside>
		</>
	);
}
