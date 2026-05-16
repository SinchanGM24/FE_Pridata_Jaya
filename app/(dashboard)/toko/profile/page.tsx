"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { meService, type MyProfile } from "@/services/me";
import { authService } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { setUserInStorage } from "@/lib/auth";
import { readTokoCart } from "@/services/toko-cart";
import { citiesService, type City } from "@/services/cities";

const buildInitials = (value: string) => {
	const words = String(value || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return "TK";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
};

export default function StoreProfilePage() {
	const { user, setUser } = useAuth();
	const [profile, setProfile] = useState<MyProfile | null>(null);
	const [form, setForm] = useState({ name: "", email: "", image: "" });
	const [storeForm, setStoreForm] = useState({
		name: "",
		email: "",
		phone: "",
		address: "",
		cityId: "",
	});
	const [cities, setCities] = useState<City[]>([]);
	const [cartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [savingStore, setSavingStore] = useState(false);
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

					const cityRows = await citiesService.listAll({
						sortBy: "name",
						sortOrder: "asc",
					});

					if (cancelled) return;
					setCities(cityRows);
					setStoreForm({
						name: data.store?.name ?? "",
						email: data.store?.email ?? "",
						phone: data.store?.phone ?? "",
						address: data.store?.address ?? "",
						cityId: data.store?.cityId ?? "",
					});
				} catch (loadError: unknown) {
					if (cancelled) return;
					setError(getApiErrorMessage(loadError, "Gagal memuat profil toko."));
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

	const initials = useMemo(
		() => buildInitials(profile?.store?.name || form.name || form.email),
		[form.email, form.name, profile?.store?.name],
	);

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
			setSuccess("Profil berhasil diperbarui.");
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menyimpan profil akun."));
		} finally {
			setSaving(false);
		}
	};

	const handleSaveStore = async () => {
		if (!profile?.store?.id) {
			setError("Data toko belum tersedia.");
			return;
		}
		if (!storeForm.name.trim()) {
			setError("Nama toko wajib diisi.");
			return;
		}
		if (!storeForm.email.trim()) {
			setError("Email toko wajib diisi.");
			return;
		}
		if (!storeForm.phone.trim()) {
			setError("Telepon toko wajib diisi.");
			return;
		}
		if (!storeForm.address.trim()) {
			setError("Alamat toko wajib diisi.");
			return;
		}
		if (!storeForm.cityId) {
			setError("Kota toko wajib dipilih.");
			return;
		}

		setSavingStore(true);
		setError(null);
		setSuccess(null);
		try {
			const updated = await meService.updateProfile({
				store: {
					name: storeForm.name.trim(),
					email: storeForm.email.trim(),
					phone: storeForm.phone.trim(),
					address: storeForm.address.trim(),
					cityId: storeForm.cityId,
				},
			});
			setProfile(updated);
			setStoreForm({
				name: updated.store?.name ?? "",
				email: updated.store?.email ?? "",
				phone: updated.store?.phone ?? "",
				address: updated.store?.address ?? "",
				cityId: updated.store?.cityId ?? "",
			});
			setSuccess("Profil toko berhasil diperbarui.");
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menyimpan profil toko."));
		} finally {
			setSavingStore(false);
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
			if (!ok) throw new Error("Gagal mengirim link reset password.");
			setSuccess("Link reset password sudah dikirim ke email.");
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal mengirim link reset password."));
		} finally {
			setSendingReset(false);
		}
	};

	return (
		<TokoFeatureLayout
			title="Profil Toko"
			cartCount={cartCount}
			profileName={profile?.store?.name || profile?.name || "Toko"}
			profileRoleLabel="Toko"
			salesName={profile?.store?.assignedSalesUser?.name ?? null}
		>
			{loading ? (
				<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
					Memuat profil toko...
				</div>
			) : null}
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex items-center gap-4">
					{form.image ? (
						<Image
							src={form.image}
							alt="Foto profil"
							width={64}
							height={64}
							unoptimized
							className="h-16 w-16 rounded-full border border-slate-200 object-cover"
						/>
					) : (
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700">
							{initials}
						</div>
					)}
					<div>
						<p className="text-lg font-bold text-slate-900">
							{profile?.store?.name || profile?.name || "Toko"}
						</p>
						<p className="text-sm text-slate-500">
							Role organisasi: {profile?.organizationRole || "store_customer"}
						</p>
						<p className="text-sm text-slate-500">
							Sales afiliasi: {profile?.store?.assignedSalesUser?.name ?? "Belum ditugaskan"}
						</p>
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Nama Toko", value: profile?.store?.name ?? "-" },
					{ label: "Status Verifikasi", value: profile?.store?.verificationStatus ?? "-" },
					{ label: "Email Toko", value: profile?.store?.email ?? "-" },
					{ label: "Telepon Toko", value: profile?.store?.phone ?? "-" },
					{ label: "Kota", value: profile?.store?.city ? `${profile.store.city.name}, ${profile.store.city.province}` : "-" },
					{ label: "Sales Penanggung Jawab", value: profile?.store?.assignedSalesUser?.name ?? "Belum ditugaskan" },
					{ label: "Email Sales", value: profile?.store?.assignedSalesUser?.email ?? "-" },
				].map((item) => (
					<div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-3 text-sm font-semibold text-slate-900">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Akun Login</h2>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Nama
						</span>
						<input
							value={form.name}
							onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Email
						</span>
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
				<div className="mt-4 flex flex-wrap gap-3">
					<button
						type="button"
						onClick={() => void handleSave()}
						disabled={saving}
						className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
					>
						{saving ? "Menyimpan..." : "Simpan Profil"}
					</button>
					<button
						type="button"
						onClick={() => void handleResetPassword()}
						disabled={sendingReset}
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						{sendingReset ? "Mengirim..." : "Kirim Link Reset Password"}
					</button>
				</div>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Profil Toko</h2>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Nama Toko
						</span>
						<input
							value={storeForm.name}
							onChange={(event) => setStoreForm((prev) => ({ ...prev, name: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Email Toko
						</span>
						<input
							type="email"
							value={storeForm.email}
							onChange={(event) => setStoreForm((prev) => ({ ...prev, email: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Telepon
						</span>
						<input
							value={storeForm.phone}
							onChange={(event) => setStoreForm((prev) => ({ ...prev, phone: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Kota
						</span>
						<select
							value={storeForm.cityId}
							onChange={(event) => setStoreForm((prev) => ({ ...prev, cityId: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						>
							<option value="">Pilih kota</option>
							{cities.map((city) => (
								<option key={city.id} value={city.id}>
									{city.name}, {city.province}
								</option>
							))}
						</select>
					</label>
					<label className="space-y-1 md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Alamat
						</span>
						<textarea
							value={storeForm.address}
							onChange={(event) => setStoreForm((prev) => ({ ...prev, address: event.target.value }))}
							className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
						/>
					</label>
				</div>
				<div className="mt-4 flex flex-wrap gap-3">
					<button
						type="button"
						onClick={() => void handleSaveStore()}
						disabled={savingStore || !profile?.store?.id}
						className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
					>
						{savingStore ? "Menyimpan..." : "Simpan Profil Toko"}
					</button>
				</div>
			</section>
		</TokoFeatureLayout>
	);
}
