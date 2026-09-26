"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { authService } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { getRoleUi } from "@/constants";
import { resolveDashboardRole } from "@/lib/auth";
import { canManageProductTaxonomy, canManageWarehouseAssignments } from "@/lib/role-capabilities";
import { BrandIdentity } from "@/components/layout/BrandIdentity";
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
	taxonomyOnly?: boolean;
}

interface OwnerMenuGroup {
	id: string;
	label: string;
	items: Array<Pick<MenuItem, "label" | "href">>;
}

const ownerMainItems: Array<Pick<MenuItem, "label" | "href">> = [
	{ label: "Dashboard Owner", href: "/owner/dashboard-owner" },
	{ label: "Grade Toko", href: "/owner/grade-toko" },
];

const ownerMenuGroups: OwnerMenuGroup[] = [
	{
		id: "catalog-data",
		label: "Produk & Data",
		items: [
			{ label: "Insight Katalog", href: "/owner/insight-katalog" },
			{ label: "Master Data", href: "/owner/master-data" },
		],
	},
	{
		id: "team-access",
		label: "Tim & Akses",
		items: [
			{ label: "Kelola User", href: "/owner/kelola-user" },
			{ label: "Kelola Sales", href: "/owner/kelola-sales" },
			{ label: "Members", href: "/owner/members" },
			{ label: "Kelola Toko", href: "/owner/kelola-toko" },
		],
	},
	{
		id: "reports",
		label: "Laporan & Ekspor",
		items: [
			{ label: "Laporan", href: "/owner/reports" },
			{ label: "Template Laporan", href: "/owner/template-laporan" },
			{ label: "Riwayat Ekspor", href: "/owner/riwayat-ekspor" },
		],
	},
];

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
	{ label: "Master Data", href: "/gudang/master-data", roles: ["gudang"], taxonomyOnly: true },
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
	{ label: "Riwayat Ekspor", href: "/akuntan/export-logs", roles: ["akuntan"] },
	{ label: "Template Laporan", href: "/akuntan/template-laporan", roles: ["akuntan"] },

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
		label: "Kelola Sales",
		href: "/owner/kelola-sales",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Members",
		href: "/owner/members",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Insight Katalog",
		href: "/owner/insight-katalog",
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
	{ label: "Grade Toko", href: "/owner/grade-toko", roles: ["admin", "owner", "superowner"] },
	{
		label: "Riwayat Ekspor",
		href: "/owner/riwayat-ekspor",
		roles: ["admin", "owner", "superowner"],
	},
	{
		label: "Laporan",
		href: "/owner/reports",
		roles: ["admin", "owner", "superowner"],
	},
	{ label: "Template Laporan", href: "/owner/template-laporan", roles: ["admin", "owner", "superowner"] },

	{ label: "Dashboard Toko", href: "/toko/dashboard", roles: ["toko"] },
	{ label: "Home Katalog", href: "/toko/katalog", roles: ["toko"] },
	{
		label: "Keranjang",
		href: "/toko/purchase-order",
		roles: ["toko"],
	},
	{
		label: "Riwayat Transaksi",
		href: "/toko/riwayat-transaksi",
		roles: ["toko"],
	},
	{ label: "Tagihan & Pembayaran", href: "/toko/hutang-toko", roles: ["toko"] },
	{ label: "Payment Request", href: "/toko/payment-requests", roles: ["toko"] },
	{ label: "Store Credits", href: "/toko/store-credits", roles: ["toko"] },
	{ label: "Retur Toko", href: "/toko/retur", roles: ["toko"] },

	{ label: "Dashboard Sales", href: "/sales/dashboard", roles: ["sales"] },
	{ label: "Toko Kelolaan", href: "/sales/toko-kelolaan", roles: ["sales"] },
	{
		label: "Riwayat Transaksi",
		href: "/sales/riwayat-transaksi",
		roles: ["sales"],
	},
	{ label: "Aging Piutang", href: "/sales/aging-piutang", roles: ["sales"] },

	{ label: "Dashboard", href: "/digital-marketing/dashboard", roles: ["digital_marketing"] },
	{
		label: "Kelola Katalog",
		href: "/digital-marketing/kelola-katalog",
		roles: ["digital_marketing"],
	},
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
			"digital_marketing",
		],
	},
	{ label: "Notifikasi", href: "/notifications", roles: ["admin", "owner", "superowner", "akuntan", "fakturis", "gudang", "sales"] },
];

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

export function Sidebar({
	isOpen,
	onClose,
	hideNavigation = false,
}: SidebarProps) {
	const pathname = usePathname();
	const { user } = useAuth();
	const [expandedOwnerGroup, setExpandedOwnerGroup] = useState<string | null>(null);

	const dashboardRole = resolveDashboardRole(user);
	const roleUi = getRoleUi(dashboardRole, user?.name);
	const isOwnerNavigation = dashboardRole === "admin" || dashboardRole === "owner" || dashboardRole === "superowner";
	const visibleItems = dashboardRole
		? menuItems
				.filter((item) => item.roles.includes(dashboardRole))
				.filter((item) => !isOwnerNavigation || !item.href.startsWith("/owner/"))
				.filter((item) => !item.taxonomyOnly || canManageProductTaxonomy(user))
				.filter(
					(item, index, source) =>
						source.findIndex(
							(candidate) => candidate.href === item.href,
						) === index,
				)
		: [];
	if (canManageWarehouseAssignments(user)) {
		visibleItems.splice(visibleItems.length - 2, 0, {
			label: "Penugasan Gudang",
			href: "/gudang/penugasan-gudang",
			roles: ["gudang"],
		});
	}

	const currentPath = normalizePath(pathname);
	const isCurrentRoute = (href: string) => {
		const normalizedHref = normalizePath(href);
		return currentPath === normalizedHref || (normalizedHref !== "/" && currentPath.startsWith(`${normalizedHref}/`));
	};
	const activeOwnerGroup = ownerMenuGroups.find((group) => group.items.some((item) => isCurrentRoute(item.href)));

	useEffect(() => {
		if (!isOwnerNavigation) return;
		const timer = window.setTimeout(() => setExpandedOwnerGroup(activeOwnerGroup?.id ?? null), 0);
		return () => window.clearTimeout(timer);
	}, [activeOwnerGroup?.id, isOwnerNavigation]);

	const utilityItems = isOwnerNavigation ? visibleItems : [];
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
					<div className="border-b border-slate-200/80 px-5 py-5">
						<BrandIdentity />
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
							{isOwnerNavigation ? (
								<div className="flex min-h-full flex-col">
									<div className="space-y-1.5">
										{ownerMainItems.map((item) => {
											const isActive = isCurrentRoute(item.href);
											return <Link key={item.href} href={item.href} onClick={() => { if (window.innerWidth < 768) onClose(); }} className={`group relative block overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive ? "bg-white text-slate-950 ring-1 ring-slate-200/80" : "text-slate-600 hover:bg-white/80 hover:text-slate-900"}`}><span className={`absolute inset-y-2 left-2 w-1 rounded-full ${isActive ? roleUi.accentSolidClass : "bg-transparent group-hover:bg-slate-300"}`}/><span className="relative block pl-3">{item.label}</span></Link>;
										})}
										{ownerMenuGroups.map((group) => {
											const isOpen = expandedOwnerGroup === group.id;
											const hasActiveItem = group.items.some((item) => isCurrentRoute(item.href));
											return <div key={group.id} className={`overflow-hidden rounded-2xl ${hasActiveItem ? "bg-white ring-1 ring-slate-200/80" : ""}`}><button type="button" onClick={() => setExpandedOwnerGroup((current) => current === group.id ? null : group.id)} className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition ${hasActiveItem ? "text-slate-950" : "text-slate-600 hover:bg-white/80 hover:text-slate-900"}`}><span>{group.label}</span><ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}/></button>{isOpen ? <div className="space-y-1 border-t border-slate-100 px-2 py-2">{group.items.map((item) => { const isActive = isCurrentRoute(item.href); return <Link key={item.href} href={item.href} onClick={() => { if (window.innerWidth < 768) onClose(); }} className={`block rounded-xl px-3 py-2.5 text-sm transition ${isActive ? `${roleUi.accentTextClass} bg-slate-50 font-semibold` : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>{item.label}</Link>; })}</div> : null}</div>;
										})}
									</div>
									{utilityItems.length ? <div className="mt-auto border-t border-slate-200/80 pt-4"><p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Utilitas</p><div className="space-y-1">{utilityItems.map((item) => <Link key={item.href} href={item.href} onClick={() => { if (window.innerWidth < 768) onClose(); }} className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${isCurrentRoute(item.href) ? `${roleUi.accentTextClass} bg-white ring-1 ring-slate-200/80` : "text-slate-600 hover:bg-white/80 hover:text-slate-900"}`}>{item.label}</Link>)}</div></div> : null}
								</div>
							) : (
								<div className="space-y-1.5">
									{visibleItems.map((item) => {
										const isActive = isCurrentRoute(item.href);
										return <Link key={item.href} href={item.href} onClick={() => { if (window.innerWidth < 768) onClose(); }} className={`group relative block overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive ? "bg-white text-slate-950 ring-1 ring-slate-200/80" : "text-slate-600 hover:bg-white/80 hover:text-slate-900"}`}><span className={`absolute inset-y-2 left-2 w-1 rounded-full transition-all ${isActive ? roleUi.accentSolidClass : "bg-transparent group-hover:bg-slate-300"}`}/><span className="relative block pl-3">{item.label}</span></Link>;
									})}
								</div>
							)}
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
