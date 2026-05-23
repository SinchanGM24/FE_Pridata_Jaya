"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AvatarCropModal from "@/components/shared/AvatarCropModal";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { meService, type MyProfile } from "@/services/me";
import { authService } from "@/services/auth";
import { filesService } from "@/services/files";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/api-errors";
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
	const [form, setForm] = useState({
		name: "",
		email: "",
		image: "",
		identityNumber: "",
		birthDate: "",
		gender: "",
		phoneNumber: "",
		address: "",
		city: "",
		province: "",
		postalCode: "",
		joinDate: "",
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
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
						identityNumber: data.profile?.identityNumber ?? "",
						birthDate: data.profile?.birthDate ?? "",
						gender: data.profile?.gender ?? "",
						phoneNumber: data.profile?.phoneNumber ?? "",
						address: data.profile?.address ?? "",
						city: data.profile?.city ?? "",
						province: data.profile?.province ?? "",
						postalCode: data.profile?.postalCode ?? "",
						joinDate: data.profile?.joinDate ?? "",
					});
				} catch (error: unknown) {
					if (cancelled) return;
					setError(getApiErrorMessage(error, "Gagal memuat profil."));
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
				profile: {
					...(profile?.canEditSensitiveProfileFields
						? {
								identityNumber: form.identityNumber.trim() || null,
								joinDate: form.joinDate || null,
							}
						: {}),
					birthDate: form.birthDate || null,
					gender: form.gender || null,
					phoneNumber: form.phoneNumber.trim() || null,
					address: form.address.trim() || null,
					city: form.city.trim() || null,
					province: form.province.trim() || null,
					postalCode: form.postalCode.trim() || null,
				},
			};
			const updated = await meService.updateProfile(payload);
			setProfile(updated);
			setForm({
				name: updated.name ?? "",
				email: updated.email ?? "",
				image: updated.image ?? "",
				identityNumber: updated.profile?.identityNumber ?? "",
				birthDate: updated.profile?.birthDate ?? "",
				gender: updated.profile?.gender ?? "",
				phoneNumber: updated.profile?.phoneNumber ?? "",
				address: updated.profile?.address ?? "",
				city: updated.profile?.city ?? "",
				province: updated.profile?.province ?? "",
				postalCode: updated.profile?.postalCode ?? "",
				joinDate: updated.profile?.joinDate ?? "",
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
			setError(getApiErrorMessage(error, "Gagal menyimpan profil."));
		} finally {
			setSaving(false);
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
			if (!ok) {
				throw new Error("Gagal mengubah password.");
			}
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setSuccess("Password berhasil diubah.");
		} catch (error: unknown) {
			setError(getApiErrorMessage(error, "Gagal mengubah password."));
		} finally {
			setSavingPassword(false);
		}
	};

	const shouldShowStoreRelation =
		profile?.organizationRole === "sales" ||
		profile?.organizationRole === "store_customer" ||
		profile?.systemRole === "sales" ||
		profile?.systemRole === "store_customer";

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
					{ label: "NIK", value: profile?.profile?.identityNumber ?? "-" },
					{ label: "Telepon", value: profile?.profile?.phoneNumber ?? "-" },
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
								alt="Foto profil"
								width={96}
								height={96}
								unoptimized
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
								Foto Profil
							</span>
							<p className="text-xs text-slate-500">
								Pilih foto lalu sesuaikan crop. Foto akan ikut tersimpan saat profil disimpan.
							</p>
							<div className="flex flex-wrap items-center gap-3">
								<input
									ref={avatarInputRef}
									type="file"
									accept="image/*"
									disabled={uploadingAvatar}
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
								{form.image ? (
									<button
										type="button"
										onClick={() => {
											setForm((prev) => ({ ...prev, image: "" }));
											if (avatarInputRef.current) {
												avatarInputRef.current.value = "";
											}
										}}
										className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
										disabled={uploadingAvatar}
									>
										Hapus Foto
									</button>
								) : null}
							</div>
							{uploadingAvatar ? <p className="text-xs text-slate-500">Mengunggah foto...</p> : null}
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
				<h2 className="text-lg font-semibold text-slate-900">Data Diri</h2>
				<p className="mt-2 text-sm text-slate-600">
					Perbarui data diri akun. NIK dan tanggal bergabung hanya dapat diubah oleh owner atau admin.
				</p>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">NIK</span>
						<input
							value={form.identityNumber}
							readOnly={!profile?.canEditSensitiveProfileFields}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, identityNumber: event.target.value }))
							}
							className={`h-10 w-full rounded-lg border border-slate-300 px-3 text-sm ${
								profile?.canEditSensitiveProfileFields ? "" : "bg-slate-100 text-slate-500"
							}`}
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Bergabung</span>
						<input
							type="date"
							value={form.joinDate}
							readOnly={!profile?.canEditSensitiveProfileFields}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, joinDate: event.target.value }))
							}
							className={`h-10 w-full rounded-lg border border-slate-300 px-3 text-sm ${
								profile?.canEditSensitiveProfileFields ? "" : "bg-slate-100 text-slate-500"
							}`}
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Lahir</span>
						<input
							type="date"
							value={form.birthDate}
							onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis Kelamin</span>
						<select
							value={form.gender}
							onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						>
							<option value="">Pilih Jenis Kelamin</option>
							<option value="Laki-laki">Laki-laki</option>
							<option value="Perempuan">Perempuan</option>
						</select>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Telepon</span>
						<input
							value={form.phoneNumber}
							onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kota</span>
						<input
							value={form.city}
							onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provinsi</span>
						<input
							value={form.province}
							onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kode Pos</span>
						<input
							value={form.postalCode}
							onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
							className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
						/>
					</label>
					<label className="space-y-1 md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alamat Lengkap</span>
						<textarea
							value={form.address}
							onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
							className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
						/>
					</label>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Ganti Password</h2>
				<p className="mt-2 text-sm text-slate-600">
					Masukkan password lama dan password baru untuk memperbarui akses akun, seperti alur FE1.
				</p>
				<div className="mt-4 grid gap-4 md:grid-cols-3">
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password Lama</span>
						<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password Baru</span>
						<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Konfirmasi Password</span>
						<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
				</div>
				<button
					type="button"
					onClick={handleChangePassword}
					disabled={savingPassword}
					className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{savingPassword ? "Menyimpan..." : "Simpan Password"}
				</button>
			</section>

			{shouldShowStoreRelation ? (
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
			) : null}

			<AvatarCropModal
				key={avatarSourceFile ? `${avatarSourceFile.name}-${avatarSourceFile.size}-${avatarSourceFile.lastModified}` : "avatar-crop"}
				isOpen={avatarCropOpen}
				file={avatarSourceFile}
				onClose={() => {
					setAvatarCropOpen(false);
					setAvatarSourceFile(null);
					if (avatarInputRef.current) {
						avatarInputRef.current.value = "";
					}
				}}
				onCropped={(cropped) => {
					void (async () => {
						try {
							setUploadingAvatar(true);
							setError(null);
							setSuccess(null);
							const uploaded = await filesService.uploadProfileImage(cropped);
							setForm((prev) => ({ ...prev, image: uploaded.url }));
							setAvatarCropOpen(false);
							setAvatarSourceFile(null);
							setSuccess("Foto profil berhasil diunggah dan siap disimpan.");
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
		</FeaturePage>
	);
}
