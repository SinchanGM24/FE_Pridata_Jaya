import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export interface AuditRow {
  id: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  message?: string | null;
  createdAt: string;
}

interface PaginationShape {
  totalItems?: number;
  total?: number;
  totalRecords?: number;
}

type AuditListPayload = AuditRow[];

const extractTotal = (meta: unknown): number | null => {
  if (!meta || typeof meta !== "object") return null;
  const typedMeta = meta as PaginationShape;
  if (typeof typedMeta.totalItems === "number") return typedMeta.totalItems;
  if (typeof typedMeta.total === "number") return typedMeta.total;
  if (typeof typedMeta.totalRecords === "number") return typedMeta.totalRecords;
  return null;
};

export const auditService = {
  async getCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<AuditListPayload>>('/audit-logs', { params: { page: 1, limit: 1 } });
    const total = extractTotal(res.data.meta);
    if (typeof total === "number") return total;
    if (Array.isArray(res.data.data)) return res.data.data.length;
    return 0;
  },

  async listLatest(limit = 5): Promise<AuditRow[]> {
    const res = await apiClient.get<ApiResponse<AuditListPayload>>('/audit-logs', { params: { page: 1, limit } });
    return res.data.data ?? [];
  },
};
