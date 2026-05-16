import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/types";

interface UserListItem {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

interface PaginationShape {
  totalItems?: number;
  total?: number;
  totalRecords?: number;
}

const extractTotal = (meta: unknown): number | null => {
  if (!meta || typeof meta !== "object") return null;
  const typedMeta = meta as PaginationShape;
  if (typeof typedMeta.totalItems === "number") return typedMeta.totalItems;
  if (typeof typedMeta.total === "number") return typedMeta.total;
  if (typeof typedMeta.totalRecords === "number") return typedMeta.totalRecords;
  return null;
};

export const userService = {
  async getCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<UserListItem[]>>('/users', { params: { page: 1, limit: 1 } });
    const total = extractTotal(res.data.meta);
    if (typeof total === "number") return total;
    if (Array.isArray(res.data.data)) return res.data.data.length;
    return 0;
  },

  async list(params?: Record<string, string | number | boolean | undefined>) {
    const res = await apiClient.get<ApiResponse<UserListItem[]>>('/users', { params });
    return res.data.data;
  },
};
