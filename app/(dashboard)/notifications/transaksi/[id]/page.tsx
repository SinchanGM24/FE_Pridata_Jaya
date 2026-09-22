"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, Truck } from "lucide-react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { notificationsService, type TransactionTrace } from "@/services/notifications";

const documentRoutes: Record<string, string> = { ORDER: "/fakturis/pesanan-masuk", INVOICE: "/akuntan/invoice-pembayaran", PAYMENT: "/akuntan/invoice-pembayaran", DELIVERY_ORDER: "/gudang/pengiriman", RETURN: "/gudang/retur-barang" };
const roleLabels: Record<string, string> = { sales: "Sales", invoicist: "Fakturis", accountant: "Akuntan", warehouse_staff: "Staf Gudang", warehouse_manager: "Manajer Gudang", owner: "Owner", admin: "Admin" };
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Belum tercatat";
const formatCurrency = (value?: number | null) => `Rp${(value ?? 0).toLocaleString("id-ID")}`;

function stepStyle(state: string) {
	if (state === "COMPLETED") return { tone: "bg-emerald-100 text-emerald-700", label: "Selesai", Icon: CheckCircle2 };
	if (state === "ACTIVE") return { tone: "bg-sky-100 text-sky-700", label: "Berjalan", Icon: Truck };
	if (state === "CANCELLED") return { tone: "bg-red-100 text-red-700", label: "Dibatalkan", Icon: AlertTriangle };
	if (state === "FAILED") return { tone: "bg-red-100 text-red-700", label: "Gagal", Icon: AlertTriangle };
	return { tone: "bg-slate-100 text-slate-500", label: "Menunggu", Icon: ClipboardList };
}

export default function TransactionWorkflowDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const [workflow, setWorkflow] = useState<TransactionTrace | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!params.id) return;
		void notificationsService.getTransactionWorkflow(params.id)
			.then(setWorkflow)
			.catch((cause) => setError(getApiErrorMessage(cause, "Gagal memuat detail transaksi.")));
	}, [params.id]);

	return <FeaturePage title="Detail Progres Transaksi" description="Riwayat lengkap proses, waktu, dan pelaku untuk satu transaksi.">
		{error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : !workflow ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Memuat transaksi...</p> : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-4">
				<div><p className="text-xs text-slate-500">Toko</p><p className="font-semibold text-slate-900">{workflow.store.name}</p><p className="text-xs text-slate-500">{workflow.store.address || "Alamat tidak tercatat"}</p></div>
				<div><p className="text-xs text-slate-500">Pesanan / Invoice</p><p className="font-semibold text-slate-900">{workflow.order.number}{workflow.invoice ? ` · ${workflow.invoice.number}` : ""}</p></div>
				<div><p className="text-xs text-slate-500">Nilai transaksi</p><p className="font-semibold text-slate-900">{formatCurrency(workflow.totalAmount)}</p></div>
				<div><p className="text-xs text-slate-500">Sisa tagihan</p><p className="font-semibold text-slate-900">{formatCurrency(workflow.remainingAmount)}</p></div>
			</div>

			<div className="mt-5 space-y-3">
				{workflow.timeline.map((step, index) => {
					const { tone, label, Icon } = stepStyle(step.state);
					return <div key={step.id} className="relative flex gap-3">
						<div className="flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>{index < workflow.timeline.length - 1 ? <span className="mt-1 h-full w-px bg-slate-200" /> : null}</div>
						<div className="min-w-0 flex-1 pb-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{step.label}</p><p className="mt-0.5 text-sm text-slate-600">{step.description || (step.state === "PENDING" ? "Menunggu tahap sebelumnya selesai." : "Tidak ada rincian tambahan.")}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{label}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{formatDate(step.occurredAt)}</span><span>{step.actorName || "Pelaku tidak tercatat"}{step.actorRole ? ` · ${roleLabels[step.actorRole] ?? step.actorRole}` : ""}</span>{step.document ? <button type="button" onClick={() => router.push(documentRoutes[step.document!.type] ?? "/notifications")} className="font-semibold text-sky-700 hover:underline">{step.document.number}</button> : null}</div></div>
					</div>;
				})}
			</div>
			<Link href="/notifications?tab=monitor" className="mt-6 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700">Kembali ke Pantau Aktivitas</Link>
		</section>}
	</FeaturePage>;
}
