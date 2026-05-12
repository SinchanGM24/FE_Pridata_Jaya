import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

export const userService = {
  async getCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<any>>('/users', { params: { page: 1, limit: 1 } });
    const meta = res.data.meta || (res.data.data && (res.data.data.meta || res.data.data.pagination));
    if (meta) {
      // BE2 uses names like totalItems or total
      // Try common fields
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (meta.totalItems != null) return meta.totalItems as number;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (meta.total != null) return meta.total as number;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (meta.totalRecords != null) return meta.totalRecords as number;
    }
    if (Array.isArray(res.data.data)) return res.data.data.length;
    return 0;
  },

  async list(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/users', { params });
    return res.data.data;
  },
};
