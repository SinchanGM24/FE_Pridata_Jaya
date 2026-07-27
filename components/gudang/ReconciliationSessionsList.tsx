"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	reconciliationService,
	type ReconciliationSessionSummary,
	type ReconciliationStatus,
} from "@/services/reconciliation";

const statusClassName: Record<ReconciliationStatus, string> = {
	DRAFT: "border border-amber-200 bg-amber-50 text-amber-700",
	CONFIRMED: "border border-emerald-200 bg-emerald-50 text-emerald-700",
	CANCELLED: "border border-slate-200 bg-slate-50 text-slate-600",
};

export default function ReconciliationSessionsList({ warehouseId }: { warehouseId: string }) {
	const [sessions, setSessions] = useState<ReconciliationSessionSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!warehouseId) return;
		let cancelled = false;

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const res = await reconciliationService.listSessions(warehouseId, { page: 1, limit: 20 });
					if (cancelled) return;
					setSessions(res.data ?? []);
				} catch (error: unknown) {
					if (cancelled) return;
					setSessions([]);
					setError(getApiErrorMessage(error, "Gagal memuat sesi rekonsiliasi."));
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
	}, [warehouseId]);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="border-b border-slate-200 pb-4">
				<p className="text-sm font-semibold text-slate-800">Riwayat Sesi</p>
				<p className="mt-1 text-xs text-slate-500">
					Sesi draft bisa dibuka lagi untuk dicek sebelum confirm atau cancel.
				</p>
			</div>

			{loading ? <div className="mt-3 text-xs text-slate-500">Memuat sesi...</div> : null}

			{error ? <div className="mt-3 text-xs text-rose-600">{error}</div> : null}

			{!loading && sessions.length === 0 ? (
				<div className="mt-3 text-xs text-slate-500">Belum ada sesi rekonsiliasi.</div>
			) : null}

			{!loading && sessions.length > 0 ? (
				<div className="mt-3 overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-slate-500">
							<tr>
								<th className="pb-2">Status</th>
								<th className="pb-2 text-right">Item</th>
								<th className="pb-2">Dibuat</th>
								<th className="pb-2 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody>
							{sessions.map((session) => (
								<tr key={session.id} className="border-t border-slate-100">
									<td className="py-2">
										<span
											className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
												statusClassName[session.status] ?? "border border-slate-200 bg-slate-50 text-slate-700"
											}`}
										>
											{session.status}
										</span>
									</td>
									<td className="py-2 text-right">{session.items?.length ?? session.itemCount ?? "-"}</td>
									<td className="py-2 text-slate-600">
										{session.createdAt
											? new Date(session.createdAt).toLocaleString("id-ID")
											: "-"}
									</td>
									<td className="py-2 text-right">
										<Link
											href={`/gudang/reconciliation/${session.id}`}
											className="rounded-md border px-3 py-1 text-xs hover:bg-slate-50"
										>
											Detail
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</div>
	);
}
