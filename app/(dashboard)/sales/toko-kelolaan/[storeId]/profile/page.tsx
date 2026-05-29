"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";
import { storesService, type Store } from "@/services/stores";

export default function SalesActingStoreProfilePage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();
	const [store, setStore] = useState<Store | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const result = await storesService.getById(storeId);
					if (cancelled) return;
					setStore(result);
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
	}, [storeId]);

	const summaryCards = useMemo(
		() => [
			{ label: "Nama Toko", value: store?.name ?? "-" },
			{ label: "Status Verifikasi", value: store?.verificationStatus ?? "-" },
			{ label: "Telepon", value: store?.phone ?? "-" },
			{ label: "Email Toko", value: store?.email ?? "-" },
			{ label: "Kota", value: store?.city?.name ?? "-" },
			{ label: "Provinsi", value: store?.city?.province ?? "-" },
		],
		[store],
	);

	return (
		<TokoFeatureLayout
			title="Profil Toko"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={actingStore?.storeName || store?.name || "Toko"}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? store?.assignedSalesUser?.name ?? null}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Profil Toko Kelolaan</h2>
				<p className="mt-1 text-sm text-slate-600">
					Halaman ini menampilkan identitas toko saat sales masuk sebagai perwakilan toko. Edit akun
					sales tetap dilakukan dari menu profil akun sales.
				</p>
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{summaryCards.map((card) => (
					<div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
						<p className="mt-3 text-sm font-semibold text-slate-900">
							{loading ? "Memuat..." : card.value}
						</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Alamat dan Relasi</h2>
				{loading ? (
					<p className="mt-4 text-sm text-slate-600">Memuat profil toko...</p>
				) : store ? (
					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Alamat</p>
							<p className="mt-2 text-sm text-slate-900">{store.address || "-"}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Owner User</p>
							<p className="mt-2 text-sm text-slate-900">{store.user?.name ?? "-"}</p>
							<p className="text-xs text-slate-500">{store.user?.email ?? "-"}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sales Penanggung Jawab</p>
							<p className="mt-2 text-sm text-slate-900">{store.assignedSalesUser?.name ?? "-"}</p>
							<p className="text-xs text-slate-500">{store.assignedSalesUser?.email ?? "-"}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Limit Kredit</p>
							<p className="mt-2 text-sm text-slate-900">
								{new Intl.NumberFormat("id-ID", {
									style: "currency",
									currency: "IDR",
									maximumFractionDigits: 0,
								}).format(store.creditLimit ?? 0)}
							</p>
						</div>
					</div>
				) : (
					<p className="mt-4 text-sm text-slate-600">Data toko tidak ditemukan.</p>
				)}
			</section>
		</TokoFeatureLayout>
	);
}
