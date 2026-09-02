"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/shared/Modal";
import {
	warehouseAssignmentService,
	type WarehouseAssignment,
} from "@/services/warehouse-user-assignments";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";
import type { User } from "@/types";

interface OwnerWarehouseAssignmentModalProps {
	open: boolean;
	user: User | null;
	assignment: WarehouseAssignment | null;
	onClose: () => void;
	onSaved: () => void;
}

export default function OwnerWarehouseAssignmentModal({
	open,
	user,
	assignment,
	onClose,
	onSaved,
}: OwnerWarehouseAssignmentModalProps) {
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [prevOpen, setPrevOpen] = useState(open);

	const isAssigned = !!assignment?.isActive;

	if (open !== prevOpen) {
		setPrevOpen(open);
		if (open) {
			setSelectedWarehouseId("");
			setNotes("");
			setError("");
		}
	}

	const loadWarehouses = useCallback(async () => {
		setLoading(true);
		try {
			const items = await warehousesService.listAll();
			setWarehouses(items);
		} catch {
			setError("Gagal memuat daftar gudang.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!open) return;
		const timer = window.setTimeout(() => {
			void loadWarehouses();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [open, loadWarehouses]);

	const handleAssign = async () => {
		if (!user || !selectedWarehouseId) {
			setError("Pilih gudang terlebih dahulu.");
			return;
		}
		setSaving(true);
		setError("");
		try {
			await warehouseAssignmentService.assign({
				userId: user.id,
				warehouseId: selectedWarehouseId,
				notes: notes.trim() || undefined,
			});
			onSaved();
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Gagal menugaskan user ke gudang.";
			setError(message);
		} finally {
			setSaving(false);
		}
	};

	const handleRevoke = async () => {
		if (!assignment) return;
		setSaving(true);
		setError("");
		try {
			await warehouseAssignmentService.revoke(assignment.id);
			onSaved();
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Gagal mencabut penugasan gudang.";
			setError(message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			isOpen={open}
			onClose={onClose}
			title={`Penugasan Gudang — ${user?.name ?? ""}`}
		>
			<div className="space-y-4">
				{/* Current assignment info */}
				{isAssigned && assignment?.warehouse ? (
					<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
							Saat Ditugaskan Ke
						</p>
						<p className="mt-1 text-sm font-medium text-emerald-800">
							{assignment.warehouse.name}
							{assignment.warehouse.city
								? ` — ${assignment.warehouse.city.name}`
								: ""}
						</p>
						<p className="mt-1 text-xs text-emerald-600">
							Sejak{" "}
							{new Date(assignment.assignedAt).toLocaleDateString("id-ID", {
								day: "2-digit",
								month: "long",
								year: "numeric",
							})}
						</p>
					</div>
				) : (
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
						Belum ditugaskan ke gudang manapun.
					</div>
				)}

				{error && (
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				)}

				{/* Assign form */}
				<div className="space-y-3">
					<div>
						<label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
							Pilih Gudang
						</label>
						{loading ? (
							<p className="text-sm text-slate-500">Memuat gudang...</p>
						) : (
							<select
								className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								value={selectedWarehouseId}
								onChange={(e) => setSelectedWarehouseId(e.target.value)}
							>
								<option value="">— Pilih Gudang —</option>
								{warehouses.map((wh) => (
									<option key={wh.id} value={wh.id}>
										{wh.name}
										{wh.city ? ` (${wh.city.name})` : ""}
									</option>
								))}
							</select>
						)}
					</div>

					<div>
						<label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
							Catatan (Opsional)
						</label>
						<textarea
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							rows={2}
							placeholder="Contoh: Ditugaskan ke Gudang Pusat"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-between border-t border-slate-200 pt-4">
					<div>
						{isAssigned ? (
							<button
								type="button"
								onClick={handleRevoke}
								disabled={saving}
								className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
							>
								{saving ? "Mencabut..." : "Cabut Penugasan"}
							</button>
						) : null}
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleAssign}
							disabled={saving || !selectedWarehouseId}
							className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
						>
							{saving ? "Menyimpan..." : isAssigned ? "Ganti Gudang" : "Tugaskan"}
						</button>
					</div>
				</div>
			</div>
		</Modal>
	);
}
