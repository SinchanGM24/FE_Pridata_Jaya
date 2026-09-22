"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/shared/Modal";
import SearchCombobox from "@/components/shared/SearchCombobox";
import { FeaturePage } from "@/components/shared/FeaturePage";
import PageFeedback from "@/components/shared/PageFeedback";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/api-errors";
import { canManageWarehouseAssignments } from "@/lib/role-capabilities";
import { citiesService } from "@/services/cities";
import { membersService, type OrganizationMember } from "@/services/members";
import { warehouseAssignmentService, type WarehouseAssignment } from "@/services/warehouse-user-assignments";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";

type AssignmentStatus = "ALL" | "ASSIGNED" | "UNASSIGNED";

const normalize = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function PenugasanGudangPage() {
	const { user } = useAuth();
	const allowed = canManageWarehouseAssignments(user);
	const [staff, setStaff] = useState<OrganizationMember[]>([]);
	const [assignments, setAssignments] = useState<WarehouseAssignment[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [search, setSearch] = useState("");
	const [warehouseFilter, setWarehouseFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<AssignmentStatus>("ALL");
	const [selected, setSelected] = useState<OrganizationMember | null>(null);
	const [warehouseId, setWarehouseId] = useState("");
	const [notes, setNotes] = useState("");
	const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
	const [warehouseForm, setWarehouseForm] = useState({ name: "", address: "", cityId: "", cityName: "", province: "" });
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const load = useCallback(async () => {
		if (!allowed) return;
		setLoading(true);
		try {
			const [staffResult, assignmentResult, warehouseResult] = await Promise.all([
				membersService.listWarehouseStaff(),
				warehouseAssignmentService.getAll({ limit: 100 }),
				warehousesService.listAll(),
			]);
			setStaff(staffResult.items); setAssignments(assignmentResult.items); setWarehouses(warehouseResult);
		} catch (cause) { setError(getApiErrorMessage(cause, "Gagal memuat data penugasan gudang.")); }
		finally { setLoading(false); }
	}, [allowed]);
	useEffect(() => { void Promise.resolve().then(load); }, [load]);

	const assignmentsByUser = useMemo(() => new Map(assignments.filter((item) => item.isActive).map((item) => [item.userId, item])), [assignments]);
	const suspendedWarehouseUserIds = useMemo(() => new Set(assignments.filter((item) => !item.isActive && item.notes === "Gudang ditangguhkan").map((item) => item.userId)), [assignments]);
	const visibleStaff = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		return staff.filter((member) => {
			const assignment = assignmentsByUser.get(member.userId);
			const matchesSearch = !keyword || member.name.toLowerCase().includes(keyword) || member.email.toLowerCase().includes(keyword);
			const matchesWarehouse = !warehouseFilter || (assignment?.warehouseId ?? member.warehouse?.id) === warehouseFilter;
			const matchesStatus = statusFilter === "ALL" || (statusFilter === "ASSIGNED" ? Boolean(assignment) : !assignment);
			return matchesSearch && matchesWarehouse && matchesStatus;
		});
	}, [assignmentsByUser, search, staff, statusFilter, warehouseFilter]);

	const openAssignment = (member: OrganizationMember) => {
		const assignment = assignmentsByUser.get(member.userId);
		setSelected(member); setWarehouseId(assignment?.warehouseId ?? member.warehouse?.id ?? ""); setNotes(assignment?.notes ?? "");
	};
	const closeAssignment = () => { if (!saving) { setSelected(null); setWarehouseId(""); setNotes(""); } };
	const saveAssignment = async () => {
		if (!selected || !warehouseId) { setError("Pilih gudang untuk akun ini."); return; }
		setSaving(true);
		try {
			await warehouseAssignmentService.assign({ userId: selected.userId, warehouseId, notes: notes.trim() || undefined });
			setSuccess(`Penugasan ${selected.name} berhasil disimpan.`); setSelected(null); setWarehouseId(""); setNotes(""); await load();
		} catch (cause) { setError(getApiErrorMessage(cause, "Gagal menyimpan penugasan gudang.")); }
		finally { setSaving(false); }
	};
	const suspendWarehouse = async () => {
		if (!selected) return;
		const assignment = assignmentsByUser.get(selected.userId);
		if (!assignment || !window.confirm(`Tangguhkan gudang untuk ${selected.name}? Akun tetap aktif, tetapi tidak dapat mengakses fitur yang memerlukan gudang sampai ditugaskan kembali.`)) return;
		setSaving(true);
		try {
			await warehouseAssignmentService.revoke(assignment.id);
			setSuccess(`Gudang untuk ${selected.name} ditangguhkan. Akun tetap aktif.`);
			await load();
		} catch (cause) { setError(getApiErrorMessage(cause, "Gagal menangguhkan gudang.")); }
		finally { setSaving(false); }
	};
	const createWarehouse = async () => {
		const name = normalize(warehouseForm.name), address = normalize(warehouseForm.address), cityName = normalize(warehouseForm.cityName), province = normalize(warehouseForm.province);
		if (!name || !address || (!warehouseForm.cityId && (!cityName || !province))) { setError("Nama, alamat, serta kota wajib diisi."); return; }
		setSaving(true);
		try {
			const cityId = warehouseForm.cityId || (await citiesService.create({ name: cityName, province })).id;
			await warehousesService.create({ name, address, cityId });
			setWarehouseForm({ name: "", address: "", cityId: "", cityName: "", province: "" }); setWarehouseModalOpen(false); setSuccess("Gudang baru berhasil ditambahkan."); await load();
		} catch (cause) { setError(getApiErrorMessage(cause, "Gagal menambahkan gudang.")); }
		finally { setSaving(false); }
	};

	if (!allowed) return <FeaturePage title="Penugasan Gudang" description="Halaman ini khusus untuk manager gudang." />;
	return <FeaturePage title="Penugasan Gudang" description="Kelola akun warehouse staff dan tetapkan tepat satu gudang aktif untuk setiap akun." actionsDescription="Kelola lokasi gudang dan penugasan akun gudang dalam satu area kerja." actions={[{ label: "Tambah Gudang", onClick: () => setWarehouseModalOpen(true), tone: "secondary" }]}>
		<PageFeedback error={error} success={success} onDismissError={() => setError("")} onDismissSuccess={() => setSuccess("")} />
		<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><p className="text-sm font-semibold text-slate-900">Akun Gudang <span className="font-normal text-slate-500">({visibleStaff.length})</span></p><div className="flex flex-col gap-2 md:flex-row"><input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Cari nama atau email..." value={search} onChange={(event) => setSearch(event.target.value)} /><select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}><option value="">Semua Gudang</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AssignmentStatus)}><option value="ALL">Semua Status</option><option value="ASSIGNED">Ditugaskan</option><option value="UNASSIGNED">Belum Ditugaskan</option></select></div></div>
			<table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500"><tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Gudang</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="px-4 py-5 text-slate-600">Memuat...</td></tr> : null}{!loading && visibleStaff.length === 0 ? <tr><td colSpan={5} className="px-4 py-5 text-slate-600">Tidak ada akun gudang.</td></tr> : null}{visibleStaff.map((member) => { const assignment = assignmentsByUser.get(member.userId); const suspended = !assignment && suspendedWarehouseUserIds.has(member.userId); return <tr key={member.id}><td className="px-4 py-3 font-medium text-slate-900">{member.name}</td><td className="px-4 py-3 text-slate-700">{member.email}</td><td className="px-4 py-3 text-slate-700">{assignment?.warehouse?.name ?? member.warehouse?.name ?? "-"}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${assignment ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : suspended ? "border border-slate-300 bg-slate-100 text-slate-700" : "border border-amber-200 bg-amber-50 text-amber-700"}`}>{assignment ? "Ditugaskan" : suspended ? "Gudang ditangguhkan" : "Belum ditugaskan"}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => openAssignment(member)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Ubah</button></td></tr>; })}</tbody></table>
		</section>
		<Modal isOpen={Boolean(selected)} onClose={closeAssignment} title={assignmentsByUser.get(selected?.userId ?? "") ? "Ubah Penugasan Gudang" : "Tugaskan Akun Gudang"}><div className="space-y-4"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">{selected?.name}</p><p className="text-sm text-slate-600">{selected?.email}</p></div><label className="block text-sm font-medium text-slate-700">Gudang<select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"><option value="">Pilih gudang</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Catatan <span className="font-normal text-slate-400">(opsional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" /></label><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-medium text-slate-900">Status Gudang</p><p className="mt-1 text-xs text-slate-500">Menangguhkan gudang mencabut penugasan. Akun tetap aktif, tetapi tidak dapat memakai fitur yang membutuhkan gudang hingga ditugaskan kembali.</p>{assignmentsByUser.get(selected?.userId ?? "") ? <button type="button" onClick={() => void suspendWarehouse()} disabled={saving} className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Tangguhkan Gudang</button> : null}</div><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={closeAssignment} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">Batal</button><button type="button" onClick={() => void saveAssignment()} disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Menyimpan..." : "Simpan Penugasan"}</button></div></div></Modal>
		<Modal isOpen={warehouseModalOpen} onClose={() => !saving && setWarehouseModalOpen(false)} title="Tambah Gudang"><div className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm text-slate-700"><span>Nama Gudang</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={warehouseForm.name} onChange={(event) => setWarehouseForm((value) => ({ ...value, name: event.target.value }))} /></label><label className="space-y-2 text-sm text-slate-700 md:col-span-2"><span>Alamat</span><textarea className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2" value={warehouseForm.address} onChange={(event) => setWarehouseForm((value) => ({ ...value, address: event.target.value }))} /></label><SearchCombobox label="Kota" value={warehouseForm.cityId} loadOptions={async (query) => (await citiesService.search(query)).map((city) => ({ value: city.id, label: city.name, description: city.province }))} onChange={(cityId) => setWarehouseForm((value) => ({ ...value, cityId, cityName: cityId ? "" : value.cityName, province: cityId ? "" : value.province }))} placeholder="Cari kota" /><p className="text-xs text-slate-500 md:col-span-2">Untuk kota baru, kosongkan pilihan kota lalu isi nama kota dan provinsi.</p><label className="space-y-2 text-sm text-slate-700"><span>Nama Kota Baru</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2" disabled={Boolean(warehouseForm.cityId)} value={warehouseForm.cityName} onChange={(event) => setWarehouseForm((value) => ({ ...value, cityId: "", cityName: event.target.value }))} /></label><label className="space-y-2 text-sm text-slate-700"><span>Provinsi Baru</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2" disabled={Boolean(warehouseForm.cityId)} value={warehouseForm.province} onChange={(event) => setWarehouseForm((value) => ({ ...value, cityId: "", province: event.target.value }))} /></label></div><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setWarehouseModalOpen(false)} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">Batal</button><button type="button" onClick={() => void createWarehouse()} disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Menyimpan..." : "Simpan Gudang"}</button></div></div></Modal>
	</FeaturePage>;
}
