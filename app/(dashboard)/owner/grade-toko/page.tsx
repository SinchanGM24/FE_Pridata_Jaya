"use client";

import { useEffect, useState } from "react";
import StoreGradeWorkspace from "@/components/grade/StoreGradeWorkspace";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { gradeService, type StoreGradeItem } from "@/services/grade";

export default function GradeTokoPage() {
	const [rows, setRows] = useState<StoreGradeItem[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);

	const load = async (query: string) => {
		setLoading(true);
		try {
			const data = await gradeService.list(query ? { search: query } : undefined);
			setRows(data);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load(search);
		}, 0);

		return () => window.clearTimeout(timer);
	}, [search]);

	return (
		<FeaturePage
			title="Grade Toko"
			description="Pantau grade seluruh toko, buka detail profil toko, dan lihat riwayat transaksi penilaian."
		>
			<StoreGradeWorkspace
				rows={rows}
				search={search}
				loading={loading}
				onSearchChange={setSearch}
				onRefresh={() => {
					void load(search);
				}}
			/>
		</FeaturePage>
	);
}
