import type { User } from "@/types";
import { resolveEffectiveRole } from "@/lib/auth";

export const getOrganizationRole = (user: User | null) => user?.organizationRole ?? null;
export const canReadNotifications = (user: User | null) => ["admin", "owner", "accountant", "akuntan", "invoicist", "fakturis", "warehouse_staff", "warehouse_manager", "gudang", "sales"].includes(resolveEffectiveRole(user) ?? "");
export const canManageWarehouseAssignments = (user: User | null) => getOrganizationRole(user) === "warehouse_manager";
/** Mirrors BE PRODUCT_TAXONOMY_WRITE_ROLES (owner, warehouse_staff); a warehouse_manager only reads. */
export const canManageProductTaxonomy = (user: User | null) => ["owner", "warehouse_staff"].includes(getOrganizationRole(user) ?? "") || user?.role === "admin";
/** Mirrors BE WAREHOUSE_WRITE_ROLES for product create/import (owner, warehouse_staff, warehouse_manager). */
export const canManageWarehouseItems = (user: User | null) => ["owner", "warehouse_staff", "warehouse_manager"].includes(getOrganizationRole(user) ?? "") || user?.role === "admin";
export const isWarehouseStaff = (user: User | null) => getOrganizationRole(user) === "warehouse_staff" || (getOrganizationRole(user) === null && user?.role === "warehouse_staff");
export const canManageReportTemplates = (user: User | null) => ["owner", "admin", "accountant", "akuntan"].includes(resolveEffectiveRole(user) ?? "");
/** Organization-wide operational monitoring is deliberately narrower than the inbox. */
export const canMonitorOrganization = (user: User | null) => ["owner", "admin"].includes(resolveEffectiveRole(user) ?? "");
