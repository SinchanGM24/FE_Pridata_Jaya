"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface FeatureAction {
	label: string;
	href?: string;
	onClick?: () => void;
	disabled?: boolean;
	tone?: "primary" | "secondary";
}

interface FeaturePageProps {
	title: string;
	description: string;
	actionsDescription?: string;
	actions?: FeatureAction[];
	children?: ReactNode;
}

export function FeaturePage({
	title,
	description,
	actionsDescription,
	actions = [],
	children,
}: FeaturePageProps) {
	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-6">
				<div>
					<div className="max-w-3xl space-y-2">
						<p className="type-label text-slate-500">
							Area Kerja
						</p>
						<h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
						<p className="text-sm leading-6 text-slate-600">{description}</p>
					</div>
					{actions.length > 0 ? (
						<div className="mt-5 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
							<p className="text-sm text-slate-700">
								{actionsDescription ?? "Aksi cepat untuk halaman ini."}
							</p>
							<div className="flex flex-wrap gap-2">
								{actions.map((action, index) => {
									const tone =
										action.tone ?? (index === actions.length - 1 ? "primary" : "secondary");
									const className =
										tone === "primary"
											? "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
											: "inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60";

									return action.href ? (
									<Link
										key={action.href}
										href={action.href}
										className={className}
									>
										{action.label}
									</Link>
								) : (
									<button
										key={action.label}
										type="button"
										onClick={action.onClick}
										disabled={action.disabled}
										className={className}
									>
										{action.label}
									</button>
									);
								})}
							</div>
						</div>
					) : null}
				</div>
			</section>

			{children}
		</div>
	);
}
