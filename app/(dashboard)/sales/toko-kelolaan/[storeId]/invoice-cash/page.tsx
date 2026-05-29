"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import SalesPortalShell from "@/components/sales/SalesPortalShell";

export default function SalesStoreInvoiceCashRedirectPage() {
	const params = useParams<{ storeId: string }>();
	const router = useRouter();
	const storeId = params.storeId;

	useEffect(() => {
		router.replace(`/sales/konfirmasi-pembayaran?storeId=${storeId}`);
	}, [router, storeId]);

	return (
		<SalesPortalShell title="Konfirmasi Pembayaran">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
				Mengalihkan ke halaman konfirmasi pembayaran sales...
			</section>
		</SalesPortalShell>
	);
}
