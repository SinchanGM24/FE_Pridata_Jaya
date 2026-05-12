"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { gradeService, type StoreGradeItem } from "@/services/grade";

export default function StoreMyGradePage() {
	const [grades, setGrades] = useState<StoreGradeItem[]>([]);

	useEffect(() => {
		gradeService.listForToko().then(setGrades).catch(() => {});
	}, []);

	const grade = grades[0];

	return (
		<FeaturePage
			title="Grade Saya"
			description="Grade toko aktif berdasarkan akun toko yang sedang login."
		>
			<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
				<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Grade Aktif</p>
				<p className="mt-4 text-6xl font-semibold text-slate-900">{grade?.grade ?? "-"}</p>
				<p className="mt-3 text-sm text-slate-600">
					Outstanding: {(grade?.totalOutstandingAmount ?? 0).toLocaleString("id-ID")}
				</p>
			</div>
		</FeaturePage>
	);
}
