"use client";

import type { ReactNode } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { useAuth } from "@/hooks/useAuth";
import { canManageProductTaxonomy } from "@/lib/role-capabilities";

export function ProductTaxonomyGate({ children }: { children: ReactNode }) {
	const { user } = useAuth();

	if (!canManageProductTaxonomy(user)) {
		return <FeaturePage title="Master Data Gudang" description="Master data produk hanya dapat dikelola oleh staf gudang." />;
	}

	return <>{children}</>;
}
