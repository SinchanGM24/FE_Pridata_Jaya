"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import EmptyState from "@/components/shared/EmptyState";
import { SkeletonList } from "@/components/shared/Skeleton";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import SearchCombobox from "@/components/shared/SearchCombobox";
import { getApiErrorMessage } from "@/lib/api-errors";
import { citiesService } from "@/services/cities";
import { salesService } from "@/services/sales";
import { setSalesActingStoreProfile } from "@/services/sales-toko-cart";
import type { GradePaginationMeta, StoreGradeItem } from "@/services/grade";
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

const formatGender = (value?: string | null) => {
	if (value === "MALE") return "Laki-laki";
	if (value === "FEMALE") return "Perempuan";
	return value || "-";
};

const isStoreActive = (store: StoreGradeItem) => store.isActive !== false;
const gradeDisplay = (store: StoreGradeItem) =>
	store.verificationStatus === "VERIFIED" ? store.grade : "Belum dinilai";

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
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [meta, setMeta] = useState<GradePaginationMeta | null>(null);
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
		ownerGender: "" as "" | "MALE" | "FEMALE",
		ownerPhoneNumber: "",
		storeName: "",
		phone: "",
		address: "",
		cityId: "",
		cityName: "",
		province: "",
		storeType: "RETAILER" as "RETAILER" | "WHOLESALER" | "DISTRIBUTOR",
		yearsInBusiness: "",
		estimatedMonthlyRevenue: "",
		salesNotes: "",
	});

	const loadStores = useCallback(async (query: string, pageNumber: number) => {
		setLoading(true);
		setError("");
		try {
			const result = await salesService.listManagedStoresPage({
				page: pageNumber,
				limit: 10,
				search: query.trim() || undefined,
			});
			setStores(result.data);
			setMeta(result.meta ?? null);
			if (result.meta && result.meta.totalPages > 0 && pageNumber > result.meta.totalPages) {
				setPage(result.meta.totalPages);
			}
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat toko kelolaan."));
			setStores([]);
			setMeta(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadStores(search, page);
		}, 350);

		return () => window.clearTimeout(timer);
	}, [loadStores, page, search]);

	const totalPages = Math.max(1, meta?.totalPages ?? 1);
	const currentPage = Math.min(meta?.currentPage ?? page, totalPages);

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
			const ownerGender = form.ownerGender;
			const ownerPhoneNumber = form.ownerPhoneNumber.replace(/\s+/g, "").trim();
			const storeName = sanitizeText(form.storeName);
			const phone = form.phone.replace(/\s+/g, "").trim();
			const address = sanitizeText(form.address);
			const cityName = sanitizeText(form.cityName);
			const province = sanitizeText(form.province);
			const yearsInBusiness = Number(form.yearsInBusiness);
			const estimatedMonthlyRevenue = form.estimatedMonthlyRevenue
				? Number(form.estimatedMonthlyRevenue)
				: undefined;

			if (
				!ownerName ||
				!ownerEmail ||
				!ownerPassword ||
				!ownerGender ||
				!storeName ||
				!phone ||
				!address ||
				!form.yearsInBusiness ||
				(!form.cityId && (!cityName || !province))
			) {
				throw new Error("Lengkapi data pemilik, toko, alamat, serta pilih kota atau isi kota baru.");
			}

			if (ownerPassword.length < 8) {
				throw new Error("Password minimal 8 karakter.");
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

			if (ownerPhoneNumber && !phoneRegex.test(ownerPhoneNumber)) {
				throw new Error("Telepon pemilik tidak valid. Gunakan format: +62xxx, 62xxx, atau 0xxx (9-13 digit).");
			}

			if (!Number.isInteger(yearsInBusiness) || yearsInBusiness < 0) {
				throw new Error("Lama usaha harus berupa bilangan bulat minimal 0 tahun.");
			}

			if (
				estimatedMonthlyRevenue !== undefined &&
				(!Number.isInteger(estimatedMonthlyRevenue) || estimatedMonthlyRevenue < 0)
			) {
				throw new Error("Estimasi omzet bulanan harus berupa angka minimal 0.");
			}

			await salesService.registerManagedStore({
				ownerName,
				ownerEmail,
				ownerPassword,
				storeName,
				ownerGender,
				ownerPhoneNumber: ownerPhoneNumber || undefined,
				phone,
				address,
				cityId: form.cityId || undefined,
				newCityName: form.cityId ? undefined : cityName,
				newCityProvince: form.cityId ? undefined : province,
				storeType: form.storeType,
				yearsInBusiness,
				estimatedMonthlyRevenue,
				salesNotes: sanitizeText(form.salesNotes) || undefined,
			});
			setSuccess("Toko berhasil didaftarkan dan menunggu verifikasi fakturis.");
			setModalOpen(false);
			setForm({
				ownerName: "",
				ownerEmail: "",
				ownerPassword: "",
				ownerGender: "",
				ownerPhoneNumber: "",
				storeName: "",
				phone: "",
				address: "",
				cityId: "",
				cityName: "",
				province: "",
				storeType: "RETAILER",
				yearsInBusiness: "",
				estimatedMonthlyRevenue: "",
				salesNotes: "",
			});
			setSearch("");
			setPage(1);
			await loadStores("", 1);
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
			<PageFeedback
				error={!modalOpen ? error : null}
				success={success}
				onDismissError={() => setError("")}
				onDismissSuccess={() => setSuccess("")}
			/>
			<Card>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="min-w-0">
						<p className="text-base font-semibold text-slate-900 sm:text-lg">
							Daftar Toko Kelolaan
						</p>
						<p className="mt-1 text-sm text-slate-500">
							Registrasi toko baru ada di halaman ini. Purchase order dilakukan setelah memilih
							toko.
						</p>
					</div>
					<div className="flex gap-2 md:shrink-0">
						<div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
							<Search
								aria-hidden
								className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
							/>
							<input
								type="search"
								value={search}
								onChange={(event) => {
									setSearch(event.target.value);
									setPage(1);
								}}
								placeholder="Cari toko atau email"
								aria-label="Cari toko atau email"
								className="h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
							/>
						</div>
						<Button onClick={() => setModalOpen(true)} className="shrink-0">
							<Plus className="h-4 w-4" />
							<span className="hidden sm:inline">Daftarkan Toko</span>
						</Button>
					</div>
				</div>
			</Card>
			<div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
				<p>Menampilkan {stores.length} dari {meta?.totalItems ?? stores.length} toko kelolaan.</p>
				<p>Halaman {currentPage} dari {totalPages}</p>
			</div>
			<section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				{loading ? (
					<div className="lg:col-span-2">
						<SkeletonList rows={3} />
					</div>
				) : null}
				{stores.map((store) => (
					<article
						key={store.storeId}
						className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-base font-semibold text-slate-900">
									{store.storeName}
								</p>
								<p className="truncate text-sm text-slate-600">{store.email}</p>
							</div>
							<Badge tone={isStoreActive(store) ? "success" : "danger"}>
								{isStoreActive(store) ? "Aktif" : "Nonaktif"}
							</Badge>
						</div>

						{/* Tiga kolom di 360px membuat label terpotong; naik bertahap. */}
						<dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
							<div>
								<dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
									Grade
								</dt>
								<dd className="mt-0.5 font-medium text-slate-900">{gradeDisplay(store)}</dd>
							</div>
							<div>
								<dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
									Order
								</dt>
								<dd className="mt-0.5 font-medium text-slate-900">{store.totalOrders}</dd>
							</div>
							<div>
								<dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
									Sisa Tagihan
								</dt>
								<dd className="mt-0.5 font-medium text-slate-900">
									{formatRupiah(store.totalOutstandingAmount)}
								</dd>
							</div>
						</dl>

						{/* Satu aksi utama; sisanya sekunder. Sebelumnya tiga tombol berbobot sama. */}
						<div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
							<Button
								variant="commerce"
								size="sm"
								onClick={() => handleActAsStore(store)}
								disabled={!isStoreActive(store)}
								className="flex-1 sm:flex-none"
							>
								Masuk Sebagai Toko
							</Button>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => void handleOpenStoreDetail(store)}
							>
								Detail
							</Button>
							<Button
								variant="ghost"
								size="sm"
								href={`/sales/riwayat-transaksi?storeId=${store.storeId}`}
							>
								Riwayat
							</Button>
						</div>
					</article>
				))}
				{!loading && !stores.length ? (
					<div className="lg:col-span-2">
						<EmptyState
							title="Belum ada toko kelolaan"
							description={
								search
									? `Tidak ada toko yang cocok dengan "${search}".`
									: "Daftarkan toko pertama Anda lewat tombol di atas."
							}
							action={
								search ? undefined : (
									<Button onClick={() => setModalOpen(true)}>Daftarkan Toko</Button>
								)
							}
							className="rounded-2xl border border-slate-200 bg-white"
						/>
					</div>
				) : null}
			</section>
			{meta ? (
				<PaginationControls
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={meta.totalItems}
					currentItemCount={stores.length}
					pageSize={10}
					itemLabel="toko"
					loading={loading}
					embedded={false}
					onPageChange={setPage}
				/>
			) : null}

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
								<p className="font-semibold text-slate-900">{gradeDisplay(selectedStoreDetail)}</p>
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
										{formatGender(
											selectedStoreRecord?.user?.profile?.gender ??
												selectedStoreRecord?.documents?.ownerGender,
										)}
									</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Telepon Pemilik</p>
									<p className="font-semibold text-slate-900">
										{selectedStoreRecord?.user?.profile?.phone ??
											selectedStoreRecord?.user?.profile?.phoneNumber ??
											selectedStoreRecord?.documents?.ownerPhoneNumber ??
											"-"}
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
						<FieldLabel label="Nama Pemilik *">
							<input required autoComplete="name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Email Login Toko *">
							<input required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="email" value={form.ownerEmail} onChange={(e) => setForm((p) => ({ ...p, ownerEmail: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Password Login *">
							<input required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="password" value={form.ownerPassword} onChange={(e) => setForm((p) => ({ ...p, ownerPassword: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Nama Toko *">
							<input required minLength={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.storeName} onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Gender Pemilik *">
							<select required className="w-full rounded-lg border border-slate-300 min-h-11 px-3 md:min-h-10 text-sm" value={form.ownerGender} onChange={(e) => setForm((p) => ({ ...p, ownerGender: e.target.value as typeof form.ownerGender }))}>
								<option value="">Pilih gender</option>
								<option value="MALE">Laki-laki</option>
								<option value="FEMALE">Perempuan</option>
							</select>
						</FieldLabel>
						<FieldLabel label="Jenis Toko *">
							<select className="w-full rounded-lg border border-slate-300 min-h-11 px-3 md:min-h-10 text-sm" value={form.storeType} onChange={(e) => setForm((p) => ({ ...p, storeType: e.target.value as typeof form.storeType }))}>
								<option value="RETAILER">Retailer</option>
								<option value="WHOLESALER">Wholesaler</option>
								<option value="DISTRIBUTOR">Distributor</option>
							</select>
						</FieldLabel>
						<FieldLabel label="Telepon Pemilik (Opsional)">
							<input autoComplete="tel" inputMode="tel" placeholder="Contoh: 081234567890" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.ownerPhoneNumber} onChange={(e) => setForm((p) => ({ ...p, ownerPhoneNumber: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Telepon Toko *">
							<input required inputMode="tel" placeholder="Contoh: 081234567890" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
						</FieldLabel>
						<div className="space-y-2 md:col-span-2">
							<SearchCombobox label="Kota Toko" value={form.cityId} loadOptions={async (query) => (await citiesService.search(query)).map((city) => ({ value: city.id, label: city.name, description: city.province }))} onChange={(cityId) => setForm((current) => ({ ...current, cityId, cityName: cityId ? "" : current.cityName, province: cityId ? "" : current.province }))} placeholder="Cari kota atau provinsi; kosongkan untuk kota baru" />
							<p className="text-xs text-slate-500">
								Pilih kota yang sudah ada, atau kosongkan pilihan lalu isi kota baru di bawah.
							</p>
						</div>
						<FieldLabel label="Kota Baru">
							<input
								required={!form.cityId}
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={form.cityName}
								onChange={(e) => setForm((p) => ({ ...p, cityId: "", cityName: e.target.value }))}
								disabled={saving || Boolean(form.cityId)}
							/>
						</FieldLabel>
						<FieldLabel label="Provinsi Kota Baru">
							<input
								required={!form.cityId}
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={form.province}
								onChange={(e) => setForm((p) => ({ ...p, cityId: "", province: e.target.value }))}
								disabled={saving || Boolean(form.cityId)}
							/>
						</FieldLabel>
						<FieldLabel label="Lama Usaha (Tahun) *">
							<input required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} step={1} value={form.yearsInBusiness} onChange={(e) => setForm((p) => ({ ...p, yearsInBusiness: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Estimasi Omzet Bulanan (Opsional)">
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} value={form.estimatedMonthlyRevenue} onChange={(e) => setForm((p) => ({ ...p, estimatedMonthlyRevenue: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Alamat Toko *" className="md:col-span-2">
							<textarea required minLength={10} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Catatan Sales (Opsional)" className="md:col-span-2">
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
