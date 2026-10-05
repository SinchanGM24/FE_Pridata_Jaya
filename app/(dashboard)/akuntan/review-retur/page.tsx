"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import PageFeedback from "@/components/shared/PageFeedback";
import { formatRupiah } from "@/lib/format";
import { storeReturnsService, type StoreReturnRequestItem } from "@/services/store-returns";

export default function AccountantReturnReviewPage() {
	const [items, setItems] = useState<StoreReturnRequestItem[]>([]);
	const [selected, setSelected] = useState<StoreReturnRequestItem | null>(null);
	const [note, setNote] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const load = useCallback(async () => {
		try {
			const result = await storeReturnsService.list({ limit: 100, sortBy: "submittedAt", sortOrder: "asc" });
			setItems(result.items.filter((item) => item.lifecycleStatus === "ACCOUNTING_REVIEW"));
		} catch { setError("Gagal memuat antrean review retur."); }
	}, []);
	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, [load]);
	const estimate = (item: StoreReturnRequestItem) => item.items.reduce((sum, line) => sum + (line.receivedQuantity ?? 0) * line.unitPriceSnapshot, 0);
	const approve = async () => { if (!selected) return; setSaving(true); try { await storeReturnsService.approveCredit(selected.id, note || undefined); setSelected(null); setNote(""); await load(); } catch { setError("Persetujuan kredit gagal diproses."); } finally { setSaving(false); } };
	const redirect = async () => { if (!selected || !note.trim()) { setError("Alasan penolakan kredit wajib diisi."); return; } setSaving(true); try { await storeReturnsService.rejectCreditToReplacement(selected.id, note); setSelected(null); setNote(""); await load(); } catch { setError("Pengalihan ke barang pengganti gagal diproses."); } finally { setSaving(false); } };
	return <FeaturePage title="Review Retur" description="Tentukan kompensasi saldo atas barang retur yang telah diterima gudang.">
		<PageFeedback error={error} onDismissError={() => setError("")} />
		<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Retur</th><th className="p-3">Toko</th><th className="p-3">Invoice</th><th className="p-3 text-right">Estimasi</th><th className="p-3" /></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.requestNumber}</td><td className="p-3">{item.store?.name}</td><td className="p-3">{item.invoice?.invoiceNumber}</td><td className="p-3 text-right">{formatRupiah(estimate(item))}</td><td className="p-3 text-right"><button className="rounded-lg border px-3 py-1.5 text-indigo-700" onClick={() => { setSelected(item); setNote(""); }}>Review</button></td></tr>)}</tbody></table>{!items.length ? <p className="p-6 text-center text-slate-500">Tidak ada retur menunggu keputusan akuntan.</p> : null}</section>
		<Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title="Keputusan Kredit Retur">{selected ? <div className="space-y-4 text-sm"><p>Nilai mengikuti harga invoice dan kuantitas yang diterima gudang. Sisa tagihan invoice asal akan dikurangi terlebih dahulu; nilai lebih langsung masuk ke saldo toko.</p><div className="rounded-lg bg-slate-50 p-3">Estimasi nilai retur: <strong>{formatRupiah(estimate(selected))}</strong><br />Sisa invoice: <strong>{formatRupiah(selected.invoice?.remainingAmount ?? 0)}</strong></div><textarea className="min-h-24 w-full rounded-lg border p-2" value={note} onChange={event => setNote(event.target.value)} placeholder="Catatan persetujuan atau alasan alihkan ke barang pengganti" /><div className="flex justify-end gap-2"><button className="rounded-lg border px-3 py-2" onClick={() => void redirect()} disabled={saving}>Tolak Kredit → Penggantian</button><button className="rounded-lg bg-indigo-600 px-3 py-2 text-white" onClick={() => void approve()} disabled={saving}>Setujui Kredit</button></div></div> : null}</Modal>
	</FeaturePage>;
}
