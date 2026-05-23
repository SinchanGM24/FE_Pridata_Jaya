"use client";

import { useEffect, useMemo, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { mapDamagedGoods, type DamagedGoodsItem } from "@/services/damaged-goods";
import { stockAdjustmentsService } from "@/services/stock-adjustments";

const sourceTone: Record<DamagedGoodsItem["source"], string> = {
	"Penerimaan Barang": "bg-amber-100 text-amber-800",
	"Retur Barang": "bg-sky-100 text-sky-800",
};

const damageTone: Record<DamagedGoodsItem["damageType"], string> = {
	DAMAGED: "bg-rose-100 text-rose-800",
};

const periodOptions = ["Semua Periode", "Hari Ini", "Minggu Ini", "Bulan Ini"] as const;

const matchesPeriod = (reportDate: string, period: (typeof periodOptions)[number]) => {
	if (period === "Semua Periode") {
		return true;
	}

	const target = new Date(reportDate);
	const now = new Date();
	if (Number.isNaN(target.getTime())) {
		return false;
	}

	if (period === "Hari Ini") {
		return target.toDateString() === now.toDateString();
	}

	if (period === "Minggu Ini") {
		const diff = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
		return diff >= 0 && diff <= 7;
	}

	return target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear();
};

export default function BarangRusakPage() {
	const [rows, setRows] = useState<DamagedGoodsItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [sourceFilter, setSourceFilter] = useState<"Semua Sumber" | DamagedGoodsItem["source"]>(
		"Semua Sumber",
	);
	const [periodFilter, setPeriodFilter] = useState<(typeof periodOptions)[number]>("Semua Periode");
	const [partyFilter, setPartyFilter] = useState("Semua Pihak");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const records = await stockAdjustmentsService.listAll({
				type: "RECEIPT",
				sortBy: "transactionDate",
				sortOrder: "desc",
			});
			setRows(mapDamagedGoods(records));
		} catch (loadError: unknown) {
			setError(getApiErrorMessage(loadError, "Gagal memuat data barang rusak."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load();
		}, 0);
		return () => window.clearTimeout(timer);
	}, []);

	const partyOptions = useMemo(
		() => ["Semua Pihak", ...Array.from(new Set(rows.map((item) => item.relatedParty))).filter(Boolean)],
		[rows],
	);

	const filteredRows = useMemo(
		() =>
			rows.filter((item) => {
				const matchSource = sourceFilter === "Semua Sumber" || item.source === sourceFilter;
				const matchParty = partyFilter === "Semua Pihak" || item.relatedParty === partyFilter;
				return matchSource && matchParty && matchesPeriod(item.reportDate, periodFilter);
			}),
		[partyFilter, periodFilter, rows, sourceFilter],
	);

	const summary = useMemo(
		() => ({
			totalReports: filteredRows.length,
			totalUnits: filteredRows.reduce((sum, item) => sum + item.quantity, 0),
			fromReceipt: filteredRows.filter((item) => item.source === "Penerimaan Barang").length,
			fromReturn: filteredRows.filter((item) => item.source === "Retur Barang").length,
		}),
		[filteredRows],
	);

	return (
		<FeaturePage
			title="Monitoring Barang Rusak"
			description="Barang rusak terbentuk otomatis dari dua alur: penerimaan supplier yang tercatat rusak dan retur customer yang diverifikasi rusak. FE2 membedakan sumbernya agar mudah ditelusuri."
			actions={[
				{
					label: loading ? "Memuat..." : "Refresh",
					onClick: () => {
						if (loading) return;
						void load();
					},
				},
			]}
		>
			<section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 shadow-sm">
				Sumber kerusakan dipisahkan menjadi <span className="font-semibold">Penerimaan Barang</span>{" "}
				untuk kerusakan dari supplier dan <span className="font-semibold">Retur Barang</span> untuk
				kerusakan dari barang customer yang kembali ke gudang.
			</section>

			<section className="grid gap-4 md:grid-cols-4">
				{[
					["Total Laporan", summary.totalReports],
					["Total Unit Rusak", summary.totalUnits],
					["Dari Penerimaan", summary.fromReceipt],
					["Dari Retur", summary.fromReturn],
				].map(([label, value]) => (
					<div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">{label}</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-3">
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={sourceFilter}
						onChange={(event) =>
							setSourceFilter(event.target.value as "Semua Sumber" | DamagedGoodsItem["source"])
						}
					>
						<option value="Semua Sumber">Semua Sumber</option>
						<option value="Penerimaan Barang">Penerimaan Barang</option>
						<option value="Retur Barang">Retur Barang</option>
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={periodFilter}
						onChange={(event) =>
							setPeriodFilter(event.target.value as (typeof periodOptions)[number])
						}
					>
						{periodOptions.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
					<select
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
						value={partyFilter}
						onChange={(event) => setPartyFilter(event.target.value)}
					>
						{partyOptions.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				</div>
			</section>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
						<tr>
							<th className="px-4 py-3">Tanggal</th>
							<th className="px-4 py-3">Sumber</th>
							<th className="px-4 py-3">Referensi</th>
							<th className="px-4 py-3">Pihak Terkait</th>
							<th className="px-4 py-3">Produk</th>
							<th className="px-4 py-3">Jenis</th>
							<th className="px-4 py-3 text-right">Qty Rusak</th>
							<th className="px-4 py-3">Keterangan</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{loading ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Memuat data barang rusak...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td className="px-4 py-4 text-slate-600" colSpan={8}>
									Belum ada barang rusak yang tercatat dari penerimaan atau retur.
								</td>
							</tr>
						) : (
							filteredRows.map((item) => (
								<tr key={item.id}>
									<td className="px-4 py-3 text-slate-700">{String(item.reportDate).slice(0, 10)}</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-3 py-1 text-xs font-medium ${sourceTone[item.source]}`}
										>
											{item.source}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">
										<div className="font-medium text-slate-900">{item.reportNumber}</div>
										<div className="text-xs text-slate-500">{item.referenceNumber}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">
										<div>{item.relatedParty}</div>
										<div className="text-xs text-slate-500">{item.warehouseName}</div>
									</td>
									<td className="px-4 py-3 text-slate-700">{item.productName}</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-3 py-1 text-xs font-medium ${damageTone[item.damageType]}`}
										>
											Rusak
										</span>
									</td>
									<td className="px-4 py-3 text-right font-semibold text-rose-700">{item.quantity}</td>
									<td className="px-4 py-3 text-slate-600">{item.description || "-"}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</section>
		</FeaturePage>
	);
}
