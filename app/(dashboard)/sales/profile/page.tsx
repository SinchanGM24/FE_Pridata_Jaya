"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AvatarCropModal from "@/components/shared/AvatarCropModal";
import Card, { CardHeader } from "@/components/shared/Card";
import FormInput, { fieldClasses } from "@/components/shared/FormInput";
import Skeleton from "@/components/shared/Skeleton";
import PageFeedback from "@/components/shared/PageFeedback";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { setUserInStorage } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import { filesService } from "@/services/files";
import { meService, type MyProfile } from "@/services/me";
import Button from "@/components/shared/Button";

const buildInitials = (value: string) => {
	const words = String(value || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return "SL";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
};

const SALES_PROFILE_UPDATED_EVENT = "sales-profile-updated";

const toDateInputValue = (value?: string | null) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
	return date.toISOString().slice(0, 10);
};

const toIsoDateTime = (value: string) => {
	if (!value) return null;
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
						birthDate: toDateInputValue(data.profile?.birthDate),
						gender: data.profile?.gender ?? "",
						phoneNumber: data.profile?.phoneNumber ?? "",
						address: data.profile?.address ?? "",
						city: data.profile?.city ?? "",
						province: data.profile?.province ?? "",
						postalCode: data.profile?.postalCode ?? "",
						joinDate: toDateInputValue(data.profile?.joinDate),
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
								joinDate: toIsoDateTime(form.joinDate),
							}
						: {}),
					birthDate: toIsoDateTime(form.birthDate),
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
				birthDate: toDateInputValue(updated.profile?.birthDate),
				gender: updated.profile?.gender ?? "",
				phoneNumber: updated.profile?.phoneNumber ?? "",
				address: updated.profile?.address ?? "",
				city: updated.profile?.city ?? "",
				province: updated.profile?.province ?? "",
				postalCode: updated.profile?.postalCode ?? "",
				joinDate: toDateInputValue(updated.profile?.joinDate),
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
			window.dispatchEvent(new CustomEvent(SALES_PROFILE_UPDATED_EVENT, { detail: updated }));
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
			<PageFeedback
				error={error}
				success={success}
				onDismissError={() => setError(null)}
				onDismissSuccess={() => setSuccess(null)}
			/>
			{loading ? (
				<Card>
					<Skeleton className="h-5 w-40" />
					<Skeleton className="mt-3 h-4 w-64" />
				</Card>
			) : null}

			{/*
			 * Baris empat tile ringkasan (Nama / Email / NIK / Telepon) dihapus:
			 * keempat nilainya adalah field yang bisa diedit persis di bawahnya.
			 * Menampilkan angka yang sama dua kali dalam satu layar bukan hierarki,
			 * itu cuma pengulangan yang memaksa mata memilih mana yang benar.
			 */}
			<Card>
				<CardHeader title="Profil Akun" />
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
						<FormInput
							label="Nama"
							value={form.name}
							onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
						/>
						<FormInput
							label="Email"
							type="email"
							value={form.email}
							onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
						/>
						<label className="space-y-2 md:col-span-2">
							<span className="block text-sm font-medium text-slate-700">Foto Profil</span>
							<p className="type-body text-slate-500">
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
									className="block w-full max-w-sm text-xs text-slate-600 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-4 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-50 md:file:min-h-9"
								/>
								{form.image ? (
									<Button
										variant="secondary"
										size="sm"
										onClick={() => {
											setForm((prev) => ({ ...prev, image: "" }));
											if (avatarInputRef.current) {
												avatarInputRef.current.value = "";
											}
										}}
										disabled={uploadingAvatar}
									>
										Hapus Foto
									</Button>
								) : null}
							</div>
							{uploadingAvatar ? (
								<p className="type-body text-slate-500">Mengunggah foto...</p>
							) : null}
						</label>
					</div>
				</div>
			</Card>

			<Card>
				<CardHeader
					title="Data Diri Sales"
					description="Sales dapat memperbarui data diri sendiri. NIK dan tanggal bergabung hanya dapat diubah owner atau admin."
				/>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<FormInput
						label="NIK"
						value={form.identityNumber}
						readOnly={!profile?.canEditSensitiveProfileFields}
						onChange={(event) => setForm((prev) => ({ ...prev, identityNumber: event.target.value }))}
						className={profile?.canEditSensitiveProfileFields ? "" : "bg-slate-100 text-slate-500"}
					/>
					<FormInput
						label="Tanggal Bergabung"
						type="date"
						value={form.joinDate}
						readOnly={!profile?.canEditSensitiveProfileFields}
						onChange={(event) => setForm((prev) => ({ ...prev, joinDate: event.target.value }))}
						className={profile?.canEditSensitiveProfileFields ? "" : "bg-slate-100 text-slate-500"}
					/>
					<FormInput
						label="Tanggal Lahir"
						type="date"
						value={form.birthDate}
						onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))}
					/>
					<label className="space-y-2">
						<span className="block text-sm font-medium text-slate-700">Jenis Kelamin</span>
						<select
							value={form.gender}
							onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
							className={fieldClasses()}
						>
							<option value="">Pilih Jenis Kelamin</option>
							<option value="MALE">Laki-laki</option>
							<option value="FEMALE">Perempuan</option>
						</select>
					</label>
					<FormInput
						label="Nomor Telepon"
						value={form.phoneNumber}
						onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
					/>
					<FormInput
						label="Kota"
						value={form.city}
						onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
					/>
					<FormInput
						label="Provinsi"
						value={form.province}
						onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))}
					/>
					<FormInput
						label="Kode Pos"
						value={form.postalCode}
						onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
					/>
					<label className="space-y-2 md:col-span-2">
						<span className="block text-sm font-medium text-slate-700">Alamat Lengkap</span>
						<textarea
							value={form.address}
							onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
							className={fieldClasses("area")}
						/>
					</label>
				</div>
				<div className="mt-5 flex justify-end">
					<Button onClick={handleSave} disabled={saving}>
						{saving ? "Menyimpan..." : "Simpan Profil"}
					</Button>
				</div>
			</Card>

			<Card>
				<CardHeader
					title="Ganti Password"
					description="Perbarui password akun sales dengan memasukkan password lama dan password baru."
				/>
				<div className="mt-4 grid gap-4 md:grid-cols-3">
					<FormInput
						label="Password Lama"
						type="password"
						autoComplete="current-password"
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.target.value)}
					/>
					<FormInput
						label="Password Baru"
						type="password"
						autoComplete="new-password"
						value={newPassword}
						onChange={(event) => setNewPassword(event.target.value)}
					/>
					<FormInput
						label="Konfirmasi Password Baru"
						type="password"
						autoComplete="new-password"
						value={confirmPassword}
						onChange={(event) => setConfirmPassword(event.target.value)}
					/>
				</div>
				<Button
					variant="secondary"
					className="mt-4"
					onClick={handleChangePassword}
					disabled={savingPassword}
				>
					{savingPassword ? "Menyimpan..." : "Simpan Password"}
				</Button>
			</Card>
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
