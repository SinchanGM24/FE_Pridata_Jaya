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
import { useAuth } from "@/hooks/useAuth";

const MASTER_DATA_LIMIT = 100;

const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

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
	const [form, setForm] = useState({
		ownerName: "",
		ownerEmail: "",
		ownerPassword: "",
		storeName: "",
		phone: "",
		address: "",
		cityId: "",
		cityName: "",
		province: "",
		storeType: "RETAILER" as "RETAILER" | "WHOLESALER" | "DISTRIBUTOR",
		creditLimit: "0",
	});

	const load = async () => {
		setLoading(true);
		try {
			const [storeRows, cityRows] = await Promise.all([
				salesService.getManagedStores(),
				citiesService.list({ page: 1, limit: MASTER_DATA_LIMIT, sortBy: "name", sortOrder: "asc" }),
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
		load();
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
				storeName,
				phone,
				address,
				cityId: resolvedCityId,
				storeType: form.storeType,
				creditLimit: Number.isFinite(creditLimit) && creditLimit >= 0 ? creditLimit : 0,
			});
			setSuccess("Toko berhasil didaftarkan dan menunggu verifikasi fakturis.");
			setModalOpen(false);
			setForm({
				ownerName: "",
				ownerEmail: "",
				ownerPassword: "",
				storeName: "",
				phone: "",
				address: "",
				cityId: "",
				cityName: "",
				province: "",
				storeType: "RETAILER",
				creditLimit: "0",
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
								<p className="text-slate-500">Outstanding</p>
								<p className="font-medium text-slate-900">{formatRupiah(store.totalOutstandingAmount)}</p>
							</div>
							<div>
								<p className="text-slate-500">Status</p>
								<span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
									Aktif
								</span>
							</div>
						</div>
						<div className="flex gap-2">
							<Link
								href={`/sales/toko-kelolaan/${store.storeId}`}
								className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center"
							>
								Detail
							</Link>
							<button
								type="button"
								onClick={() => handleActAsStore(store)}
								className="flex-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
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
						<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nama pemilik" value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
						<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Email login toko" type="email" value={form.ownerEmail} onChange={(e) => setForm((p) => ({ ...p, ownerEmail: e.target.value }))} />
						<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Password login" type="password" value={form.ownerPassword} onChange={(e) => setForm((p) => ({ ...p, ownerPassword: e.target.value }))} />
						<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nama toko" value={form.storeName} onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))} />
						<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nomor telepon" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
						<div className="space-y-2">
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
								<option value="">Pilih kota</option>
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
						<input
							className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
							placeholder="Kota baru"
							value={form.cityName}
							onChange={(e) => setForm((p) => ({ ...p, cityId: "", cityName: e.target.value }))}
							disabled={saving || Boolean(form.cityId)}
						/>
						<input
							className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
							placeholder="Provinsi kota baru"
							value={form.province}
							onChange={(e) => setForm((p) => ({ ...p, cityId: "", province: e.target.value }))}
							disabled={saving || Boolean(form.cityId)}
						/>
						<select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.storeType} onChange={(e) => setForm((p) => ({ ...p, storeType: e.target.value as typeof form.storeType }))}>
							<option value="RETAILER">Retailer</option>
							<option value="WHOLESALER">Wholesaler</option>
							<option value="DISTRIBUTOR">Distributor</option>
						</select>
						<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Credit limit" type="number" min={0} value={form.creditLimit} onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))} />
						<textarea className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Alamat lengkap" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
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
