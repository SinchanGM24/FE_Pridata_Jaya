"use client";

import type { ReactNode } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { useAuth } from "@/hooks/useAuth";
import { canManageWarehouseOperationalMasterData } from "@/lib/role-capabilities";

export function WarehouseOperationalMasterDataGate({ children }: { children: ReactNode }) {
	const { user } = useAuth();

	if (!canManageWarehouseOperationalMasterData(user)) {
		return <FeaturePage title="Master Data Gudang" description="Data gudang, supplier, dan driver hanya dapat dikelola oleh Manajer Gudang." />;
	}

	return <>{children}</>;
}
