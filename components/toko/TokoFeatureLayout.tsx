"use client";

import type { ReactNode } from "react";
import TokoProfileSidebar from "@/components/toko/TokoProfileSidebar";
import TokoStorefrontShell from "@/components/toko/TokoStorefrontShell";

interface TokoFeatureLayoutProps {
	title: string;
	children: ReactNode;
	basePath?: string;
	cartCount?: number;
	profileName?: string;
	profileRoleLabel?: string;
	salesName?: string | null;
}

export default function TokoFeatureLayout({
	title,
	children,
	basePath = "/toko",
	cartCount = 0,
	profileName,
	profileRoleLabel,
	salesName,
}: TokoFeatureLayoutProps) {
	return (
		<TokoStorefrontShell
			title={title}
			basePath={basePath}
			cartCount={cartCount}
			profileName={profileName}
			profileRoleLabel={profileRoleLabel}
			salesName={salesName}
			showAccountFooter
		>
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-4">
				<TokoProfileSidebar basePath={basePath} />
				<section className="min-w-0 space-y-3 lg:space-y-4">{children}</section>
			</div>
		</TokoStorefrontShell>
	);
}
