"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { gradeService, type StoreGradeItem } from "@/services/grade";

export default function GradeTokoPage() {
	const [rows, setRows] = useState<StoreGradeItem[]>([]);
	const [search, setSearch] = useState("");

	useEffect(() => {
		let mounted = true;
		gradeService.list(search ? { search } : undefined).then((data) => {
			if (mounted) setRows(data);
		}).catch(() => {});

		return () => {
			mounted = false;
		};
	}, [search]);

	return (
		<FeaturePage
			title="Grade Toko"
			description="Halaman grade toko FE2 kini membaca facade `BE2 /grade-toko`, sehingga bisa dipakai lintas owner, sales, akuntan, dan toko untuk memantau kualitas pelanggan dan outstanding."
		>
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
							<th className="px-4 py-3">Verifikasi</th>
							<th className="px-4 py-3">Order</th>
							<th className="px-4 py-3">Outstanding</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{rows.map((row) => (
							<tr key={row.storeId}>
								<td className="px-4 py-3">
									<div className="font-medium text-slate-900">{row.storeName}</div>
									<div className="text-slate-500">{row.email}</div>
								</td>
								<td className="px-4 py-3 text-slate-900">{row.grade}</td>
								<td className="px-4 py-3 text-slate-700">{row.verificationStatus}</td>
								<td className="px-4 py-3 text-slate-700">{row.totalOrders}</td>
								<td className="px-4 py-3 text-slate-700">
									{row.totalOutstandingAmount.toLocaleString("id-ID")}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
		</FeaturePage>
	);
}
