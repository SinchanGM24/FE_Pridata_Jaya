"use client";

import { useEffect, useState } from "react";
import StoreGradeWorkspace from "@/components/grade/StoreGradeWorkspace";
import SalesPortalShell from "@/components/sales/SalesPortalShell";
import { getApiErrorMessage } from "@/lib/api-errors";
import { gradeService, type StoreGradeItem } from "@/services/grade";

export default function SalesGradeTokoPage() {
	const [rows, setRows] = useState<StoreGradeItem[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = async (query: string) => {
		setLoading(true);
		setError("");
		try {
			const data = await gradeService.listForSales(query ? { search: query } : undefined);
			setRows(data);
		} catch (err) {
			setError(getApiErrorMessage(err, "Gagal memuat grade toko kelolaan."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void load(search);
		}, 350);

		return () => window.clearTimeout(timer);
	}, [search]);

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
				loading={loading}
				onSearchChange={setSearch}
				transactionDetailSource="sales"
			/>
		</SalesPortalShell>
	);
}
