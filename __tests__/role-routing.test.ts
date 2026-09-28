import { describe, expect, it } from "vitest";

import { ROLE_ALLOWED_PREFIXES, ROLE_HOME_ROUTES, ROLE_LABELS } from "@/constants";
import { resolveDashboardRole } from "@/lib/auth";
import { normalizeRole } from "@/services/auth";
import type { User, UserRole } from "@/types";

// ROLE_LABELS is Record<UserRole, …>, so tsc keeps this list complete.
const USER_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

// Salinan ORG_ROLE_NAMES di SMD-Pridata-BE/src/lib/role-names.ts. Role baru di
// backend harus ditambahkan di sini juga — test ini yang menangkap FE yang lupa.
const BACKEND_ORG_ROLES = [
	"owner",
	"warehouse_staff",
	"warehouse_manager",
	"invoicist",
	"accountant",
	"sales",
	"digital_marketing",
	"store_customer",
] as const;

const userWith = (role: UserRole): User =>
	({ id: "u1", email: "u@test", name: "U", role: "user", organizationRole: role }) as User;

// Sama dengan cek di app/(dashboard)/layout.tsx.
const isAllowed = (role: NonNullable<ReturnType<typeof resolveDashboardRole>>, path: string) =>
	ROLE_ALLOWED_PREFIXES[role].some((prefix) => path.startsWith(prefix));

describe("role routing", () => {
	// "user" adalah system role tanpa dashboard; /dashboard menampilkan
	// "Peran belum didukung" untuknya.
	const dashboardRoles = USER_ROLES.filter((role) => role !== "user");

	it.each(dashboardRoles)("%s resolves to a dashboard whose home route it may open", (role) => {
		expect(ROLE_LABELS[role]).toBeTruthy();

		const dashboardRole = resolveDashboardRole(userWith(role));
		expect(dashboardRole).not.toBeNull();

		const home = ROLE_HOME_ROUTES[dashboardRole!];
		expect(home).toBeTruthy();
		expect(isAllowed(dashboardRole!, home)).toBe(true);
	});

	it("leaves the plain system role without a dashboard", () => {
		expect(resolveDashboardRole(userWith("user"))).toBeNull();
	});

	it("routes a system admin to admin regardless of organization role", () => {
		expect(resolveDashboardRole({ ...userWith("sales"), role: "admin" })).toBe("admin");
	});
});

describe("normalizeRole", () => {
	it.each(BACKEND_ORG_ROLES)("keeps backend org role %s", (role) => {
		expect(normalizeRole(role)).toBe(role);
		expect(normalizeRole(` ${role} `)).toBe(role);
	});

	it("drops unknown or empty roles", () => {
		expect(normalizeRole("hacker")).toBeNull();
		expect(normalizeRole("")).toBeNull();
		expect(normalizeRole(null)).toBeNull();
	});
});
