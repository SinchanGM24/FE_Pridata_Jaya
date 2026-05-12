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

export const auditService = {
  async getCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<any>>('/audit-logs', { params: { page: 1, limit: 1 } });
    const meta = res.data.meta || (res.data.data && (res.data.data.meta || res.data.data.pagination));
    if (meta) {
      // try common meta fields
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (meta.totalItems != null) return meta.totalItems as number;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (meta.total != null) return meta.total as number;
    }
    if (Array.isArray(res.data.data)) return res.data.data.length;
    return 0;
  },

  async listLatest(limit = 5): Promise<AuditRow[]> {
    const res = await apiClient.get<ApiResponse<any>>('/audit-logs', { params: { page: 1, limit } });
    return res.data.data ?? [];
  },
};
