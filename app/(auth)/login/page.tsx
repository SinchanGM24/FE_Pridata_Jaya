"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { authService } from "@/services/auth";
import { BrandIdentity } from "@/components/layout/BrandIdentity";
import Button from "@/components/shared/Button";
import { fieldClasses } from "@/components/shared/FormInput";
import InlineAlert from "@/components/shared/InlineAlert";

/*
 * Better Auth menjawab dalam bahasa Inggris, dan pesannya dulu diteruskan apa
 * adanya — "Invalid email or password" di tengah UI berbahasa Indonesia. Ini
 * kelas yang sama dengan enum mentah yang bocor ke layar.
 *
 * Hanya yang benar-benar terverifikasi yang dipetakan; sisanya tetap
 * diteruskan supaya galat tak terduga tidak berubah jadi pesan yang salah.
 */
const SERVER_MESSAGE_ID: Record<string, string> = {
	"invalid email or password": "Email atau password salah.",
};

const getErrorMessage = (error: unknown) => {
	if (!error || typeof error !== "object") {
		return "Login gagal. Silakan coba lagi.";
	}

	const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
	if (typeof responseMessage === "string" && responseMessage.trim()) {
		return SERVER_MESSAGE_ID[responseMessage.trim().toLowerCase()] ?? responseMessage;
	}

	const message = (error as { message?: string }).message;
	return typeof message === "string" && message.trim()
		? message
		: "Login gagal. Silakan coba lagi.";
};

export default function LoginPage() {
	const router = useRouter();
	const [form, setForm] = useState({
		username: "",
		password: "",
	});
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const response = await authService.login(form);
			router.push(authService.getHomeRoute(response.user));
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		/*
		 * Halaman ini dulu satu-satunya permukaan yang melewati sistem: gradien
		 * biru-indigo dekoratif, hue `blue`/`gray`/`red` yang tidak ada di palet
		 * Pridata, `shadow-xl`, input py-2 (~34px, di bawah lantai sentuh 44px),
		 * dan `focus:outline-none` yang mematikan cincin fokus global.
		 *
		 * Sekarang ia memakai ground yang sama dengan kedua shell portal, kartu
		 * yang dibedakan garis + permukaan, dan primitif bersama. Aturannya di
		 * ../../../DESIGN.md.
		 */
		<div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
			<main className="w-full max-w-md">
				<div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
					{/* Rata kiri, satu tepi dengan judul dan label form. Lockup yang
					    ditengahkan di atas form yang rata kiri adalah simetri pemasaran,
					    dan ini alat kerja. */}
					<BrandIdentity variant="sidebar" />

					<h1 className="type-title mt-7 text-slate-900">Masuk ke akun Anda</h1>

					<form onSubmit={handleSubmit} className="mt-5 space-y-4" aria-busy={isLoading}>
						{/* InlineAlert, bukan PageFeedback: galat submit harus tinggal di
						    tempatnya, bukan melayang di sudut layar. Ia sudah role="alert". */}
						{error ? <InlineAlert>{error}</InlineAlert> : null}

						<div className="space-y-2">
							<label htmlFor="username" className="block text-sm font-medium text-slate-700">
								Email / Username
							</label>
							<div className="relative">
								<Mail
									aria-hidden
									className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
								/>
								<input
									id="username"
									type="text"
									autoComplete="username"
									value={form.username}
									onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
									placeholder="Masukkan email akun"
									required
									className={fieldClasses("control", "pl-9")}
								/>
							</div>
						</div>

						<div className="space-y-2">
							<label htmlFor="password" className="block text-sm font-medium text-slate-700">
								Password
							</label>
							<div className="relative">
								<Lock
									aria-hidden
									className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
								/>
								<input
									id="password"
									type="password"
									autoComplete="current-password"
									value={form.password}
									onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
									placeholder="Masukkan password"
									required
									className={fieldClasses("control", "pl-9")}
								/>
							</div>
						</div>

						<Button type="submit" block disabled={isLoading} className="mt-1">
							{isLoading ? "Memproses..." : "Masuk"}
						</Button>
					</form>
				</div>

				<p className="type-body mt-6 text-center text-slate-500">
					&copy; 2026 CV. Pridata Jaya. Seluruh hak cipta dilindungi.
				</p>
			</main>
		</div>
	);
}
