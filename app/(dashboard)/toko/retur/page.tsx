"use client";

import { useEffect, useState } from "react";
import TokoReturnsWorkspace from "@/components/toko/TokoReturnsWorkspace";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { getApiErrorMessage } from "@/lib/api-errors";
import { meService } from "@/services/me";

export default function StoreReturnPage() {
	const [storeId, setStoreId] = useState("");
	const [storeName, setStoreName] = useState("Toko");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let mounted = true;

		meService
			.getProfile()
			.then((profile) => {
				if (!mounted) {
					return;
				}

				setStoreId(profile.store?.id ?? "");
				setStoreName(profile.store?.name || profile.name || "Toko");
			})
			.catch((loadError: unknown) => {
				if (!mounted) {
					return;
				}
				setError(getApiErrorMessage(loadError, "Gagal memuat konteks toko untuk retur."));
			})
			.finally(() => {
				if (mounted) {
					setLoading(false);
				}
			});

		return () => {
			mounted = false;
		};
	}, []);

	return (
		<TokoFeatureLayout title="Pengajuan Retur" profileName={storeName} profileRoleLabel="Toko">
			{loading ? (
				<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
					Memuat konteks retur toko...
				</div>
			) : null}

			{!loading && error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{!loading && !error && storeId ? (
				<TokoReturnsWorkspace storeId={storeId} storeName={storeName} actorMode="toko" />
			) : null}
		</TokoFeatureLayout>
	);
}
