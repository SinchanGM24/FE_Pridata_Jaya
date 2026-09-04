import type { DashboardRole, UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
	superowner: "Super Owner",
	owner: "Owner",
	admin: "Admin",
	user: "Internal",
	fakturis: "Fakturis",
	invoicist: "Fakturis",
	gudang: "Gudang",
	warehouse_staff: "Gudang",
	warehouse_manager: "Manajer Gudang",
	akuntan: "Akuntan",
	accountant: "Akuntan",
	sales: "Sales",
	digital_marketing: "Digital Marketing",
	toko: "Toko",
	store_customer: "Toko",
};

export const ROLE_COLORS: Record<UserRole, string> = {
	superowner: "bg-rose-200 text-rose-900",
	owner: "bg-rose-100 text-rose-800",
	admin: "bg-rose-200 text-rose-900",
	user: "bg-slate-100 text-slate-700",
	fakturis: "bg-indigo-100 text-indigo-800",
	invoicist: "bg-indigo-100 text-indigo-800",
	gudang: "bg-emerald-100 text-emerald-800",
	warehouse_staff: "bg-emerald-100 text-emerald-800",
	warehouse_manager: "bg-teal-100 text-teal-800",
	akuntan: "bg-amber-100 text-amber-800",
	accountant: "bg-amber-100 text-amber-800",
	sales: "bg-violet-100 text-violet-800",
	digital_marketing: "bg-fuchsia-100 text-fuchsia-800",
	toko: "bg-cyan-100 text-cyan-800",
	store_customer: "bg-cyan-100 text-cyan-800",
};

export const USER_MANAGEMENT_ROLE_OPTIONS = [
	{ value: "owner", label: ROLE_LABELS.owner },
	{ value: "invoicist", label: ROLE_LABELS.invoicist },
	{ value: "warehouse_staff", label: ROLE_LABELS.warehouse_staff },
	{ value: "warehouse_manager", label: ROLE_LABELS.warehouse_manager },
	{ value: "accountant", label: ROLE_LABELS.accountant },
	{ value: "sales", label: ROLE_LABELS.sales },
	{ value: "digital_marketing", label: ROLE_LABELS.digital_marketing },
] as const satisfies ReadonlyArray<{ value: UserRole; label: string }>;

export const USER_ROLE_FILTER_OPTIONS = [
	...USER_MANAGEMENT_ROLE_OPTIONS,
	{ value: "store_customer", label: ROLE_LABELS.store_customer },
] as const satisfies ReadonlyArray<{ value: UserRole; label: string }>;

export const DASHBOARD_ROLE_LABELS: Record<DashboardRole, string> = {
	superowner: "SUPEROWNER",
	owner: "OWNER",
	admin: "ADMIN",
	fakturis: "FAKTURIS",
	gudang: "GUDANG",
	akuntan: "AKUNTAN",
	sales: "SALES",
	digital_marketing: "DIGITAL MARKETING",
	toko: "TOKO",
};

export const ROLE_HOME_ROUTES: Record<DashboardRole, string> = {
	superowner: "/owner/dashboard-owner",
	owner: "/owner/dashboard-owner",
	admin: "/owner/dashboard-owner",
	fakturis: "/fakturis/pesanan-masuk",
	gudang: "/gudang/stok-barang",
	akuntan: "/akuntan/dashboard-penjualan",
	sales: "/sales/dashboard",
	digital_marketing: "/digital-marketing/dashboard",
	toko: "/toko/dashboard",
};

export const ROLE_ALLOWED_PREFIXES: Record<DashboardRole, string[]> = {
	superowner: ["/owner", "/akuntan", "/dashboard", "/grade-toko", "/profile", "/notifications"],
	owner: ["/owner", "/akuntan", "/dashboard", "/grade-toko", "/profile", "/notifications"],
	admin: ["/admin", "/owner", "/akuntan", "/dashboard", "/grade-toko", "/profile", "/notifications"],
	// `/notifications` mengikuti NOTIFICATION_READ_ROLES di backend: owner,
	// accountant, invoicist, warehouse_staff/manager, dan sales. Tanpa prefix ini,
	// tautan "lihat semua" di NotificationBell memantul balik ke halaman utama
	// peran tersebut meski backend melayani inbox-nya.
	fakturis: ["/fakturis", "/dashboard", "/grade-toko", "/profile", "/notifications"],
	gudang: ["/gudang", "/dashboard", "/grade-toko", "/profile", "/notifications"],
	akuntan: ["/akuntan", "/dashboard", "/grade-toko", "/profile", "/notifications"],
	sales: ["/sales", "/dashboard", "/grade-toko", "/profile", "/notifications"],
	// Digital marketing tidak ada di NOTIFICATION_READ_ROLES maupun
	// REALTIME_READ_ROLES, jadi tidak ada inbox untuknya — lihat Navbar, yang
	// menyembunyikan lonceng untuk peran ini alih-alih menembak 403 berulang.
	digital_marketing: ["/digital-marketing", "/profile"],
	toko: ["/toko", "/dashboard", "/grade-toko", "/profile"],
};

export interface RoleUiConfig {
	appTitle: string;
	fullName: string;
	roleLabel: string;
	sidebarSubtitle: string;
	accentSolidClass: string;
	accentSoftClass: string;
	accentTextClass: string;
}

const ROLE_UI: Record<DashboardRole, RoleUiConfig> = {
	superowner: {
		appTitle: "CV. PRIDATA JAYA - SISTEM MANAJEMEN DISTRIBUTOR",
		fullName: "Super Owner CV. Pridata Jaya",
		roleLabel: "SUPEROWNER",
		sidebarSubtitle: "Sistem Manajemen Distributor",
		accentSolidClass: "bg-rose-500",
		accentSoftClass: "bg-rose-50",
		accentTextClass: "text-rose-700",
	},
	owner: {
		appTitle: "CV. PRIDATA JAYA - SISTEM MANAJEMEN DISTRIBUTOR",
		fullName: "Owner CV. Pridata Jaya",
		roleLabel: "OWNER",
		sidebarSubtitle: "Sistem Manajemen Distributor",
		accentSolidClass: "bg-rose-500",
		accentSoftClass: "bg-rose-50",
		accentTextClass: "text-rose-700",
	},
	admin: {
		appTitle: "CV. PRIDATA JAYA - SISTEM ADMIN OPERASIONAL",
		fullName: "Admin Operasional CV. Pridata Jaya",
		roleLabel: "ADMIN",
		sidebarSubtitle: "Operasional Distributor",
		accentSolidClass: "bg-indigo-500",
		accentSoftClass: "bg-indigo-50",
		accentTextClass: "text-indigo-700",
	},
	fakturis: {
		appTitle: "CV. PRIDATA JAYA - SISTEM DISTRIBUSI",
		fullName: "Admin Fakturis",
		roleLabel: "FAKTURIS",
		sidebarSubtitle: "Sistem Distribusi",
		accentSolidClass: "bg-indigo-500",
		accentSoftClass: "bg-indigo-50",
		accentTextClass: "text-indigo-700",
	},
	gudang: {
		appTitle: "CV. PRIDATA JAYA - SISTEM GUDANG",
		fullName: "Admin Gudang",
		roleLabel: "GUDANG",
		sidebarSubtitle: "Dashboard Gudang",
		accentSolidClass: "bg-emerald-500",
		accentSoftClass: "bg-emerald-50",
		accentTextClass: "text-emerald-700",
	},
	akuntan: {
		appTitle: "CV. PRIDATA JAYA - SISTEM AKUNTANSI",
		fullName: "Akuntan",
		roleLabel: "AKUNTAN",
		sidebarSubtitle: "Dashboard Akuntansi",
		accentSolidClass: "bg-amber-500",
		accentSoftClass: "bg-amber-50",
		accentTextClass: "text-amber-700",
	},
	sales: {
		appTitle: "CV. PRIDATA JAYA - PORTAL SALES",
		fullName: "Sales Representative",
		roleLabel: "SALES",
		sidebarSubtitle: "Portal Customer Management",
		accentSolidClass: "bg-violet-600",
		accentSoftClass: "bg-violet-50",
		accentTextClass: "text-violet-700",
	},
	digital_marketing: {
		appTitle: "CV. PRIDATA JAYA - DIGITAL MARKETING",
		fullName: "Digital Marketing",
		roleLabel: "DIGITAL MARKETING",
		sidebarSubtitle: "Manajemen Konten Katalog",
		accentSolidClass: "bg-fuchsia-600",
		accentSoftClass: "bg-fuchsia-50",
		accentTextClass: "text-fuchsia-700",
	},
	toko: {
		appTitle: "CV. PRIDATA JAYA - PORTAL TOKO",
		fullName: "Mitra Toko",
		roleLabel: "TOKO",
		sidebarSubtitle: "Portal Customer Eksternal",
		accentSolidClass: "bg-cyan-600",
		accentSoftClass: "bg-cyan-50",
		accentTextClass: "text-cyan-700",
	},
};

export function getRoleUi(role: DashboardRole | null | undefined, fallbackName?: string): RoleUiConfig {
	if (!role) {
		return {
			appTitle: "CV. PRIDATA JAYA - SISTEM DISTRIBUSI",
			fullName: fallbackName || "User",
			roleLabel: "USER",
			sidebarSubtitle: "Sistem Distribusi",
			accentSolidClass: "bg-slate-600",
			accentSoftClass: "bg-slate-100",
			accentTextClass: "text-slate-700",
		};
	}

	return {
		...ROLE_UI[role],
		fullName: fallbackName?.trim() || ROLE_UI[role].fullName,
	};
}

export const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

export const COOKIE_NAME_SESSION = "better-auth.session_token";
