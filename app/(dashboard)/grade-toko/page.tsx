"use client";

import { useCallback, useEffect, useState } from "react";
import StoreGradeCriteria from "@/components/grade/StoreGradeCriteria";
import StoreGradeWorkspace, { type GradeFilter } from "@/components/grade/StoreGradeWorkspace";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { gradeService, type GradePaginationMeta, type StoreGradeItem } from "@/services/grade";

export default function GradeTokoPage() {
	const [rows, setRows] = useState<StoreGradeItem[]>([]);
	const [search, setSearch] = useState("");
	const [gradeFilter, setGradeFilter] = useState<GradeFilter>("ALL");
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [meta, setMeta] = useState<GradePaginationMeta | null>(null);

	const load = useCallback(async (query: string) => {
		setLoading(true);
		try {
			const result = await gradeService.listPage({
				page,
				limit: 10,
				search: query || undefined,
				grade: gradeFilter === "ALL" ? undefined : gradeFilter,
			});
			setRows(result.data);
			setMeta(result.meta ?? null);
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
		<FeaturePage
			title="Grade Toko"
			description="Pantau grade seluruh toko, buka detail profil toko, dan lihat riwayat transaksi penilaian."
		>
			<StoreGradeWorkspace
				rows={rows}
				search={search}
				gradeFilter={gradeFilter}
				loading={loading}
				onSearchChange={(value) => { setSearch(value); setPage(1); }}
				onGradeFilterChange={(value) => { setGradeFilter(value); setPage(1); }}
				pagination={meta}
				onPageChange={setPage}
			/>
			<StoreGradeCriteria />
		</FeaturePage>
	);
}
