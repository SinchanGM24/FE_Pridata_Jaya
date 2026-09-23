"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";

export interface SearchComboboxOption {
	value: string;
	label: string;
	description?: string;
	keywords?: string;
}

interface SearchComboboxProps {
	label?: string;
	value: string;
	onChange: (value: string, option: SearchComboboxOption | null) => void;
	options?: SearchComboboxOption[];
	loadOptions?: (query: string) => Promise<SearchComboboxOption[]>;
	selectedOption?: SearchComboboxOption | null;
	placeholder?: string;
	emptyText?: string;
	loadingText?: string;
	disabled?: boolean;
	required?: boolean;
	allowClear?: boolean;
	className?: string;
	inputClassName?: string;
	dependencyKey?: string;
	maxResults?: number;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");

export default function SearchCombobox({
	label,
	value,
	onChange,
	options = [],
	loadOptions,
	selectedOption,
	placeholder = "Cari dan pilih...",
	emptyText = "Data tidak ditemukan.",
	loadingText = "Mencari data...",
	disabled = false,
	required = false,
	allowClear = true,
	className = "",
	inputClassName = "",
	dependencyKey = "",
	maxResults = 10,
}: SearchComboboxProps) {
	const id = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const requestIdRef = useRef(0);
	const loadOptionsRef = useRef(loadOptions);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [remoteOptions, setRemoteOptions] = useState<SearchComboboxOption[]>([]);
	const [remoteDependencyKey, setRemoteDependencyKey] = useState(dependencyKey);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [retryNonce, setRetryNonce] = useState(0);
	const hasRemoteLoader = Boolean(loadOptions);

	useEffect(() => {
		loadOptionsRef.current = loadOptions;
	}, [loadOptions]);

	const selected = useMemo(
		() => (selectedOption?.value === value ? selectedOption : null) ?? options.find((option) => option.value === value) ?? remoteOptions.find((option) => option.value === value) ?? null,
		[options, remoteOptions, selectedOption, value],
	);
	const localResults = useMemo(() => {
		const needle = normalize(query);
		return options
			.filter((option) => !needle || normalize(`${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`).includes(needle))
			.sort((left, right) => left.label.localeCompare(right.label, "id-ID"))
			.slice(0, maxResults);
	}, [maxResults, options, query]);
	const results = hasRemoteLoader
		? (remoteDependencyKey === dependencyKey ? remoteOptions : []).slice(0, maxResults)
		: localResults;
	const displayValue = open ? query : selected?.label ?? "";

	useEffect(() => {
		if (!open || !loadOptionsRef.current || disabled) return;
		const requestId = ++requestIdRef.current;
		const timer = window.setTimeout(() => {
			setLoading(true);
			setError("");
			void loadOptionsRef.current?.(query.trim())
				.then((items) => {
					if (requestId !== requestIdRef.current) return;
					setRemoteOptions(
						[...items]
							.sort((left, right) => left.label.localeCompare(right.label, "id-ID"))
							.slice(0, maxResults),
					);
					setRemoteDependencyKey(dependencyKey);
					setActiveIndex(0);
				})
				.catch(() => {
					if (requestId === requestIdRef.current) setError("Gagal memuat pilihan. Coba lagi.");
				})
				.finally(() => {
					if (requestId === requestIdRef.current) setLoading(false);
				});
		}, 300);
		return () => window.clearTimeout(timer);
	}, [dependencyKey, disabled, hasRemoteLoader, maxResults, open, query, retryNonce]);

	useEffect(() => {
		const closeOnOutsideClick = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setOpen(false);
				setQuery("");
			}
		};
		document.addEventListener("pointerdown", closeOnOutsideClick);
		return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
	}, []);

	const selectOption = (option: SearchComboboxOption) => {
		onChange(option.value, option);
		setQuery("");
		setOpen(false);
	};

	const openList = () => {
		if (disabled) return;
		if (!open) setQuery("");
		setOpen(true);
		setActiveIndex(0);
	};

	return (
		<div ref={rootRef} className={`relative space-y-2 ${className}`}>
			{label ? <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}{required ? " *" : ""}</label> : null}
			<div className="relative">
				<Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
				<input
					id={id}
					type="text"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={`${id}-listbox`}
					aria-activedescendant={open && results[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
					aria-required={required}
					value={displayValue}
					placeholder={placeholder}
					disabled={disabled}
					onFocus={openList}
					onClick={openList}
					onChange={(event) => {
						setQuery(event.target.value);
						setOpen(true);
						setActiveIndex(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setOpen(true);
							setActiveIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
						}
						if (event.key === "ArrowUp") {
							event.preventDefault();
							setActiveIndex((current) => Math.max(0, current - 1));
						}
						if (event.key === "Enter" && open && results[activeIndex]) {
							event.preventDefault();
							selectOption(results[activeIndex]);
						}
						if (event.key === "Escape") {
							setOpen(false);
							setQuery("");
						}
					}}
					className={`h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-16 text-sm md:h-10 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${inputClassName}`}
				/>
				{allowClear && value && !disabled ? (
					<button type="button" aria-label="Hapus pilihan" onClick={() => { onChange("", null); setQuery(""); setOpen(false); }} className="absolute right-7 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:h-9 md:w-9">
						<X aria-hidden="true" className="size-3.5" />
					</button>
				) : null}
				<ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
			</div>

			{open ? (
				<div id={`${id}-listbox`} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
					{loading ? <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{loadingText}</div> : null}
					{!loading && error ? <button type="button" onClick={() => setRetryNonce((current) => current + 1)} className="w-full rounded-lg px-3 py-3 text-left text-sm text-rose-600 hover:bg-rose-50">{error} Klik untuk mencoba lagi.</button> : null}
					{!loading && !error && results.length === 0 ? <div className="px-3 py-3 text-sm text-slate-500">{emptyText}</div> : null}
					{!loading && !error ? results.map((option, index) => (
						<button
							id={`${id}-option-${index}`}
							key={option.value}
							type="button"
							role="option"
							aria-selected={option.value === value}
							onMouseEnter={() => setActiveIndex(index)}
							onClick={() => selectOption(option)}
							className={`flex min-h-11 w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left md:min-h-10 ${activeIndex === index ? "bg-brand-50" : "hover:bg-slate-50"}`}
						>
							<span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{option.label}</span>{option.description ? <span className="mt-0.5 block truncate text-xs text-slate-500">{option.description}</span> : null}</span>
							{option.value === value ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-600" /> : null}
						</button>
					)) : null}
				</div>
			) : null}
		</div>
	);
}
