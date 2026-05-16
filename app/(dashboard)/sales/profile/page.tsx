"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { setUserInStorage } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { meService, type MyProfile } from "@/services/me";

const buildInitials = (value: string) => {
	const words = String(value || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return "SL";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
};

export default function SalesProfilePage() {
	const { user, setUser } = useAuth();
	const [profile, setProfile] = useState<MyProfile | null>(null);
	const [form, setForm] = useState({ name: "", email: "", image: "" });
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [sendingReset, setSendingReset] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const data = await meService.getProfile();
					if (cancelled) return;
					setProfile(data);
					setForm({
						name: data.name ?? "",
						email: data.email ?? "",
						image: data.image ?? "",
					});
				} catch (loadError: unknown) {
					if (!cancelled) {
						setError(getApiErrorMessage(loadError, "Gagal memuat profil sales."));
					}
				} finally {
					if (!cancelled) {
						setLoading(false);
					}
				}
			})();
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, []);

	const initials = useMemo(() => buildInitials(form.name || form.email), [form.email, form.name]);

	const handleSave = async () => {
		if (!form.name.trim() || !form.email.trim()) {
			setError("Nama dan email wajib diisi.");
			return;
		}

		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			const updated = await meService.updateProfile({
				name: form.name.trim(),
				email: form.email.trim(),
				image: form.image.trim() ? form.image.trim() : null,
			});
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
			setSuccess("Profil sales berhasil diperbarui.");
		} catch (saveError: unknown) {
			setError(getApiErrorMessage(saveError, "Gagal menyimpan profil sales."));
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
			const ok = await authService.resetPassword(email);
			if (!ok) {
				throw new Error("Gagal mengirim link reset password.");
			}
			setSuccess("Link reset password sudah dikirim ke email.");
		} catch (resetError: unknown) {
			setError(getApiErrorMessage(resetError, "Gagal mengirim link reset password."));
		} finally {
			setSendingReset(false);
		}
	};

	return (
		<TokoFeatureLayout
			title="Profil Sales"
			profileName={profile?.name || "Sales Representative"}
			profileRoleLabel="Sales"
		>
			{loading ? (
				<div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
					Memuat profil...
				</div>
			) : null}
			{error ? (
				<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
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
				<h2 className="text-lg font-semibold text-slate-900">Profil Akun</h2>
				<div className="mt-4 grid gap-6 md:grid-cols-[140px_1fr]">
					<div className="flex items-center justify-center md:justify-start">
						{form.image ? (
							<Image
								src={form.image}
								alt="Foto profil sales"
								width={96}
								height={96}
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
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama</span>
							<input
								value={form.name}
								onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
								className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
							/>
						</label>
						<label className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
							<input
								type="email"
								value={form.email}
								onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
								className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
							/>
						</label>
						<label className="space-y-1 md:col-span-2">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Foto Profil (URL)
							</span>
							<input
								value={form.image}
								onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))}
								className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
								placeholder="https://..."
							/>
						</label>
					</div>
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
				>
					{saving ? "Menyimpan..." : "Simpan Profil"}
				</button>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Reset Password</h2>
				<p className="mt-2 text-sm text-slate-600">
					Kirim link reset password ke email akun sales yang aktif.
				</p>
				<button
					type="button"
					onClick={handleResetPassword}
					disabled={sendingReset}
					className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
				>
					{sendingReset ? "Mengirim..." : "Kirim Link Reset"}
				</button>
			</section>
		</TokoFeatureLayout>
	);
}
