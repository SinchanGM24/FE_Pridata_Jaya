"use client";

import { useCallback, useEffect, useState } from "react";
import StoreGradeCriteria from "@/components/grade/StoreGradeCriteria";
import StoreGradeWorkspace, { type GradeFilter } from "@/components/grade/StoreGradeWorkspace";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { gradeService, type GradePaginationMeta, type StoreGradeItem } from "@/services/grade";

export default function SalesGradeTokoPage() {
	const [rows, setRows] = useState<StoreGradeItem[]>([]);
	const [search, setSearch] = useState("");
	const [gradeFilter, setGradeFilter] = useState<GradeFilter>("ALL");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [page, setPage] = useState(1);
	const [meta, setMeta] = useState<GradePaginationMeta | null>(null);

	const load = useCallback(async (query: string) => {
		setLoading(true);
		setError("");
		try {
			const result = await gradeService.listForSalesPage({
				page,
				limit: 10,
				search: query || undefined,
				grade: gradeFilter === "ALL" ? undefined : gradeFilter,
			});
			setRows(result.data);
			setMeta(result.meta ?? null);
		} catch (err) {
			setError(getApiErrorMessage(err, "Gagal memuat grade toko kelolaan."));
		} finally {
			setLoading(false);
		}
	}, [gradeFilter, page]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load(search);
		}, 350);

		return () => window.clearTimeout(timer);
	}, [load, search]);

	return (
		<SalesPortalShell title="Grade Toko Kelolaan">
			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			<StoreGradeWorkspace
				rows={rows}
				search={search}
				gradeFilter={gradeFilter}
				loading={loading}
				onSearchChange={(value) => { setSearch(value); setPage(1); }}
				onGradeFilterChange={(value) => { setGradeFilter(value); setPage(1); }}
				transactionDetailSource="sales"
				pagination={meta}
				onPageChange={setPage}
			/>
			<StoreGradeCriteria />
		</SalesPortalShell>
	);
}
