"use client";

import type { ReactNode } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { useAuth } from "@/hooks/useAuth";
import { canManageWarehouseAssignments } from "@/lib/role-capabilities";

export function WarehouseManagerGate({ children }: { children: ReactNode }) {
	const { user } = useAuth();

	if (!canManageWarehouseAssignments(user)) {
		return <FeaturePage title="Master Data Gudang" description="Master data gudang hanya dapat dikelola oleh manager gudang." />;
	}

	return <>{children}</>;
}
