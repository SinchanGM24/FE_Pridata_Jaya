"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface FeatureAction {
	label: string;
	href?: string;
	onClick?: () => void;
}

interface FeaturePageProps {
	title: string;
	description: string;
	actions?: FeatureAction[];
	children?: ReactNode;
}

export function FeaturePage({
	title,
	description,
	actions = [],
	children,
}: FeaturePageProps) {
	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl space-y-2">
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
							FE2 parity workspace
						</p>
						<h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
						<p className="text-sm leading-6 text-slate-600">{description}</p>
					</div>
					{actions.length > 0 ? (
						<div className="flex flex-wrap gap-3">
							{actions.map((action) =>
								action.href ? (
									<Link
										key={action.href}
										href={action.href}
										className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
									>
										{action.label}
									</Link>
								) : (
									<button
										key={action.label}
										type="button"
										onClick={action.onClick}
										className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
									>
										{action.label}
									</button>
								)
							)}
						</div>
					) : null}
				</div>
			</section>

			{children}
		</div>
	);
}

