"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	reconciliationService,
	type ReconciliationSessionDetail,
	type ReconciliationStatus,
} from "@/services/reconciliation";

const statusClassName: Record<ReconciliationStatus, string> = {
	DRAFT: "bg-amber-100 text-amber-800",
	CONFIRMED: "bg-emerald-100 text-emerald-800",
	CANCELLED: "bg-slate-100 text-slate-600",
};

export default function ReconciliationSessionDetailPage() {
	const { sessionId } = useParams() as { sessionId?: string };
	const router = useRouter();
	const [session, setSession] = useState<ReconciliationSessionDetail | null>(null);
	const [loading, setLoading] = useState(false);
	const [actioning, setActioning] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	useEffect(() => {
		if (!sessionId) return;
		let mounted = true;
		setLoading(true);
		setError("");
		reconciliationService
			.getSessionById(sessionId)
			.then((result) => mounted && setSession(result))
			.catch((err: any) => {
				if (!mounted) return;
				setError(err?.response?.data?.message || "Gagal memuat detail sesi rekonsiliasi.");
			})
			.finally(() => mounted && setLoading(false));
		return () => {
			mounted = false;
		};
	}, [sessionId]);

	const title = useMemo(() => {
		if (!session) return "Detail Sesi Rekonsiliasi";
		return `Rekonsiliasi - ${session.warehouseName}`;
	}, [session]);

	async function refreshSession() {
		if (!sessionId) return;
		const result = await reconciliationService.getSessionById(sessionId);
		setSession(result);
	}

	async function handleConfirm() {
		if (!sessionId) return;
		setActioning(true);
		setError("");
		setSuccess("");
		try {
			await reconciliationService.confirmSession(sessionId);
			await refreshSession();
			setSuccess("Sesi rekonsiliasi berhasil dikonfirmasi.");
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal mengonfirmasi sesi rekonsiliasi.");
		} finally {
			setActioning(false);
		}
	}

	async function handleCancel() {
		if (!sessionId) return;
		setActioning(true);
		setError("");
		setSuccess("");
		try {
			await reconciliationService.cancelSession(sessionId);
			await refreshSession();
			setSuccess("Sesi rekonsiliasi berhasil dibatalkan.");
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal membatalkan sesi rekonsiliasi.");
		} finally {
			setActioning(false);
		}
	}

	return (
		<FeaturePage
			title={title}
			description="Tinjau hasil hitung fisik terhadap stok sistem sebelum confirm atau cancel sesi rekonsiliasi."
			actions={
				session?.warehouseId
					? [{ label: "Kembali ke Gudang", href: `/gudang/reconciliation/warehouse/${session.warehouseId}` }]
					: [{ label: "Kembali", href: "/gudang/reconciliation" }]
			}
		>
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			{loading ? (
				<div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
					Memuat detail sesi...
				</div>
			) : null}

			{!loading && !session ? (
				<div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
					Sesi rekonsiliasi tidak ditemukan.
				</div>
			) : null}

			{session ? (
				<>
					<section className="grid gap-4 md:grid-cols-4">
						{[
							{ label: "Status", value: session.status },
							{ label: "Total Item", value: session.summary.totalItems },
							{ label: "Match", value: session.summary.matchedItems },
							{ label: "Discrepancy", value: session.summary.discrepancyItems },
						].map((item) => (
							<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
								<p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
								{item.label === "Status" ? (
									<div className="mt-3">
										<span
											className={`rounded-full px-2 py-1 text-xs font-medium ${
												statusClassName[session.status]
											}`}
										>
											{session.status}
										</span>
									</div>
								) : (
									<p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
								)}
							</div>
						))}
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div>
								<p className="text-sm font-semibold text-slate-800">Ringkasan Sesi</p>
								<p className="mt-1 text-xs text-slate-500">
									Gudang: {session.warehouseName} | Dibuat:{" "}
									{new Date(session.createdAt).toLocaleString("id-ID")}
								</p>
							</div>
							<p className="text-xs text-slate-500">
								Total selisih absolut: {session.summary.totalDiscrepancyQuantity}
							</p>
						</div>
					</section>

					<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-4 py-3">Produk</th>
									<th className="px-4 py-3">Kondisi</th>
									<th className="px-4 py-3 text-right">Sistem</th>
									<th className="px-4 py-3 text-right">Fisik</th>
									<th className="px-4 py-3 text-right">Selisih</th>
									<th className="px-4 py-3">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{session.items.map((item) => (
									<tr key={`${item.productId}-${item.condition}`}>
										<td className="px-4 py-3 font-medium text-slate-900">{item.productName}</td>
										<td className="px-4 py-3 text-slate-700">{item.condition}</td>
										<td className="px-4 py-3 text-right text-slate-900">{item.systemQuantity}</td>
										<td className="px-4 py-3 text-right text-slate-900">{item.physicalQuantity}</td>
										<td className="px-4 py-3 text-right font-semibold text-slate-900">
											{item.discrepancyQuantity}
										</td>
										<td className="px-4 py-3">
											<span
												className={`rounded-full px-2 py-1 text-xs font-medium ${
													item.status === "MATCH"
														? "bg-emerald-100 text-emerald-800"
														: "bg-amber-100 text-amber-800"
												}`}
											>
												{item.status}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>

					<div className="flex gap-2">
						<button
							onClick={() =>
								session.warehouseId
									? router.push(`/gudang/reconciliation/warehouse/${session.warehouseId}`)
									: router.push("/gudang/reconciliation")
							}
							className="rounded-md border px-3 py-2 text-xs"
						>
							Kembali
						</button>
						<div className="ml-auto flex gap-2">
							<button
								onClick={handleCancel}
								disabled={actioning || session.status !== "DRAFT"}
								className="rounded-md border px-3 py-2 text-xs disabled:opacity-50"
							>
								{actioning ? "Memproses..." : "Batalkan"}
							</button>
							<button
								onClick={handleConfirm}
								disabled={actioning || session.status !== "DRAFT"}
								className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white disabled:opacity-50"
							>
								{actioning ? "Memproses..." : "Konfirmasi"}
							</button>
						</div>
					</div>
				</>
			) : null}
		</FeaturePage>
	);
}
