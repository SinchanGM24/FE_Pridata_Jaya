"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import EmptyState from "@/components/shared/EmptyState";
import { SkeletonList } from "@/components/shared/Skeleton";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import Modal from "@/components/shared/Modal";
import InlineAlert from "@/components/shared/InlineAlert";
import PageFeedback from "@/components/shared/PageFeedback";
import PaginationControls from "@/components/shared/PaginationControls";
import SearchCombobox from "@/components/shared/SearchCombobox";
import { getApiErrorMessage } from "@/lib/api-errors";
import { citiesService } from "@/services/cities";
import { salesService } from "@/services/sales";
import { setSalesActingStoreProfile } from "@/services/sales-toko-cart";
import type { GradePaginationMeta, StoreGradeItem } from "@/services/grade";
import { useAuth } from "@/hooks/useAuth";
import { fieldClasses } from "@/components/shared/FormInput";
import { formatRupiah } from "@/lib/format";
import { toUiLabel, verificationStatusLabel } from "@/lib/ui-labels";

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();



const isStoreActive = (store: StoreGradeItem) => store.isActive !== false;
const storeTypeLabel: Record<"RETAILER" | "WHOLESALER" | "DISTRIBUTOR", string> = {
	RETAILER: "Retailer",
	WHOLESALER: "Wholesaler",
	DISTRIBUTOR: "Distributor",
};

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

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
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
						<h2 className="type-title text-slate-900">Daftar Toko Kelolaan</h2>
						<p className="type-body mt-1 text-slate-500">
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
								className={fieldClasses("control", "pl-9")}
							/>
						</div>
						{/* Label ikut menciut di HP, jadi nama aksesibelnya harus eksplisit. */}
						<Button
							onClick={() => setModalOpen(true)}
							className="shrink-0"
							aria-label="Daftarkan toko baru"
						>
							<Plus className="h-4 w-4" />
							<span className="hidden sm:inline">Daftarkan Toko</span>
						</Button>
					</div>
				</div>
			</Card>
			{/*
			 * Strip "Menampilkan N dari M · Halaman X dari Y" dihapus: PaginationControls
			 * di bawah daftar sudah melaporkan keduanya. Permukaan berbingkai untuk satu
			 * kalimat yang diulang 200px lebih bawah bukan hierarki, itu duplikasi.
			 */}
			<section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				{loading ? (
					<div className="lg:col-span-2">
						<SkeletonList rows={3} />
					</div>
				) : null}
				{stores.map((store) => (
					<article
						key={store.storeId}
						className="rounded-2xl border border-slate-200 bg-white p-4"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="type-title truncate text-slate-900">{store.storeName}</p>
								{/*
								 * Penagihan dimulai dari menelepon dan mendatangi. Keduanya di
								 * kartu, bukan di balik modal — sales tidak perlu membuka detail
								 * satu per satu hanya untuk mendapat nomor.
								 */}
								{store.phone ? (
									<a
										href={`tel:${store.phone.replace(/\s+/g, "")}`}
										className="mt-0.5 inline-flex min-h-11 md:min-h-9 items-center text-sm font-medium text-brand-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
									>
										{store.phone}
									</a>
								) : (
									<p className="type-body truncate text-slate-600">{store.email}</p>
								)}
								{store.address ? (
									<p className="type-body truncate text-slate-500">
										{store.address}
										{store.city?.name ? ` · ${store.city.name}` : ""}
									</p>
								) : null}
							</div>
							<Badge tone={isStoreActive(store) ? "success" : "danger"}>
								{isStoreActive(store) ? "Aktif" : "Nonaktif"}
							</Badge>
						</div>

						{/* Nilainya pendek (Grade N, 0, Rp 0) — satu kolom cuma memanjangkan kartu. */}
						<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
							<div>
								<dt className="type-label text-slate-500">
									Grade
								</dt>
								<dd className="mt-0.5 font-medium text-slate-900">{gradeDisplay(store)}</dd>
							</div>
							<div>
								<dt className="type-label text-slate-500">
									Order
								</dt>
								<dd className="mt-0.5 font-medium text-slate-900">{store.totalOrders}</dd>
							</div>
							<div>
								<dt className="type-label text-slate-500">
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
								className="basis-full sm:basis-auto"
							>
								Masuk Sebagai Toko
							</Button>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setSelectedStoreDetail(store)}
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
				{/*
				 * Modal ini tidak memanggil apa pun: alamat, telepon, dan jenis toko
				 * sudah ikut di respons GET /stores?assignedSalesUserId=me yang dimuat
				 * halaman ini — mapper-nya dulu yang membuangnya.
				 *
				 * Sebelumnya ia menembak GET /stores/:id untuk mengambilnya kembali,
				 * dan selalu ditolak 403: route itu sengaja dikunci ke
				 * BUSINESS_READ_ROLES (lihat SMD-Pridata-BE/src/routes/store.routes.ts:551)
				 * karena StoreService.findById tidak membatasi kepemilikan sama sekali.
				 * Melebarkan izinnya akan membuka juga NIB, NPWP, dan data diri pemilik
				 * termasuk NIK — sementara yang dibutuhkan penagihan cuma kontak toko.
				 */}
				{selectedStoreDetail ? (
					<div className="space-y-4 text-sm text-slate-700">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<p className="type-label text-slate-500">Nama Toko</p>
								<p className="font-semibold text-slate-900">{selectedStoreDetail.storeName}</p>
							</div>
							<div>
								<p className="type-label text-slate-500">Email</p>
								<p className="font-semibold text-slate-900">
									{selectedStoreDetail.email ?? "-"}
								</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Telepon Toko</p>
								{selectedStoreDetail.phone ? (
									// Penagihan dimulai dari menelepon; di HP ini langsung memanggil.
									<a
										href={`tel:${selectedStoreDetail.phone.replace(/\s+/g, "")}`}
										className="font-semibold text-brand-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
									>
										{selectedStoreDetail.phone}
									</a>
								) : (
									<p className="font-semibold text-slate-900">-</p>
								)}
							</div>
							<div>
								<p className="type-label text-slate-500">Jenis Toko</p>
								<p className="font-semibold text-slate-900">
									{selectedStoreDetail.storeType
										? storeTypeLabel[selectedStoreDetail.storeType]
										: "-"}
								</p>
							</div>
							<div className="md:col-span-2">
								<p className="type-label text-slate-500">Alamat Toko</p>
								<p className="font-semibold text-slate-900">
									{selectedStoreDetail.address || "-"}
								</p>
								{selectedStoreDetail.city?.name ? (
									<p className="text-xs text-slate-500">
										{selectedStoreDetail.city.name}
										{selectedStoreDetail.city.province
											? `, ${selectedStoreDetail.city.province}`
											: ""}
									</p>
								) : null}
							</div>
							<div>
								<p className="type-label text-slate-500">Grade</p>
								<p className="font-semibold text-slate-900">{gradeDisplay(selectedStoreDetail)}</p>
							</div>
							<div>
								<p className="type-label text-slate-500">Status Toko</p>
								<p className="font-semibold text-slate-900">
									{isStoreActive(selectedStoreDetail) ? "Aktif" : "Nonaktif"}
								</p>
							</div>
							<div>
								<p className="type-label text-slate-500">Status Verifikasi</p>
								<p className="font-semibold text-slate-900">
									{toUiLabel(selectedStoreDetail.verificationStatus, verificationStatusLabel)}
								</p>
							</div>
							<div>
								<p className="type-label text-slate-500">Total Order</p>
								<p className="font-semibold text-slate-900">{selectedStoreDetail.totalOrders}</p>
							</div>
							<div>
								<p className="type-label text-slate-500">Total Invoice</p>
								<p className="font-semibold text-slate-900">{selectedStoreDetail.totalInvoices}</p>
							</div>
							<div>
								<p className="type-label text-slate-500">Limit Kredit</p>
								<p className="font-semibold text-slate-900">
									{formatRupiah(selectedStoreDetail.creditLimit)}
								</p>
							</div>
							<div>
								<p className="type-label text-slate-500">Sisa Tagihan</p>
								<p className="font-semibold text-slate-900">
									{formatRupiah(selectedStoreDetail.totalOutstandingAmount)}
								</p>
							</div>
						</div>

						<div className="rounded-lg border border-slate-200 p-4">
							<p className="text-xs text-slate-500">Catatan Grade</p>
							<p className="mt-1 text-slate-700">{selectedStoreDetail.gradeReason || "-"}</p>
						</div>

						{/* Kenapa berhenti di sini, supaya tidak jadi pertanyaan ke support. */}
						<p className="text-xs leading-5 text-slate-500">
							Dokumen legalitas (NIB, NPWP, izin usaha) dan data diri pemilik hanya
							dapat diakses admin.
						</p>
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
				{/*
				 * <form> sungguhan, bukan <div>: 16 input di bawah membawa required,
				 * minLength, dan type="email" yang seluruhnya mati selama submit-nya
				 * masih type="button" + onClick. Dengan ini validasi bawaan browser
				 * yang menangani pesan per-field dan fokus ke field pertama yang salah.
				 */}
				<form onSubmit={handleSubmit} className="space-y-4">
					{error ? <InlineAlert>{error}</InlineAlert> : null}
					<div className="grid gap-4 md:grid-cols-2">
						<FieldLabel label="Nama Pemilik *">
							<input required autoComplete="name" className={fieldClasses("control")} value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Email Login Toko *">
							<input required autoComplete="email" className={fieldClasses("control")} type="email" value={form.ownerEmail} onChange={(e) => setForm((p) => ({ ...p, ownerEmail: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Password Login *">
							<input required minLength={8} autoComplete="new-password" className={fieldClasses("control")} type="password" value={form.ownerPassword} onChange={(e) => setForm((p) => ({ ...p, ownerPassword: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Nama Toko *">
							<input required minLength={3} className={fieldClasses("control")} value={form.storeName} onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Gender Pemilik *">
							<select required className={fieldClasses()} value={form.ownerGender} onChange={(e) => setForm((p) => ({ ...p, ownerGender: e.target.value as typeof form.ownerGender }))}>
								<option value="">Pilih gender</option>
								<option value="MALE">Laki-laki</option>
								<option value="FEMALE">Perempuan</option>
							</select>
						</FieldLabel>
						<FieldLabel label="Jenis Toko *">
							<select className={fieldClasses()} value={form.storeType} onChange={(e) => setForm((p) => ({ ...p, storeType: e.target.value as typeof form.storeType }))}>
								<option value="RETAILER">Retailer</option>
								<option value="WHOLESALER">Wholesaler</option>
								<option value="DISTRIBUTOR">Distributor</option>
							</select>
						</FieldLabel>
						<FieldLabel label="Telepon Pemilik (Opsional)">
							<input autoComplete="tel" inputMode="tel" placeholder="Contoh: 081234567890" className={fieldClasses("control")} value={form.ownerPhoneNumber} onChange={(e) => setForm((p) => ({ ...p, ownerPhoneNumber: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Telepon Toko *">
							<input required inputMode="tel" placeholder="Contoh: 081234567890" className={fieldClasses("control")} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
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
								className={fieldClasses("control")}
								value={form.cityName}
								onChange={(e) => setForm((p) => ({ ...p, cityId: "", cityName: e.target.value }))}
								disabled={saving || Boolean(form.cityId)}
							/>
						</FieldLabel>
						<FieldLabel label="Provinsi Kota Baru">
							<input
								required={!form.cityId}
								className={fieldClasses("control")}
								value={form.province}
								onChange={(e) => setForm((p) => ({ ...p, cityId: "", province: e.target.value }))}
								disabled={saving || Boolean(form.cityId)}
							/>
						</FieldLabel>
						<FieldLabel label="Lama Usaha (Tahun) *">
							<input required className={fieldClasses("control")} type="number" min={0} step={1} value={form.yearsInBusiness} onChange={(e) => setForm((p) => ({ ...p, yearsInBusiness: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Estimasi Omzet Bulanan (Opsional)">
							<input className={fieldClasses("control")} type="number" min={0} value={form.estimatedMonthlyRevenue} onChange={(e) => setForm((p) => ({ ...p, estimatedMonthlyRevenue: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Alamat Toko *" className="md:col-span-2">
							<textarea required minLength={10} className={fieldClasses("area")} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
						</FieldLabel>
						<FieldLabel label="Catatan Sales (Opsional)" className="md:col-span-2">
							<textarea className={fieldClasses("area")} value={form.salesNotes} onChange={(e) => setForm((p) => ({ ...p, salesNotes: e.target.value }))} />
						</FieldLabel>
					</div>
					<div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
						<Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
							Batal
						</Button>
						<Button type="submit" disabled={saving}>
							{saving ? "Menyimpan..." : "Simpan"}
						</Button>
					</div>
				</form>
			</Modal>
		</SalesPortalShell>
	);
}
