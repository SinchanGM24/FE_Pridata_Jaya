import type { InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
}

export default function FormInput({
	label,
	error,
	className = "",
	...rest
}: FormInputProps) {
	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium text-slate-700">{label}</label>
			<input
				className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 ${className}`}
				{...rest}
			/>
			{error ? <p className="text-xs text-rose-600">{error}</p> : null}
		</div>
	);
}
