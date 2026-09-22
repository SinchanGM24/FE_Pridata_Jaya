"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AvatarCropModal from "@/components/shared/AvatarCropModal";
import PageFeedback from "@/components/shared/PageFeedback";
import SearchCombobox from "@/components/shared/SearchCombobox";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { meService, type MyProfile } from "@/services/me";
import { authService } from "@/services/auth";
import { filesService } from "@/services/files";
import { useAuth } from "@/hooks/useAuth";
import { setUserInStorage } from "@/lib/auth";
import { readTokoCart } from "@/services/toko-cart";
import { citiesService } from "@/services/cities";

const TOKO_PROFILE_UPDATED_EVENT = "toko-profile-updated";

const buildInitials = (value: string) => {
	const words = String(value || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return "TK";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
};

const storeTypeLabel: Record<string, string> = {
	RETAILER: "Retail",
	WHOLESALER: "Grosir",
	DISTRIBUTOR: "Distributor",
};

export default function StoreProfilePage() {
	const { user, setUser } = useAuth();
	const [profile, setProfile] = useState<MyProfile | null>(null);
	const [form, setForm] = useState({
		name: "",
		email: "",
		image: "",
		gender: "",
		phoneNumber: "",
	});
	const [storeForm, setStoreForm] = useState({
		name: "",
		phone: "",
		address: "",
		cityId: "",
	});
	const [cartCount] = useState(() =>
		readTokoCart().reduce((sum, item) => sum + item.quantity, 0),
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [savingStore, setSavingStore] = useState(false);
	const [avatarSourceFile, setAvatarSourceFile] = useState<File | null>(null);
	const [avatarCropOpen, setAvatarCropOpen] = useState(false);
	const avatarInputRef = useRef<HTMLInputElement | null>(null);
	const [uploadingAvatar, setUploadingAvatar] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
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
						gender: data.profile?.gender ?? "",
						phoneNumber: data.profile?.phoneNumber ?? "",
					});

					setStoreForm({
						name: data.store?.name ?? "",
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

	const handleSave = async (imageOverride = form.image) => {
		if (!form.name.trim()) {
			setError("Nama wajib diisi.");
			return false;
		}
		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			const updated = await meService.updateProfile({
				name: form.name.trim(),
				image: imageOverride.trim() ? imageOverride.trim() : null,
				profile: {
					gender: form.gender || null,
					phoneNumber: form.phoneNumber.trim() || null,
				},
			});
			setProfile(updated);
			setForm({
				name: updated.name ?? "",
				email: updated.email ?? form.email,
				image: updated.image ?? "",
				gender: updated.profile?.gender ?? "",
				phoneNumber: updated.profile?.phoneNumber ?? "",
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
			window.dispatchEvent(new CustomEvent(TOKO_PROFILE_UPDATED_EVENT, { detail: updated }));
			setSuccess("Profil berhasil diperbarui.");
			return true;
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menyimpan profil akun."));
			return false;
		} finally {
			setSaving(false);
		}
	};

	const handleSaveStore = async () => {
		if (!profile?.store?.id) {
			setError("Data toko belum tersedia.");
			return false;
		}
		if (!storeForm.name.trim()) {
			setError("Nama toko wajib diisi.");
			return false;
		}
		if (!storeForm.phone.trim()) {
			setError("Telepon toko wajib diisi.");
			return false;
		}
		if (!storeForm.address.trim()) {
			setError("Alamat toko wajib diisi.");
			return false;
		}
		if (!storeForm.cityId) {
			setError("Kota toko wajib dipilih.");
			return false;
		}

		setSavingStore(true);
		setError(null);
		setSuccess(null);
		try {
			const updated = await meService.updateProfile({
				store: {
					name: storeForm.name.trim(),
					phone: storeForm.phone.trim(),
					address: storeForm.address.trim(),
					cityId: storeForm.cityId,
				},
			});
			setProfile(updated);
			setStoreForm({
				name: updated.store?.name ?? "",
				phone: updated.store?.phone ?? "",
				address: updated.store?.address ?? "",
				cityId: updated.store?.cityId ?? "",
			});
			window.dispatchEvent(new CustomEvent(TOKO_PROFILE_UPDATED_EVENT, { detail: updated }));
			setSuccess("Profil toko berhasil diperbarui.");
			return true;
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal menyimpan profil toko."));
			return false;
		} finally {
			setSavingStore(false);
		}
	};

	const handleSaveProfileAndStore = async () => {
		if (!form.name.trim()) {
			setError("Nama pemilik / penanggung jawab wajib diisi.");
			return;
		}
		if (!profile?.store?.id) {
			setError("Data toko belum tersedia.");
			return;
		}
		if (!storeForm.name.trim() || !storeForm.phone.trim() || !storeForm.address.trim() || !storeForm.cityId) {
			setError("Lengkapi nama, telepon, kota, dan alamat toko terlebih dahulu.");
			return;
		}

		const profileSaved = await handleSave();
		if (profileSaved) {
			await handleSaveStore();
		}
	};

	const handleChangePassword = async () => {
		if (!currentPassword.trim() || !newPassword.trim()) {
			setError("Password lama dan password baru wajib diisi.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("Konfirmasi password baru tidak sesuai.");
			return;
		}

		setSavingPassword(true);
		setError(null);
		setSuccess(null);
		try {
			const ok = await authService.changePassword({
				currentPassword: currentPassword.trim(),
				newPassword: newPassword.trim(),
			});
			if (!ok) throw new Error("Gagal mengubah password.");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setSuccess("Password berhasil diubah.");
		} catch (changePasswordError: unknown) {
			setError(getApiErrorMessage(changePasswordError, "Gagal mengubah password."));
		} finally {
			setSavingPassword(false);
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
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError(null)}
				onDismissSuccess={() => setSuccess(null)}
			/>
			{loading ? (
				<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
					Memuat profil toko...
				</div>
			) : null}
			{profile?.store && profile.store.verificationStatus !== "VERIFIED" ? (
				<section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
					<p className="font-semibold">Akun toko belum terverifikasi.</p>
					<p className="mt-1 text-amber-800">Anda belum dapat berbelanja sampai proses verifikasi toko selesai.</p>
				</section>
			) : null}

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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

			<section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{ label: "Nama Toko", value: profile?.store?.name ?? "-" },
					{ label: "Jenis Toko", value: storeTypeLabel[profile?.store?.storeType ?? ""] ?? profile?.store?.storeType ?? "-" },
					{ label: "Telepon Toko", value: profile?.store?.phone ?? "-" },
					{ label: "Kota", value: profile?.store?.city ? `${profile.store.city.name}, ${profile.store.city.province}` : "-" },
					{ label: "Sales Penanggung Jawab", value: profile?.store?.assignedSalesUser?.name ?? "Belum ditugaskan" },
					{ label: "Email Sales", value: profile?.store?.assignedSalesUser?.email ?? "-" },
					{ label: "Nomor Sales", value: profile?.store?.assignedSalesUser?.phoneNumber ?? "-" },
				].map((item) => (
					<div key={item.label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
						<p className="mt-1 break-words text-xs font-semibold text-slate-900 sm:mt-3 sm:text-sm">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">Profil Toko</h2>
				<label className="mt-4 block space-y-1">
					<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Foto Profil
					</span>
					<p className="text-xs text-slate-500">
						Pilih foto lalu sesuaikan crop. Foto akan langsung tersimpan setelah digunakan.
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<input
							ref={avatarInputRef}
							type="file"
							accept="image/*"
							disabled={uploadingAvatar || saving}
							onChange={(event) => {
								const file = event.target.files?.[0] ?? null;
								if (!file) return;
								setError(null);
								setSuccess(null);
								setAvatarSourceFile(file);
								setAvatarCropOpen(true);
							}}
							className="block w-full max-w-sm text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50"
						/>
					</div>
					{uploadingAvatar ? <p className="text-xs text-slate-500">Mengunggah dan menyimpan foto...</p> : null}
				</label>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Nama Pemilik / Penanggung Jawab
						</span>
						<input
							value={form.name}
							onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Email Login
						</span>
						<input
							type="email"
							value={form.email}
							readOnly
							className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600"
						/>
					</label>
				</div>
				<div className="mt-4">
					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis Kelamin</span>
							<select value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
								<option value="">Pilih Jenis Kelamin</option>
								<option value="MALE">Laki-laki</option>
								<option value="FEMALE">Perempuan</option>
							</select>
						</label>
						<label className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Telepon Pemilik</span>
							<input value={form.phoneNumber} onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
						</label>
					</div>
				</div>
				<div className="mt-4">
				<div className="grid gap-4 md:grid-cols-2">
					<label className="space-y-1 md:col-span-2">
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
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Telepon Toko</span>
						<input value={storeForm.phone} onChange={(event) => setStoreForm((prev) => ({ ...prev, phone: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<SearchCombobox
						label="Kota"
						required
						value={storeForm.cityId}
						selectedOption={profile?.store?.city ? { value: profile.store.city.id, label: profile.store.city.name, description: profile.store.city.province } : null}
						loadOptions={async (query) => (await citiesService.search(query)).map((city) => ({ value: city.id, label: city.name, description: city.province }))}
						onChange={(cityId) => setStoreForm((prev) => ({ ...prev, cityId }))}
						disabled={savingStore}
						placeholder="Cari kota atau provinsi"
					/>
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
						onClick={() => void handleSaveProfileAndStore()}
						disabled={saving || savingStore || !profile?.store?.id}
						className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
					>
						{saving || savingStore ? "Menyimpan..." : "Simpan Perubahan"}
					</button>
				</div>
				</div>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">Ganti Password</h2>
				<p className="mt-2 text-sm text-slate-600">
					Perbarui password akun toko dengan memasukkan password lama dan password baru.
				</p>
				<div className="mt-4 grid gap-4 md:grid-cols-3">
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Password Lama
						</span>
						<input
							type="password"
							value={currentPassword}
							onChange={(event) => setCurrentPassword(event.target.value)}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Password Baru
						</span>
						<input
							type="password"
							value={newPassword}
							onChange={(event) => setNewPassword(event.target.value)}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Konfirmasi Password Baru
						</span>
						<input
							type="password"
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
				</div>
				<button
					type="button"
					onClick={() => void handleChangePassword()}
					disabled={savingPassword}
					className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
				>
					{savingPassword ? "Menyimpan..." : "Simpan Password"}
				</button>
			</section>
			<AvatarCropModal
				key={avatarSourceFile ? `${avatarSourceFile.name}-${avatarSourceFile.size}-${avatarSourceFile.lastModified}` : "store-avatar-crop"}
				isOpen={avatarCropOpen}
				file={avatarSourceFile}
				onClose={() => {
					setAvatarCropOpen(false);
					setAvatarSourceFile(null);
					if (avatarInputRef.current) {
						avatarInputRef.current.value = "";
					}
				}}
				onCropped={(croppedFile) => {
					void (async () => {
						try {
							setUploadingAvatar(true);
							setError(null);
							setSuccess(null);
							const uploaded = await filesService.uploadProfileImage(croppedFile);
							setForm((prev) => ({ ...prev, image: uploaded.url }));
							setAvatarCropOpen(false);
							setAvatarSourceFile(null);
							const saved = await handleSave(uploaded.url);
							if (saved) {
								setSuccess("Foto profil berhasil diunggah dan disimpan.");
							}
						} catch (cropError: unknown) {
							setError(getApiErrorMessage(cropError, "Gagal mengunggah foto profil."));
						} finally {
							setUploadingAvatar(false);
							if (avatarInputRef.current) {
								avatarInputRef.current.value = "";
							}
						}
					})();
				}}
			/>
		</TokoFeatureLayout>
	);
}
