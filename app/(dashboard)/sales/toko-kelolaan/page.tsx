"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import Modal from "@/components/shared/Modal";
import { getApiErrorMessage } from "@/lib/api-errors";
import { citiesService, type City } from "@/services/cities";
import { salesService } from "@/services/sales";
import { setSalesActingStoreProfile } from "@/services/sales-toko-cart";
import type { StoreGradeItem } from "@/services/grade";
import { storesService, type Store } from "@/services/stores";
import { useAuth } from "@/hooks/useAuth";

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const dateOnly = (value?: string | null) => String(value || "").slice(0, 10) || "-";

const isStoreActive = (store: StoreGradeItem) => store.isActive !== false;

const FieldLabel = ({
	label,
	children,
	className = "",
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
}) => (
	<label className={`space-y-1 text-sm text-slate-700 ${className}`}>
		<span className="font-medium">{label}</span>
		{children}
	</label>
);

export default function SalesManagedStoresPage() {
	const router = useRouter();
	const { user } = useAuth();
	const [stores, setStores] = useState<StoreGradeItem[]>([]);
	const [cities, setCities] = useState<City[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
	const [selectedStoreDetail, setSelectedStoreDetail] = useState<StoreGradeItem | null>(null);
	const [selectedStoreRecord, setSelectedStoreRecord] = useState<Store | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState("");
	const [form, setForm] = useState({
		ownerName: "",
		ownerEmail: "",
		ownerPassword: "",
		ownerNik: "",
		ownerNpwp: "",
		ownerNib: "",
		businessLicense: "",
		ownerBirthDate: "",
		ownerGender: "",
		ownerPhoneNumber: "",
		ownerAddress: "",
		ownerCity: "",
		ownerProvince: "",
		ownerPostalCode: "",
		storeName: "",
		phone: "",
		address: "",
		cityId: "",
		cityName: "",
		province: "",
		storeType: "RETAILER" as "RETAILER" | "WHOLESALER" | "DISTRIBUTOR",
		creditLimit: "0",
		yearsInBusiness: "0",
		estimatedMonthlyRevenue: "0",
		salesNotes: "",
	});

	const load = async () => {
		setLoading(true);
		try {
			const [storeRows, cityRows] = await Promise.all([
				salesService.getManagedStores(),
				citiesService.listAll({ sortBy: "name", sortOrder: "asc" }),
			]);
			setStores(storeRows);
			setCities(cityRows);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat toko kelolaan."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);

		return () => window.clearTimeout(timer);
	}, []);

	const rows = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return stores;
		return stores.filter(
			(store) =>
				store.storeName.toLowerCase().includes(query) ||
				(store.email ?? "").toLowerCase().includes(query),
		);
	}, [search, stores]);

	const handleOpenStoreDetail = async (store: StoreGradeItem) => {
		setSelectedStoreDetail(store);
		setSelectedStoreRecord(null);
		setDetailError("");
		setDetailLoading(true);
		try {
			const detail = await storesService.getById(store.storeId);
			setSelectedStoreRecord(detail);
		} catch (err: unknown) {
			setDetailError(getApiErrorMessage(err, "Gagal memuat detail data toko."));
		} finally {
			setDetailLoading(false);
		}
	};

	const handleSubmit = async () => {
		setSaving(true);
		setError("");
		setSuccess("");
		try {
			const ownerName = sanitizeText(form.ownerName);
			const ownerEmail = sanitizeText(form.ownerEmail).toLowerCase();
			const ownerPassword = form.ownerPassword.trim();
			const storeName = sanitizeText(form.storeName);
			const phone = form.phone.replace(/\s+/g, "").trim();
			const address = sanitizeText(form.address);
			const cityName = sanitizeText(form.cityName);
			const province = sanitizeText(form.province);
			const creditLimit = Number(form.creditLimit);
			const yearsInBusiness = Number(form.yearsInBusiness);
			const estimatedMonthlyRevenue = Number(form.estimatedMonthlyRevenue);

			if (
				!ownerName ||
				!ownerEmail ||
				!ownerPassword ||
				!storeName ||
				!phone ||
				!address ||
				(!form.cityId && (!cityName || !province))
			) {
				throw new Error("Lengkapi data pemilik, toko, alamat, serta pilih kota atau isi kota baru.");
			}

			if (ownerPassword.length < 6) {
				throw new Error("Password minimal 6 karakter.");
			}

			if (storeName.length < 3) {
				throw new Error("Nama toko minimal 3 karakter.");
			}

			if (address.length < 10) {
				throw new Error("Alamat minimal 10 karakter.");
			}

			const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
			if (!phoneRegex.test(phone)) {
				throw new Error("Nomor telepon tidak valid. Gunakan format: +62xxx, 62xxx, atau 0xxx (9-13 digit).");
			}

			const resolvedCityId = form.cityId
				? form.cityId
				: (
						await citiesService.create({
							name: cityName,
							province,
						})
					).id;

			await salesService.registerManagedStore({
				ownerName,
				ownerEmail,
				ownerPassword,
				ownerNik: sanitizeText(form.ownerNik) || undefined,
				ownerNpwp: sanitizeText(form.ownerNpwp) || undefined,
				ownerNib: sanitizeText(form.ownerNib) || undefined,
				businessLicense: sanitizeText(form.businessLicense) || undefined,
				ownerBirthDate: form.ownerBirthDate || undefined,
				ownerGender: sanitizeText(form.ownerGender) || undefined,
				ownerPhoneNumber: sanitizeText(form.ownerPhoneNumber) || undefined,
				ownerAddress: sanitizeText(form.ownerAddress) || undefined,
				ownerCity: sanitizeText(form.ownerCity) || undefined,
				ownerProvince: sanitizeText(form.ownerProvince) || undefined,
				ownerPostalCode: sanitizeText(form.ownerPostalCode) || undefined,
				storeName,
				phone,
				address,
				cityId: resolvedCityId,
				storeType: form.storeType,
				creditLimit: Number.isFinite(creditLimit) && creditLimit >= 0 ? creditLimit : 0,
				yearsInBusiness: Number.isFinite(yearsInBusiness) && yearsInBusiness >= 0 ? yearsInBusiness : 0,
				estimatedMonthlyRevenue:
					Number.isFinite(estimatedMonthlyRevenue) && estimatedMonthlyRevenue >= 0
						? estimatedMonthlyRevenue
						: 0,
				salesNotes: sanitizeText(form.salesNotes) || undefined,
			});
			setSuccess("Toko berhasil didaftarkan dan menunggu verifikasi fakturis.");
			setModalOpen(false);
			setForm({
				ownerName: "",
				ownerEmail: "",
				ownerPassword: "",
				ownerNik: "",
				ownerNpwp: "",
				ownerNib: "",
				businessLicense: "",
				ownerBirthDate: "",
				ownerGender: "",
				ownerPhoneNumber: "",
				ownerAddress: "",
				ownerCity: "",
				ownerProvince: "",
				ownerPostalCode: "",
				storeName: "",
				phone: "",
				address: "",
				cityId: "",
				cityName: "",
				province: "",
				storeType: "RETAILER",
				creditLimit: "0",
				yearsInBusiness: "0",
				estimatedMonthlyRevenue: "0",
				salesNotes: "",
			});
			await load();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal mendaftarkan toko."));
		} finally {
			setSaving(false);
		}
	};

	const handleActAsStore = (store: StoreGradeItem) => {
		setSalesActingStoreProfile({
			storeId: store.storeId,
			storeName: store.storeName,
			salesName: user?.name || "",
		});
		router.push(`/sales/toko-kelolaan/${store.storeId}/katalog`);
	};

	return (
		<SalesPortalShell title="Toko Kelolaan">
			{success ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}
			<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-lg font-semibold text-slate-800">
							Daftar Toko Kelolaan
						</p>
						<p className="text-sm text-slate-500">
							Registrasi toko baru ada di halaman ini. Purchase order
							dilakukan setelah memilih toko.
						</p>
					</div>
					<div className="flex gap-2">
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Cari toko atau email"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
						/>
						<button
							type="button"
							onClick={() => setModalOpen(true)}
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
						>
							Daftarkan Toko
						</button>
					</div>
				</div>
			</section>
			<section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				{loading ? (
					<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 lg:col-span-2">
						Memuat toko kelolaan...
					</div>
				) : null}
				{rows.map((store) => (
					<div key={store.storeId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
						<div className="mb-3">
							<p className="text-base font-semibold text-slate-900">{store.storeName}</p>
							<p className="text-sm text-slate-600">{store.email}</p>
						</div>
						<div className="mb-3 grid grid-cols-2 gap-2 text-sm">
							<div>
								<p className="text-slate-500">Grade</p>
								<p className="font-medium text-slate-900">{store.grade}</p>
							</div>
							<div>
								<p className="text-slate-500">Order</p>
								<p className="font-medium text-slate-900">{store.totalOrders}</p>
							</div>
							<div>
								<p className="text-slate-500">Sisa Tagihan</p>
								<p className="font-medium text-slate-900">{formatRupiah(store.totalOutstandingAmount)}</p>
							</div>
							<div>
								<p className="text-slate-500">Status</p>
								<span
									className={`rounded-full px-2 py-1 text-xs font-semibold ${
										isStoreActive(store)
											? "bg-emerald-100 text-emerald-700"
											: "bg-rose-100 text-rose-700"
									}`}
								>
									{isStoreActive(store) ? "Aktif" : "Nonaktif"}
								</span>
							</div>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => void handleOpenStoreDetail(store)}
								className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center"
							>
								Detail
							</button>
							<button
								type="button"
								onClick={() => handleActAsStore(store)}
								disabled={!isStoreActive(store)}
								className="flex-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
							>
								Masuk Sebagai Toko (PO)
							</button>
							<Link
								href={`/sales/riwayat-transaksi?storeId=${store.storeId}`}
								className="flex-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 text-center"
							>
								Riwayat
							</Link>
						</div>
					</div>
				))}
				{!loading && !rows.length ? (
					<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 lg:col-span-2">
						Belum ada toko kelolaan yang terdaftar.
					</div>
				) : null}
			</section>

			<Modal
				isOpen={Boolean(selectedStoreDetail)}
				onClose={() => setSelectedStoreDetail(null)}
				title={selectedStoreDetail ? `Detail ${selectedStoreDetail.storeName}` : "Detail Toko"}
			>
				{selectedStoreDetail ? (
					<div className="space-y-4 text-sm text-slate-700">
						{detailError ? (
							<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								{detailError}
							</div>
						) : null}
						{detailLoading ? (
							<p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
								Memuat data toko...
							</p>
						) : null}
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="text-xs text-slate-500">Nama Toko</p>
								<p className="font-semibold text-slate-900">
									{selectedStoreRecord?.name ?? selectedStoreDetail.storeName}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Email</p>
								<p className="font-semibold text-slate-900">
									{selectedStoreRecord?.email ?? selectedStoreDetail.email ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Telepon Toko</p>
								<p className="font-semibold text-slate-900">{selectedStoreRecord?.phone ?? "-"}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Jenis Toko</p>
								<p className="font-semibold text-slate-900">{selectedStoreRecord?.storeType ?? "-"}</p>
							</div>
							<div className="md:col-span-2">
								<p className="text-xs text-slate-500">Alamat Toko</p>
								<p className="font-semibold text-slate-900">{selectedStoreRecord?.address ?? "-"}</p>
								<p className="text-xs text-slate-500">
									{selectedStoreRecord?.city?.name ?? "-"}
									{selectedStoreRecord?.city?.province ? `, ${selectedStoreRecord.city.province}` : ""}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Grade</p>
								<p className="font-semibold text-slate-900">{selectedStoreDetail.grade}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status Toko</p>
								<p className="font-semibold text-slate-900">
									{isStoreActive(selectedStoreDetail) ? "Aktif" : "Nonaktif"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Status Verifikasi</p>
								<p className="font-semibold text-slate-900">{selectedStoreDetail.verificationStatus}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Total Order</p>
								<p className="font-semibold text-slate-900">{selectedStoreDetail.totalOrders}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Total Invoice</p>
								<p className="font-semibold text-slate-900">{selectedStoreDetail.totalInvoices}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Limit Kredit</p>
								<p className="font-semibold text-slate-900">
									{formatRupiah(selectedStoreDetail.creditLimit)}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Sisa Tagihan</p>
								<p className="font-semibold text-slate-900">
									{formatRupiah(selectedStoreDetail.totalOutstandingAmount)}
								</p>
							</div>
						</div>

						<div className="rounded-lg border border-slate-200 p-4">
							<p className="mb-3 text-sm font-semibold text-slate-900">Legalitas Toko</p>
							<div className="grid gap-3 md:grid-cols-2">
								<div>
									<p className="text-xs text-slate-500">NIB</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.documents?.ownerNib ?? "-"}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">NPWP</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.documents?.ownerNpwp ?? "-"}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Izin Usaha</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.documents?.businessLicense ?? "-"}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Lama Usaha</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.documents?.yearsInBusiness ?? "-"} tahun
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg border border-slate-200 p-4">
							<p className="mb-3 text-sm font-semibold text-slate-900">Data Diri Pemilik</p>
							<div className="grid gap-3 md:grid-cols-2">
								<div>
									<p className="text-xs text-slate-500">Nama Pemilik</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.user?.name ??
											selectedStoreRecord?.documents?.ownerName ??
											"-"}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Email Login</p>
									<p className="font-semibold text-slate-900">{selectedStoreRecord?.user?.email ?? "-"}</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">NIK</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.user?.profile?.identityNumber ??
											selectedStoreRecord?.documents?.ownerNik ??
											"-"}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Tanggal Lahir</p>
									<p className="font-semibold text-slate-900">
										{dateOnly(selectedStoreRecord?.user?.profile?.birthDate)}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Gender</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.user?.profile?.gender ?? "-"}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Telepon Pemilik</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.user?.profile?.phoneNumber ?? "-"}
									</p>
								</div>
								<div className="md:col-span-2">
									<p className="text-xs text-slate-500">Alamat Pemilik</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.user?.profile?.address ?? "-"}
									</p>
									<p className="text-xs text-slate-500">
										{[
											selectedStoreRecord?.user?.profile?.city,
											selectedStoreRecord?.user?.profile?.province,
											selectedStoreRecord?.user?.profile?.postalCode,
										]
											.filter(Boolean)
											.join(", ") || "-"}
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg border border-slate-200 p-4">
							<p className="text-xs text-slate-500">Catatan Grade</p>
							<p className="mt-1 text-slate-700">{selectedStoreDetail.gradeReason || "-"}</p>
						</div>
					</div>
				) : null}
			</Modal>

			<Modal
				isOpen={modalOpen}
				onClose={() => {
					setModalOpen(false);
					setError("");
				}}
				title="Daftarkan Toko"
			>
				<div className="space-y-4">
					{error ? (
						<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{error}
						</div>
					) : null}
					<div className="grid gap-4 md:grid-cols-2">
						<FieldLabel label="Nama Pemilik">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Email Login Toko">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="email" value={form.ownerEmail} onChange={(e) => setForm((p) => ({ ...p, ownerEmail: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Password Login">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="password" value={form.ownerPassword} onChange={(e) => setForm((p) => ({ ...p, ownerPassword: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Nama Toko">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.storeName} onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="NIK Pemilik">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerNik} onChange={(e) => setForm((p) => ({ ...p, ownerNik: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Tanggal Lahir Pemilik">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={form.ownerBirthDate} onChange={(e) => setForm((p) => ({ ...p, ownerBirthDate: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Gender Pemilik">
							<select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerGender} onChange={(e) => setForm((p) => ({ ...p, ownerGender: e.target.value }))}>
								<option value=""></option>
								<option value="Laki-laki">Laki-laki</option>
								<option value="Perempuan">Perempuan</option>
							</select>
						</FieldLabel>
						<FieldLabel label="Telepon Pemilik">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerPhoneNumber} onChange={(e) => setForm((p) => ({ ...p, ownerPhoneNumber: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Kota Pemilik">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerCity} onChange={(e) => setForm((p) => ({ ...p, ownerCity: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Provinsi Pemilik">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerProvince} onChange={(e) => setForm((p) => ({ ...p, ownerProvince: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Kode Pos Pemilik">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerPostalCode} onChange={(e) => setForm((p) => ({ ...p, ownerPostalCode: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="NPWP">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerNpwp} onChange={(e) => setForm((p) => ({ ...p, ownerNpwp: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="NIB">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerNib} onChange={(e) => setForm((p) => ({ ...p, ownerNib: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Izin Usaha">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.businessLicense} onChange={(e) => setForm((p) => ({ ...p, businessLicense: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Telepon Toko">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
						</FieldLabel>
						<div className="space-y-2">
							<p className="text-sm font-medium text-slate-700">Kota Toko</p>
							<select
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={form.cityId}
								onChange={(e) =>
									setForm((p) => ({
										...p,
										cityId: e.target.value,
										cityName: e.target.value ? "" : p.cityName,
										province: e.target.value ? "" : p.province,
									}))
								}
							>
								<option value=""></option>
								{cities.map((city) => (
									<option key={city.id} value={city.id}>
										{city.name}, {city.province}
									</option>
								))}
							</select>
							<p className="text-xs text-slate-500">
								Pilih kota yang sudah ada, atau kosongkan pilihan lalu isi kota baru di bawah.
							</p>
						</div>
						<FieldLabel label="Kota Baru">
							<input
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={form.cityName}
								onChange={(e) => setForm((p) => ({ ...p, cityId: "", cityName: e.target.value }))}
								disabled={saving || Boolean(form.cityId)}
							/>
						</FieldLabel>
						<FieldLabel label="Provinsi Kota Baru">
							<input
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={form.province}
								onChange={(e) => setForm((p) => ({ ...p, cityId: "", province: e.target.value }))}
								disabled={saving || Boolean(form.cityId)}
							/>
						</FieldLabel>
						<FieldLabel label="Jenis Toko">
							<select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.storeType} onChange={(e) => setForm((p) => ({ ...p, storeType: e.target.value as typeof form.storeType }))}>
								<option value="RETAILER">Retailer</option>
								<option value="WHOLESALER">Wholesaler</option>
								<option value="DISTRIBUTOR">Distributor</option>
							</select>
						</FieldLabel>
						<FieldLabel label="Limit Kredit">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} value={form.creditLimit} onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Lama Usaha (tahun)">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} value={form.yearsInBusiness} onChange={(e) => setForm((p) => ({ ...p, yearsInBusiness: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Estimasi Omzet Bulanan">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} value={form.estimatedMonthlyRevenue} onChange={(e) => setForm((p) => ({ ...p, estimatedMonthlyRevenue: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Alamat Pemilik" className="md:col-span-2">
							<textarea className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerAddress} onChange={(e) => setForm((p) => ({ ...p, ownerAddress: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Alamat Toko" className="md:col-span-2">
							<textarea className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Catatan Sales untuk Verifikasi" className="md:col-span-2">
							<textarea className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.salesNotes} onChange={(e) => setForm((p) => ({ ...p, salesNotes: e.target.value }))} />
						</FieldLabel>
					</div>
					<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
						<button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Batal</button>
						<button type="button" onClick={handleSubmit} disabled={saving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
							{saving ? "Menyimpan..." : "Simpan"}
						</button>
					</div>
				</div>
			</Modal>
		</SalesPortalShell>
	);
}
