"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import Badge from "@/components/shared/Badge";
import Card, { CardHeader } from "@/components/shared/Card";
import PageFeedback from "@/components/shared/PageFeedback";
import Skeleton from "@/components/shared/Skeleton";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatRupiah } from "@/lib/format";
import { statusTone, toUiLabel, verificationStatusLabel } from "@/lib/ui-labels";
import { getSalesActingStoreProfile } from "@/services/sales-toko-cart";
import { salesService } from "@/services/sales";
import type { StoreGradeItem } from "@/services/grade";

export default function SalesActingStoreProfilePage() {
	const params = useParams<{ storeId: string }>();
	const storeId = params.storeId;
	const actingStore = getSalesActingStoreProfile();
	const [store, setStore] = useState<StoreGradeItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const result = await salesService.getManagedStoreById(storeId);
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

	/*
	 * Satu daftar fakta, bukan enam tile plus panel "Ringkasan Akses Sales" yang
	 * mengulang dua di antaranya. Nilainya teks, bukan KPI — jadi dl, bukan StatCard.
	 */
	const storeFacts = useMemo(
		() => [
			{ label: "Nama Toko", value: store?.storeName || "-" },
			{
				label: "Status Verifikasi",
				value: store?.verificationStatus ? (
					<Badge tone={statusTone(store.verificationStatus)}>
						{toUiLabel(store.verificationStatus, verificationStatusLabel)}
					</Badge>
				) : (
					"-"
				),
			},
			{ label: "Grade", value: store?.grade || "-" },
			{ label: "Email Toko", value: store?.email || "-" },
			{ label: "Status Toko", value: store?.isActive === false ? "Nonaktif" : "Aktif" },
			{ label: "Limit Kredit", value: formatRupiah(store?.creditLimit ?? 0) },
			{ label: "Total Order", value: String(store?.totalOrders ?? 0) },
			{ label: "Total Invoice", value: String(store?.totalInvoices ?? 0) },
		],
		[store],
	);

	return (
		<TokoFeatureLayout
			title="Profil Toko"
			basePath={`/sales/toko-kelolaan/${storeId}`}
			profileName={actingStore?.storeName || store?.storeName || "Toko"}
			profileRoleLabel="Sales Mode Toko"
			salesName={actingStore?.salesName ?? null}
		>
			<PageFeedback error={error} onDismissError={() => setError("")} />

			<Card>
				<CardHeader
					title="Profil Toko Kelolaan"
					description="Identitas toko saat sales masuk sebagai perwakilan toko. Edit akun sales tetap dilakukan dari menu profil akun sales."
				/>

				{loading ? (
					<div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{Array.from({ length: 6 }, (_, index) => (
							<div key={index}>
								<Skeleton className="h-3 w-24" />
								<Skeleton className="mt-2 h-4 w-36" />
							</div>
						))}
					</div>
				) : store ? (
					<dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-slate-200 pt-5 sm:grid-cols-2 xl:grid-cols-3">
						{storeFacts.map((fact) => (
							<div key={fact.label} className="min-w-0">
								<dt className="type-label text-slate-500">{fact.label}</dt>
								<dd className="type-body mt-1.5 break-words font-medium text-slate-900">
									{fact.value}
								</dd>
							</div>
						))}
					</dl>
				) : (
					<p className="type-body mt-4 text-slate-600">Data toko tidak ditemukan.</p>
				)}
			</Card>
		</TokoFeatureLayout>
	);
}
