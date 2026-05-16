"use client";

import { useEffect, useState } from "react";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { gradeService, type StoreGradeItem } from "@/services/grade";

export default function SalesGradeTokoPage() {
	const [rows, setRows] = useState<StoreGradeItem[]>([]);
	const [search, setSearch] = useState("");

	const formatGradeTone = (grade: StoreGradeItem["grade"]) => {
		if (grade === "N") return "bg-violet-100 text-violet-700";
		if (grade === "A") return "bg-emerald-100 text-emerald-700";
		if (grade === "B") return "bg-sky-100 text-sky-700";
		if (grade === "C") return "bg-amber-100 text-amber-700";
		if (grade === "D") return "bg-orange-100 text-orange-700";
		return "bg-rose-100 text-rose-700";
	};

	useEffect(() => {
		let mounted = true;
		gradeService.listForSales(search ? { search } : undefined).then((data) => {
			if (mounted) setRows(data);
		}).catch(() => {});

		return () => {
			mounted = false;
		};
	}, [search]);

	return (
		<SalesPortalShell title="Grade Toko Kelolaan">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Cari nama toko atau email"
					className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-400"
				/>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Toko</th>
							<th className="px-4 py-3">Grade</th>
							<th className="px-4 py-3">Catatan</th>
							<th className="px-4 py-3">Verifikasi</th>
							<th className="px-4 py-3">Order 3 Bulan</th>
							<th className="px-4 py-3">Outstanding 3 Bulan</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{rows.map((row) => (
							<tr key={row.storeId}>
								<td className="px-4 py-3">
									<div className="font-medium text-slate-900">{row.storeName}</div>
									<div className="text-slate-500">{row.email}</div>
								</td>
								<td className="px-4 py-3 text-slate-900">
									<span className={`rounded-full px-2 py-1 text-xs font-semibold ${formatGradeTone(row.grade)}`}>
										{row.grade}
									</span>
								</td>
								<td className="px-4 py-3 text-slate-600">{row.gradeReason}</td>
								<td className="px-4 py-3 text-slate-700">{row.verificationStatus}</td>
								<td className="px-4 py-3 text-slate-700">{row.recentOrders}</td>
								<td className="px-4 py-3 text-slate-700">
									{row.recentOutstandingAmount.toLocaleString("id-ID")}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
		</SalesPortalShell>
	);
}
