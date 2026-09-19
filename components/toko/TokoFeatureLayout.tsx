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
			{/*
			 * Sidebar hanya muncul dari lg ke atas. Sebelumnya ia menumpuk di atas
			 * konten di setiap layar < 1024px, mendorong isi halaman ke bawah lipatan.
			 * Di mobile link-link ini sudah diwakili bottom tab bar + sheet "Lainnya".
			 */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
				<TokoProfileSidebar basePath={basePath} className="hidden lg:block" />
				<section className="min-w-0 space-y-4">{children}</section>
			</div>
		</TokoStorefrontShell>
	);
}
