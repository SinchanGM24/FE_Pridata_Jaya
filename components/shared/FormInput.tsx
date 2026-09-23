import type { InputHTMLAttributes } from "react";

/*
 * Satu tampilan untuk setiap kontrol form portal.
 *
 * Sebelumnya string class yang sama disalin ke puluhan berkas dengan `py-2`,
 * yang menghasilkan target sentuh ~34px — di bawah lantai 44px yang branch ini
 * klaim sudah diterapkan. min-h-11 mengangkatnya, md:min-h-10 memadatkannya
 * lagi begitu ada pointer presisi.
 */
const FIELD_BASE =
	"w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export function fieldClasses(kind: "control" | "area" = "control", className = "") {
	const size = kind === "area" ? "min-h-24 py-2.5 leading-6" : "min-h-11 md:min-h-10";
	return `${FIELD_BASE} ${size} ${className}`;
}

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
}

export default function FormInput({ label, error, className = "", ...rest }: FormInputProps) {
	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium text-slate-700">{label}</label>
			<input
				className={fieldClasses("control", className)}
				aria-invalid={error ? true : undefined}
				{...rest}
			/>
			{error ? <p className="text-xs text-rose-700">{error}</p> : null}
		</div>
	);
}
