import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "commerce" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-600",
	// Rose dipesan khusus untuk aksi komersial: pesan, checkout, bayar.
	commerce: "bg-accent-600 text-white shadow-sm hover:bg-accent-700 focus-visible:outline-accent-600",
	secondary:
		"border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-500",
	ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-500",
	danger:
		"border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 focus-visible:outline-rose-600",
};

// Lantai sentuh 44px di layar kecil; sedikit lebih padat begitu ada pointer presisi.
const SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: "min-h-11 px-3 text-sm md:min-h-9 md:px-3",
	md: "min-h-11 px-4 text-sm md:min-h-10",
};

const BASE =
	"inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55";

export function buttonClasses(
	variant: ButtonVariant = "primary",
	size: ButtonSize = "md",
	className = "",
) {
	return `${BASE} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`;
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
	children: ReactNode;
	variant?: ButtonVariant;
	size?: ButtonSize;
	className?: string;
	/** Kalau diisi, dirender sebagai <Link> alih-alih <button>. */
	href?: string;
	block?: boolean;
}

export default function Button({
	children,
	variant = "primary",
	size = "md",
	className = "",
	href,
	block = false,
	type = "button",
	...rest
}: ButtonProps) {
	const classes = buttonClasses(variant, size, `${block ? "w-full" : ""} ${className}`);

	if (href) {
		return (
			<Link href={href} className={classes}>
				{children}
			</Link>
		);
	}

	return (
		<button type={type} className={classes} {...rest}>
			{children}
		</button>
	);
}
