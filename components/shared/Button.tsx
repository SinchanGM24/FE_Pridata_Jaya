import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "commerce" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/*
 * primary  brand-700 (#027eac) vs putih = 4.58:1. brand-600 hanya 4.06:1 —
 *          tombol primary yang lama gagal WCAG AA untuk teks normal.
 * commerce oranye logo dengan teks gelap = 7.90:1. Oranye di bawah teks putih
 *          hanya 2.26:1, jadi ia memang warna permukaan, bukan latar teks-putih.
 *          Hasilnya tombol beli yang hangat dan tidak generik.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	primary: "bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700",
	commerce:
		"bg-accent-500 text-slate-900 hover:bg-accent-400 active:bg-accent-600 focus-visible:outline-accent-700",
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

/*
 * Radius berjenjang, bukan lima nilai acak: kontainer rounded-2xl >
 * elemen rounded-xl > kontrol rounded-lg. Tombol adalah kontrol.
 *
 * active:translate-y-px memberi umpan balik tekan yang sebelumnya tidak ada
 * sama sekali — di layar sentuh hover tidak pernah terjadi.
 */
const BASE =
	"inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[background-color,color,transform] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0";

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
