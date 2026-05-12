"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FeaturePage } from "@/components/shared/FeaturePage";
import Modal from "@/components/shared/Modal";
import { getApiErrorMessage } from "@/lib/api-errors";
import { productsService, type Product } from "@/services/products";
import {
	type ProductCondition,
	type WarehouseInventoryItem,
	warehouseInventoryService,
} from "@/services/warehouse-inventory";
import { stockAdjustmentsService } from "@/services/stock-adjustments";
import { warehousesService, type WarehouseListItem } from "@/services/warehouses";
import { citiesService, type City } from "@/services/cities";

const conditionOptions: ProductCondition[] = ["NEW", "GOOD", "DAMAGED", "DEFECTIVE"];
const sanitizeText = (value: string) =>
	value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export default function PenerimaanBarangInputPage() {
	const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
	const [cities, setCities] = useState<City[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
	const [warehouseForm, setWarehouseForm] = useState({
		name: "",
		address: "",
		cityId: "",
		cityName: "",
		province: "",
	});
	const [form, setForm] = useState({
		warehouseId: "",
		productId: "",
		condition: "NEW" as ProductCondition,
		quantity: "0",
		reason: "",
	});

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [warehouseResult, productResult, inventoryResult, cityResult] = await Promise.all([
				warehousesService.list({ page: 1, limit: 100 }),
				productsService.list({ page: 1, limit: 100 }),
				warehouseInventoryService.list({
					page: 1,
					limit: 100,
					sortBy: "updatedAt",
					sortOrder: "desc",
				}),
				citiesService.list({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
			]);
			setWarehouses(warehouseResult.items);
			setProducts(productResult.items);
			setInventory(inventoryResult.items);
			setCities(cityResult);
		} catch (err: any) {
			setError(err?.response?.data?.message || "Gagal memuat referensi penerimaan barang.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const matchedInventory = useMemo(
		() =>
			inventory.find(
				(item) =>
					item.warehouseId === form.warehouseId &&
					item.productId === form.productId &&
					item.condition === form.condition,
			) ?? null,
		[form.condition, form.productId, form.warehouseId, inventory],
	);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			const quantity = Number(form.quantity);
			const normalizedReason = sanitizeText(form.reason);
			if (!form.warehouseId || !form.productId || !normalizedReason || quantity <= 0) {
				throw new Error("Lengkapi gudang, produk, quantity, dan alasan penerimaan.");
			}

			await stockAdjustmentsService.receiveStock({
				warehouseId: form.warehouseId,
				productId: form.productId,
				reason: normalizedReason,
				items: [
					{
						condition: form.condition,
						quantity,
					},
				],
			});

			setSuccess("Penerimaan barang berhasil dicatat sebagai transaksi stok masuk.");
			setForm((prev) => ({
				...prev,
				quantity: "0",
				reason: "",
			}));
			await load();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menyimpan penerimaan barang."));
		} finally {
			setSubmitting(false);
		}
	};

	const handleCreateWarehouse = async () => {
		setError("");
		const name = sanitizeText(warehouseForm.name);
		const address = sanitizeText(warehouseForm.address);
		const cityName = sanitizeText(warehouseForm.cityName);
		const province = sanitizeText(warehouseForm.province);

		if (!name || !address) {
			setError("Nama gudang dan alamat wajib diisi.");
			return;
		}
		if (!warehouseForm.cityId && (!cityName || !province)) {
			setError("Pilih kota, atau isi nama kota dan provinsi baru.");
			return;
		}

		setSubmitting(true);
		try {
			const resolvedCityId = warehouseForm.cityId
				? warehouseForm.cityId
				: (await citiesService.create({ name: cityName, province })).id;

			const newWarehouse = await warehousesService.create({
				name,
				address,
				cityId: resolvedCityId,
			});

			setWarehouseForm({ name: "", address: "", cityId: "", cityName: "", province: "" });
			setWarehouseModalOpen(false);
			setForm((prev) => ({ ...prev, warehouseId: newWarehouse.id }));
			await load();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal membuat gudang."));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FeaturePage
			title="Input Barang Masuk"
			description="Form extend dari Penerimaan Barang untuk mencatat stok masuk tanpa menumpuk halaman daftar."
		>
			<div className="flex justify-end">
				<Link
					href="/gudang/penerimaan-barang"
					className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
				>
					Kembali ke Daftar
				</Link>
			</div>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<form className="space-y-5" onSubmit={handleSubmit}>
					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-slate-700">
							<span>Gudang</span>
							<div className="flex gap-2">
								<select
									className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"
									value={form.warehouseId}
									onChange={(e) => setForm((prev) => ({ ...prev, warehouseId: e.target.value }))}
									disabled={loading || submitting}
								>
									<option value="">Pilih gudang</option>
									{warehouses.map((warehouse) => (
										<option key={warehouse.id} value={warehouse.id}>
											{warehouse.name}
										</option>
									))}
								</select>
								<button
									type="button"
									onClick={() => setWarehouseModalOpen(true)}
									disabled={loading || submitting}
									className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
								>
									Tambah
								</button>
							</div>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Produk</span>
							<div className="flex gap-2">
								<select
									className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"
									value={form.productId}
									onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
									disabled={loading || submitting}
									>
										<option value="">Pilih produk</option>
										{products.map((product) => (
											<option key={product.id} value={product.id}>
												{product.name}
											</option>
										))}
									</select>
								<Link
									href="/gudang/kelola-item"
									className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								>
									Kelola Item
								</Link>
							</div>
							<p className="text-xs text-slate-500">
								Jika item belum ada, tambahkan dulu dari halaman Kelola Item Gudang.
							</p>
						</label>
					</div>

					<div className="grid gap-4 md:grid-cols-3">
						<label className="space-y-2 text-sm text-slate-700">
							<span>Kondisi</span>
							<select
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={form.condition}
								onChange={(e) =>
									setForm((prev) => ({
										...prev,
										condition: e.target.value as ProductCondition,
									}))
								}
								disabled={submitting}
							>
								{conditionOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Quantity Masuk</span>
							<input
								type="number"
								min={1}
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={form.quantity}
								onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
								disabled={submitting}
							/>
						</label>
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
							<p className="font-medium text-slate-900">Target Inventori</p>
							<p className="mt-1">
								{matchedInventory
									? `Baris sudah ada. Stok saat ini ${matchedInventory.quantity} dan akan ditambah lewat transaksi penerimaan.`
									: "Belum ada baris inventori. Sistem akan membuatnya otomatis lewat transaksi penerimaan."}
							</p>
						</div>
					</div>

					<label className="space-y-2 text-sm text-slate-700">
						<span>Alasan / Referensi</span>
						<textarea
							className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
							placeholder="Contoh: Penerimaan supplier DO-7781 batch pagi"
							value={form.reason}
							onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
							disabled={submitting}
						/>
					</label>

					<div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
						<div className="text-xs text-slate-500">
							Mode: catat transaksi penerimaan supplier
						</div>
						<button
							type="submit"
							disabled={loading || submitting}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{submitting ? "Menyimpan..." : "Catat Penerimaan"}
						</button>
					</div>
				</form>
			</section>

			<Modal
				isOpen={warehouseModalOpen}
				onClose={() => setWarehouseModalOpen(false)}
				title="Tambah Gudang"
			>
				<div className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-slate-700">
							<span>Nama Gudang</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.name}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, name: e.target.value }))}
								placeholder="Contoh: Gudang Utama"
								disabled={submitting}
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700 md:col-span-2">
							<span>Alamat</span>
							<textarea
								className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								value={warehouseForm.address}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, address: e.target.value }))}
								disabled={submitting}
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Kota</span>
							<select
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.cityId}
								onChange={(e) =>
									setWarehouseForm((prev) => ({
										...prev,
										cityId: e.target.value,
										cityName: e.target.value ? "" : prev.cityName,
										province: e.target.value ? "" : prev.province,
									}))
								}
								disabled={submitting}
							>
								<option value="">Pilih kota</option>
								{cities.map((city) => (
									<option key={city.id} value={city.id}>
										{city.name}, {city.province}
									</option>
								))}
							</select>
						</label>
						<p className="text-xs text-slate-500 md:col-span-2">
							Jika kota belum ada, kosongkan pilihan lalu isi nama kota dan provinsi di bawah.
						</p>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Nama Kota Baru</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.cityName}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, cityId: "", cityName: e.target.value }))}
								disabled={submitting || Boolean(warehouseForm.cityId)}
								placeholder="Contoh: Medan"
							/>
						</label>
						<label className="space-y-2 text-sm text-slate-700">
							<span>Provinsi Baru</span>
							<input
								className="w-full rounded-xl border border-slate-300 px-3 py-2"
								value={warehouseForm.province}
								onChange={(e) => setWarehouseForm((prev) => ({ ...prev, cityId: "", province: e.target.value }))}
								disabled={submitting || Boolean(warehouseForm.cityId)}
								placeholder="Contoh: Sumatera Utara"
							/>
						</label>
					</div>
					<div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
						<button
							type="button"
							onClick={() => setWarehouseModalOpen(false)}
							disabled={submitting}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
						>
							Batal
						</button>
						<button
							type="button"
							onClick={handleCreateWarehouse}
							disabled={submitting}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{submitting ? "Menyimpan..." : "Simpan Gudang"}
						</button>
					</div>
				</div>
			</Modal>

		</FeaturePage>
	);
}
