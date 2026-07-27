import apiClient from "@/lib/api-client";
import { API_BASE_URL } from "@/constants";
import type { ApiResponse } from "@/types";

export interface AuditRow {
  id: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  message?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface AuditListFilters {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  entityType?: string;
}

interface PaginationShape {
  totalItems?: number;
  total?: number;
  totalRecords?: number;
}

interface AuditListResult {
  items: AuditRow[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

const extractTotal = (meta: unknown): number | null => {
  if (!meta || typeof meta !== "object") return null;
  const typedMeta = meta as PaginationShape;
  if (typeof typedMeta.totalItems === "number") return typedMeta.totalItems;
  if (typeof typedMeta.total === "number") return typedMeta.total;
  if (typeof typedMeta.totalRecords === "number") return typedMeta.totalRecords;
  return null;
};

const extractMeta = (
  meta: unknown,
  fallbackPage: number,
): { currentPage: number; totalPages: number; totalItems: number } => {
  if (!meta || typeof meta !== "object") {
    return { currentPage: fallbackPage, totalPages: 1, totalItems: 0 };
  }
  const m = meta as Record<string, unknown>;
  const totalItems = extractTotal(meta) ?? 0;
  const currentPage =
    typeof m.currentPage === "number"
      ? m.currentPage
      : typeof m.page === "number"
        ? m.page
        : fallbackPage;
  const totalPages =
    typeof m.totalPages === "number"
      ? m.totalPages
      : typeof m.totalPages === "number"
        ? m.totalPages
        : 1;
  return { currentPage, totalPages, totalItems };
};

export const auditService = {
  async getCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<AuditRow[]>>("/audit-logs", {
      params: { page: 1, limit: 1 },
    });
    const total = extractTotal(res.data.meta);
    if (typeof total === "number") return total;
    if (Array.isArray(res.data.data)) return res.data.data.length;
    return 0;
  },

  async listLatest(limit = 5): Promise<AuditRow[]> {
    const res = await apiClient.get<ApiResponse<AuditRow[]>>("/audit-logs", {
      params: { page: 1, limit },
    });
    return res.data.data ?? [];
  },

  /** Paginated audit log list with server-side filtering. */
  async listPaginated(
    filters: AuditListFilters = {},
  ): Promise<AuditListResult> {
    const { page = 1, limit = 50, dateFrom, dateTo, action, entityType } = filters;
    const params: Record<string, string | number> = { page, limit };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (action) params.action = action;
    if (entityType) params.entityType = entityType;

    const res = await apiClient.get<ApiResponse<AuditRow[]>>("/audit-logs", {
      params,
    });

    const items = Array.isArray(res.data.data) ? res.data.data : [];
    const extracted = extractMeta(res.data.meta, page);

    return {
      items,
      meta: {
        currentPage: extracted.currentPage,
        totalPages: extracted.totalPages,
        totalItems: extracted.totalItems,
      },
    };
  },

  /** Build a URL to export audit logs as CSV. */
  exportCsv(filters: AuditListFilters = {}): string {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    params.set("format", "csv");
    return `${API_BASE_URL}/audit-logs/export?${params.toString()}`;
  },

  /** SSE stream URL for real-time audit events. */
  streamUrl: `${API_BASE_URL}/audit-logs/stream`,
};
