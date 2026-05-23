"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AvatarCropModal from "@/components/shared/AvatarCropModal";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { setUserInStorage } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { filesService } from "@/services/files";
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
			});
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
			setSuccess("Profil sales berhasil diperbarui.");
		} catch (saveError: unknown) {
			setError(getApiErrorMessage(saveError, "Gagal menyimpan profil sales."));
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
		} catch (changePasswordError: unknown) {
			setError(getApiErrorMessage(changePasswordError, "Gagal mengubah password."));
		} finally {
			setSavingPassword(false);
		}
	};

	return (
		<SalesPortalShell title="Profil Sales" profileName={form.name || profile?.name || "Sales Representative"}>
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
								alt="Foto profil sales"
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
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Foto Profil</span>
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
					className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
				>
					{saving ? "Menyimpan..." : "Simpan Profil"}
				</button>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Data Diri Sales</h2>
				<p className="mt-2 text-sm text-slate-600">
					Sales dapat memperbarui data diri sendiri. NIK dan tanggal bergabung hanya dapat diubah owner atau admin.
				</p>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">NIK</span>
						<input
							value={form.identityNumber}
							readOnly={!profile?.canEditSensitiveProfileFields}
							onChange={(event) => setForm((prev) => ({ ...prev, identityNumber: event.target.value }))}
							className={`h-10 w-full rounded-lg border border-slate-300 px-3 text-sm ${profile?.canEditSensitiveProfileFields ? "" : "bg-slate-100 text-slate-500"}`}
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Bergabung</span>
						<input
							type="date"
							value={form.joinDate}
							readOnly={!profile?.canEditSensitiveProfileFields}
							onChange={(event) => setForm((prev) => ({ ...prev, joinDate: event.target.value }))}
							className={`h-10 w-full rounded-lg border border-slate-300 px-3 text-sm ${profile?.canEditSensitiveProfileFields ? "" : "bg-slate-100 text-slate-500"}`}
						/>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Lahir</span>
						<input type="date" value={form.birthDate} onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis Kelamin</span>
						<select value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
							<option value="">Pilih Jenis Kelamin</option>
							<option value="Laki-laki">Laki-laki</option>
							<option value="Perempuan">Perempuan</option>
						</select>
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Telepon</span>
						<input value={form.phoneNumber} onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kota</span>
						<input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provinsi</span>
						<input value={form.province} onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<label className="space-y-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kode Pos</span>
						<input value={form.postalCode} onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
					</label>
					<label className="space-y-1 md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alamat Lengkap</span>
						<textarea value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
					</label>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Ganti Password</h2>
				<p className="mt-2 text-sm text-slate-600">
					Perbarui password akun sales dengan memasukkan password lama dan password baru.
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
					onClick={handleChangePassword}
					disabled={savingPassword}
					className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
				>
					{savingPassword ? "Menyimpan..." : "Simpan Password"}
				</button>
			</section>
			<AvatarCropModal
				key={avatarSourceFile ? `${avatarSourceFile.name}-${avatarSourceFile.size}-${avatarSourceFile.lastModified}` : "sales-avatar-crop"}
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
		</SalesPortalShell>
	);
}
