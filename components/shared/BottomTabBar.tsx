"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

export interface TabItem {
	label: string;
	href: string;
	icon: ComponentType<{ className?: string }>;
	/** Angka kecil di pojok ikon (mis. jumlah item keranjang). */
	badge?: number;
	/** Cocokkan juga sub-path. Default: true. */
	matchPrefix?: boolean;
}

interface BottomTabBarProps {
	items: TabItem[];
	/** Tab paling kanan yang membuka sheet "Lainnya" alih-alih menavigasi. */
	moreLabel?: string;
	moreIcon?: ComponentType<{ className?: string }>;
	onMoreClick?: () => void;
	moreActive?: boolean;
	children?: ReactNode;
}

/**
 * Navigasi utama di zona jempol untuk layar < md.
 * Sebelumnya portal toko/sales tidak punya navigasi mobile sama sekali —
 * link "Buka Katalog" justru `hidden md:inline-flex`.
 */
export default function BottomTabBar({
	items,
	moreLabel = "Lainnya",
	moreIcon: MoreIcon,
	onMoreClick,
	moreActive = false,
}: BottomTabBarProps) {
	const pathname = usePathname();

	const isActive = (item: TabItem) =>
		item.matchPrefix === false
			? pathname === item.href
			: pathname === item.href || pathname.startsWith(`${item.href}/`);

	return (
		<nav
			aria-label="Navigasi utama"
			className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-safe-b backdrop-blur md:hidden"
		>
			<ul className="mx-auto flex max-w-lg items-stretch">
				{items.map((item) => {
					const active = isActive(item);
					const Icon = item.icon;
					return (
						<li key={item.href} className="flex-1">
							<Link
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={`flex h-14 flex-col items-center justify-center gap-0.5 px-1 transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-700 ${
									active ? "text-brand-700" : "text-slate-500"
								}`}
							>
								<span className="relative">
									<Icon className="h-5 w-5" />
									{item.badge && item.badge > 0 ? (
										<span className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white">
											{item.badge > 99 ? "99+" : item.badge}
										</span>
									) : null}
								</span>
								<span className="max-w-full truncate text-[11px] font-semibold">{item.label}</span>
							</Link>
						</li>
					);
				})}

				{onMoreClick && MoreIcon ? (
					<li className="flex-1">
						<button
							type="button"
							onClick={onMoreClick}
							aria-expanded={moreActive}
							className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 px-1 transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-700 ${
								moreActive ? "text-brand-700" : "text-slate-500"
							}`}
						>
							<MoreIcon className="h-5 w-5" />
							<span className="text-[11px] font-semibold">{moreLabel}</span>
						</button>
					</li>
				) : null}
			</ul>
		</nav>
	);
}
