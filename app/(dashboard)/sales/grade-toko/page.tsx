"use client";

import { useEffect, useState } from "react";
import StoreGradeWorkspace from "@/components/grade/StoreGradeWorkspace";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { gradeService, type StoreGradeItem } from "@/services/grade";

export default function SalesGradeTokoPage() {
	const [rows, setRows] = useState<StoreGradeItem[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);

	const load = async (query: string) => {
		setLoading(true);
		try {
			const data = await gradeService.listForSales(query ? { search: query } : undefined);
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
		<SalesPortalShell title="Grade Toko Kelolaan">
			<StoreGradeWorkspace
				rows={rows}
				search={search}
				loading={loading}
				onSearchChange={setSearch}
				transactionDetailSource="sales"
				onRefresh={() => {
					void load(search);
				}}
			/>
		</SalesPortalShell>
	);
}
