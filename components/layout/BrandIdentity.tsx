import Image from "next/image";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
	subsets: ["latin"],
	weight: ["500", "600", "800", "900"],
	display: "swap",
});

interface BrandIdentityProps {
	variant?: "sidebar" | "navbar";
}

export function BrandIdentity({ variant = "sidebar" }: BrandIdentityProps) {
	const isNavbar = variant === "navbar";

	return (
		<div className={`${montserrat.className} flex min-w-0 items-center`}>
			<div
				className={`flex shrink-0 items-center justify-center ${
					isNavbar ? "h-12 w-[58px]" : "h-[74px] w-[78px]"
				}`}
			>
				<Image
					src="/pridata-logo.png"
					alt="Logo Pridata Jaya"
					width={isNavbar ? 58 : 78}
					height={isNavbar ? 48 : 74}
					loading="eager"
					unoptimized
					className="h-full w-full object-contain"
				/>
			</div>
			<div
				className={`w-px shrink-0 bg-slate-300 ${
					isNavbar ? "mx-3 h-11" : "mx-3 h-16"
				}`}
				aria-hidden="true"
			/>
			<div className="min-w-0 flex-1">
				<p
					className={`font-medium leading-tight text-slate-600 ${
						isNavbar
							? "text-[10px] sm:text-[11px]"
							: "text-[10.5px]"
					}`}
				>
					Sistem Manajemen Distribusi
				</p>
				<p
					className={`mt-2 truncate font-extrabold leading-none tracking-[-0.03em] text-slate-800 ${
						isNavbar ? "text-[17px]" : "text-[24px]"
					}`}
				>
					Pridata Jaya
				</p>
				<p
					className={`mt-2 truncate font-semibold uppercase leading-none tracking-[0.16em] text-[#11A8D8] ${
						isNavbar ? "text-[7.5px]" : "text-[9.5px]"
					}`}
				>
					BERSAMA MERAIH SUKSES
				</p>
			</div>
		</div>
	);
}
