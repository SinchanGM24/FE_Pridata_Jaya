"use client";

import Link from "next/link";
import { Bell, CalendarDays, ChevronRight, Search } from "lucide-react";
import PaginationControls from "@/components/shared/PaginationControls";
import type { NotificationItem, TransactionTrace } from "@/services/notifications";

const rupiah = (value?: number | null) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value ?? 0);
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "Tanggal belum tercatat";

const activitySections = [
	{ id: "sales-store", title: "Fakturis & Toko", description: "Pesanan baru dan pemeriksaan toko.", categories: ["ORDER", "STORE", "INVOICE"] as const },
	{ id: "warehouse", title: "Gudang & Pengiriman", description: "DO, retur, transfer, dan proses stok.", categories: ["DELIVERY", "INVENTORY", "RETURN"] as const },
	{ id: "finance", title: "Keuangan", description: "Pembayaran masuk dan pencatatan retur.", categories: ["PAYMENT"] as const },
	{ id: "reports", title: "Laporan & Sistem", description: "Impor, ekspor, dan masalah sistem.", categories: ["REPORT", "SYSTEM"] as const },
] as const;

export default function MonitorView({ activityItems, onOpenActivity, workflows, workflowLoading, workflowSearch, workflowPage, workflowMeta, onWorkflowSearch, onWorkflowPage }: {
	activityItems: NotificationItem[];
	onOpenActivity: (item: NotificationItem) => void;
	workflows: TransactionTrace[]; workflowLoading: boolean; workflowSearch: string; workflowPage: number;
	workflowMeta: { totalPages: number; totalItems: number }; onWorkflowSearch: (value: string) => void; onWorkflowPage: (page: number) => void; [key: string]: unknown;
}) {
	const groupedActivities = activitySections.map((section) => ({
		...section,
		items: activityItems.filter((item) => item.category && (section.categories as readonly string[]).includes(item.category)).slice(0, 4),
	}));

	return <div className="space-y-5">
		<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Progres transaksi</h2><p className="text-sm text-slate-500">Buka detail untuk melihat seluruh perjalanan transaksi.</p></div><label className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={workflowSearch} onChange={(event) => onWorkflowSearch(event.target.value)} placeholder="Invoice, pesanan, atau toko" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400" /></label></div>
			{workflowLoading ? <p className="p-5 text-sm text-slate-500">Memuat transaksi...</p> : workflows.length === 0 ? <p className="p-5 text-sm text-slate-500">Tidak ada transaksi yang sesuai.</p> : <div className="divide-y divide-slate-100">{workflows.map((workflow) => <div key={workflow.order.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{workflow.invoice?.number ?? workflow.order.number}</p><p className="mt-1 text-sm text-slate-600">{workflow.store.name}</p></div><p className="inline-flex items-center gap-1.5 text-sm text-slate-500 lg:w-44"><CalendarDays className="h-4 w-4 text-slate-400" />{formatDate(workflow.invoice?.createdAt ?? workflow.order.createdAt)}</p><p className="text-sm font-semibold text-slate-900 lg:w-40 lg:text-right">{rupiah(workflow.totalAmount)}</p><Link href={`/notifications/transaksi/${workflow.order.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300">Buka Detail Lengkap <ChevronRight className="h-4 w-4" /></Link></div>)}</div>}
			{workflowMeta.totalPages > 1 ? <div className="border-t border-slate-100 px-4"><PaginationControls currentPage={workflowPage} totalPages={workflowMeta.totalPages} totalItems={workflowMeta.totalItems} currentItemCount={workflows.length} pageSize={12} itemLabel="transaksi" loading={workflowLoading} onPageChange={onWorkflowPage} /></div> : null}
		</section>

		<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Aktivitas operasional</h2><p className="text-sm text-slate-500">Ringkasan terbaru berdasarkan fungsi kerja. Klik baris untuk membuka dokumen terkait.</p></div><Bell className="h-5 w-5 text-sky-600" /></div>
			<div className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">{groupedActivities.map((section) => <div key={section.id} className="min-w-0 p-5"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">{section.title}</h3><p className="mt-0.5 text-xs text-slate-500">{section.description}</p></div><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{section.items.length}</span></div>{section.items.length ? <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">{section.items.map((item) => <button key={item.id} type="button" onClick={() => onOpenActivity(item)} className="block w-full px-3 py-3 text-left transition hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{item.message}</p></div><span className="shrink-0 text-[11px] text-slate-400">{formatDate(item.createdAt)}</span></div></button>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">Belum ada aktivitas terbaru.</p>}</div>)}</div>
		</section>
	</div>;
}
