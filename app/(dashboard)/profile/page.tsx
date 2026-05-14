"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { meService, type MyProfile } from "@/services/me";
import { authService } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { setUserInStorage } from "@/lib/auth";

const buildInitials = (value: string) => {
	const words = String(value || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return "US";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
};

export default function ProfilePage() {
	const { user, setUser } = useAuth();
	const [profile, setProfile] = useState<MyProfile | null>(null);
	const [form, setForm] = useState({ name: "", email: "", image: "" });
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [sendingReset, setSendingReset] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		meService
			.getProfile()
			.then((data) => {
				if (!mounted) return;
				setProfile(data);
				setForm({
					name: data.name ?? "",
					email: data.email ?? "",
					image: data.image ?? "",
				});
			})
			.catch((err) => {
				if (!mounted) return;
				setError(err?.response?.data?.message || "Gagal memuat profil.");
			})
			.finally(() => {
				if (!mounted) return;
				setLoading(false);
			});

		return () => {
			mounted = false;
		};
	}, []);

	const initials = useMemo(() => buildInitials(form.name || form.email), [form.name, form.email]);

	const handleSave = async () => {
		if (!form.name.trim()) {
			setError("Nama wajib diisi.");
			return;
		}
		if (!form.email.trim()) {
			setError("Email wajib diisi.");
			return;
		}

		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			const payload = {
				name: form.name.trim(),
				email: form.email.trim(),
				image: form.image.trim() ? form.image.trim() : null,
			};
			const updated = await meService.updateProfile(payload);
			setProfile(updated);
			setForm({
				name: updated.name ?? "",
				email: updated.email ?? "",
				image: updated.image ?? "",
			});
			if (user) {
				const nextUser = {
					...user,
					name: updated.name,
					email: updated.email,
					image: updated.image ?? undefined,
				};
				setUser(nextUser);
				setUserInStorage(nextUser);
			}
			setSuccess("Profil berhasil diperbarui.");
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal menyimpan profil.");
		} finally {
			setSaving(false);
		}
	};

	const handleResetPassword = async () => {
		const email = form.email.trim();
		if (!email) {
			setError("Email wajib diisi untuk reset password.");
			return;
		}
		setSendingReset(true);
		setError(null);
		setSuccess(null);
		try {
			await authService.resetPassword(email);
			setSuccess("Link reset password sudah dikirim ke email.");
		} catch (err: any) {
			setError(err?.message || "Gagal mengirim link reset password.");
		} finally {
			setSendingReset(false);
		}
	};

	return (
		<FeaturePage
			title="Profil Pengguna"
			description="Kelola profil akun aktif, termasuk nama, email, dan foto profil (URL)."
		>
			{loading ? (
				<div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
					Memuat profil...
				</div>
			) : null}
			{error ? (
				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
					{success}
				</div>
			) : null}
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Nama", value: profile?.name ?? "-" },
					{ label: "Email", value: profile?.email ?? "-" },
					{ label: "System Role", value: profile?.systemRole ?? "-" },
					{ label: "Org Role", value: profile?.organizationRole ?? "-" },
				].map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-lg font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Profil</h2>
				<div className="mt-4 grid gap-6 md:grid-cols-[140px_1fr]">
					<div className="flex items-center justify-center md:justify-start">
						{form.image ? (
							<img
								src={form.image}
								alt="Foto profil"
								className="h-24 w-24 rounded-full border border-slate-200 object-cover"
							/>
						) : (
							<div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-700">
								{initials}
							</div>
						)}
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Nama
							</span>
							<input
								value={form.name}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, name: event.target.value }))
								}
								className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
								placeholder="Nama lengkap"
							/>
						</label>
						<label className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Email
							</span>
							<input
								type="email"
								value={form.email}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, email: event.target.value }))
								}
								className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
								placeholder="email@domain.com"
							/>
						</label>
						<label className="space-y-1 md:col-span-2">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Foto Profil (URL)
							</span>
							<input
								value={form.image}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, image: event.target.value }))
								}
								className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
								placeholder="https://..."
							/>
							<p className="text-xs text-slate-500">
								Gunakan URL publik untuk foto profil.
							</p>
						</label>
					</div>
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{saving ? "Menyimpan..." : "Simpan Profil"}
				</button>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Reset Password</h2>
				<p className="mt-2 text-sm text-slate-600">
					Kirim link reset password ke email akun. Gunakan email yang sudah terdaftar.
				</p>
				<button
					type="button"
					onClick={handleResetPassword}
					disabled={sendingReset}
					className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{sendingReset ? "Mengirim..." : "Kirim Link Reset"}
				</button>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Relasi Toko</h2>
				{profile?.store ? (
					<div className="mt-4 grid gap-3 md:grid-cols-2">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nama Toko</p>
							<p className="mt-1 text-sm text-slate-900">{profile.store.name}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status Verifikasi</p>
							<p className="mt-1 text-sm text-slate-900">{profile.store.verificationStatus}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</p>
							<p className="mt-1 text-sm text-slate-900">{profile.store.email}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Telepon</p>
							<p className="mt-1 text-sm text-slate-900">{profile.store.phone}</p>
						</div>
					</div>
				) : (
					<p className="mt-4 text-sm text-slate-600">User aktif belum terhubung ke entitas toko.</p>
				)}
			</section>
		</FeaturePage>
	);
}

