"use client";

import { Minus, Plus } from "lucide-react";

interface QuantityStepperProps {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	disabled?: boolean;
	label?: string;
	className?: string;
}

/**
 * Mengganti <input type="number" className="w-20 py-1.5"> yang tersebar di
 * katalog, keranjang, dan retur: target sentuh ~30px dan spinner-nya tidak
 * muncul di iOS, jadi jumlah hanya bisa diubah lewat papan ketik.
 */
export default function QuantityStepper({
	value,
	onChange,
	min = 1,
	max,
	disabled = false,
	label = "Jumlah",
	className = "",
}: QuantityStepperProps) {
	const clamp = (next: number) => {
		const floored = Math.floor(Number.isFinite(next) ? next : min);
		const lower = Math.max(min, floored);
		return max !== undefined ? Math.min(max, lower) : lower;
	};

	const step = (delta: number) => onChange(clamp(value + delta));

	const buttonClass =
		"inline-flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:text-slate-300 md:h-9 md:w-9";

	return (
		<div
			className={`inline-flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white ${className}`}
		>
			<button
				type="button"
				onClick={() => step(-1)}
				disabled={disabled || value <= min}
				aria-label={`Kurangi ${label.toLowerCase()}`}
				className={buttonClass}
			>
				<Minus className="h-4 w-4" />
			</button>
			<input
				type="number"
				inputMode="numeric"
				aria-label={label}
				min={min}
				max={max}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(clamp(Number(event.target.value)))}
				onBlur={(event) => onChange(clamp(Number(event.target.value) || min))}
				onClick={(event) => event.stopPropagation()}
				className="h-11 w-12 border-x border-slate-200 text-center text-sm font-semibold text-slate-900 outline-none [appearance:textfield] md:h-9 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			/>
			<button
				type="button"
				onClick={() => step(1)}
				disabled={disabled || (max !== undefined && value >= max)}
				aria-label={`Tambah ${label.toLowerCase()}`}
				className={buttonClass}
			>
				<Plus className="h-4 w-4" />
			</button>
		</div>
	);
}
