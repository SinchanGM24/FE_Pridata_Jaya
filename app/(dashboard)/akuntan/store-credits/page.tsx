"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { storesService, type Store } from "@/services/stores";
import {
	storeCreditsService,
	type StoreCreditBalance,
	type StoreCreditLedgerItem,
	type StoreCreditType,
} from "@/services/store-credits";

type FilterType = "ALL" | StoreCreditType;

const VALID_TYPES: StoreCreditType[] = ["CREDIT", "DEBIT", "ADJUSTMENT"];

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);
}

function formatDate(value?: string | null): string {
	if (!value) return "-";
	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getAmountDisplay(type: StoreCreditType, amount: number): string {
	if (type === "CREDIT") {
		return `+${formatCurrency(amount)}`;
	}
	return `-${formatCurrency(amount)}`;
}

function getAmountClassName(type: StoreCreditType): string {
	if (type === "CREDIT") {
		return "text-emerald-600 font-semibold";
	}
	if (type === "DEBIT") {
		return "text-red-600 font-semibold";
	}
	return "text-slate-700 font-semibold";
}

export default function AkuntanStoreCreditsPage() {
	const [stores, setStores] = useState<Store[]>([]);
	const [selectedStoreId, setSelectedStoreId] = useState<string>("");
	const [balance, setBalance] = useState<StoreCreditBalance | null>(null);
	const [ledgerItems, setLedgerItems] = useState<StoreCreditLedgerItem[]>([]);
	const [loadingStores, setLoadingStores] = useState(true);
	const [loadingData, setLoadingData] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [filterType, setFilterType] = useState<FilterType>("ALL");

	// Load stores list
	const loadStores = useCallback(async () => {
		setLoadingStores(true);
		setError(null);
		try {
			const result = await storesService.list({ page: 1, limit: 100 });
			setStores(result.items);
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Gagal memuat daftar toko.";
			setError(message);
		} finally {
			setLoadingStores(false);
		}
	}, []);

	// Load balance and ledger in parallel once storeId is selected
	const loadData = useCallback(async () => {
		if (!selectedStoreId) return;

		setLoadingData(true);
		setError(null);
		try {
			const [balanceResult, ledgerResult] = await Promise.all([
				storeCreditsService.getBalance(selectedStoreId),
				storeCreditsService.getLedger({
					storeId: selectedStoreId,
					limit: 50,
					sortBy: "createdAt",
					sortOrder: "desc",
				}),
			]);
			setBalance(balanceResult);
			setLedgerItems(ledgerResult.items);
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Gagal memuat data store credit.";
			setError(message);
		} finally {
			setLoadingData(false);
		}
	}, [selectedStoreId]);

	// Load stores on mount
	useEffect(() => {
		void Promise.resolve().then(loadStores);
	}, [loadStores]);

	// Load data when storeId is selected
	useEffect(() => {
		if (selectedStoreId) {
			void Promise.resolve().then(loadData);
		}
	}, [selectedStoreId, loadData]);

	const handleStoreChange = (storeId: string) => {
		setSelectedStoreId(storeId);
		setFilterType("ALL");
		// Reset data when changing store
		setBalance(null);
		setLedgerItems([]);
		setError(null);
	};

	const filteredItems =
		filterType === "ALL"
			? ledgerItems
			: ledgerItems.filter((item) => item.type === filterType);

	return (
		<FeaturePage
			title="Store Credit"
			description="Lihat saldo store credit dan riwayat transaksi kredit toko."
		>
			{loadingStores ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="text-sm text-slate-500">
						Memuat daftar toko...
					</div>
				</section>
			) : error && stores.length === 0 ? (
				<section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
					<div className="text-sm text-red-700">{error}</div>
				</section>
			) : (
				<>
					{/* Store Selector */}
					<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<label
							htmlFor="store-selector"
							className="block text-sm font-medium text-slate-700"
						>
							Pilih Toko
						</label>
						<select
							id="store-selector"
							value={selectedStoreId}
							onChange={(e) => handleStoreChange(e.target.value)}
							className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none md:max-w-md"
						>
							<option value="">-- Pilih Toko --</option>
							{stores.map((store) => (
								<option key={store.id} value={store.id}>
									{store.name}
									{store.city ? ` - ${store.city.name}` : ""}
								</option>
							))}
						</select>
					</section>

					{/* Prompt when no store selected */}
					{!selectedStoreId ? (
						<section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
							<div className="text-center text-sm text-slate-500">
								Silakan pilih toko untuk melihat data store credit.
							</div>
						</section>
					) : (
						<>
							{/* Balance Card */}
							<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
								<p className="text-sm font-medium text-slate-500">
									Saldo Store Credit Tersedia
								</p>
								{loadingData ? (
									<p className="mt-2 text-2xl font-semibold text-slate-400">
										Memuat...
									</p>
								) : (
									<p className="mt-2 text-3xl font-bold text-slate-900">
										{balance
											? formatCurrency(balance.balance)
											: formatCurrency(0)}
									</p>
								)}
							</section>

							{/* Error State */}
							{error ? (
								<section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
									<p className="text-sm text-red-700">{error}</p>
								</section>
							) : null}

							{/* Ledger Section */}
							<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
								<div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
									<h2 className="text-lg font-semibold text-slate-900">
										Riwayat Store Credit
									</h2>
									<button
										type="button"
										onClick={() => void loadData()}
										disabled={loadingData}
										className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
									>
										Refresh
									</button>
								</div>

								{/* Filter Buttons */}
								<div className="mb-4 flex flex-wrap gap-2">
									{(["ALL", ...VALID_TYPES] as const).map((type) => (
										<button
											key={type}
											type="button"
											onClick={() => setFilterType(type)}
											className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
												filterType === type
													? "bg-slate-900 text-white"
													: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
											}`}
										>
											{type === "ALL"
												? "Semua"
												: type === "CREDIT"
													? "Credit"
													: type === "DEBIT"
														? "Debit"
														: "Adjustment"}
										</button>
									))}
								</div>

								{loadingData ? (
									<div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
										Memuat riwayat transaksi...
									</div>
								) : filteredItems.length === 0 ? (
									<div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
										{filterType === "ALL"
											? "Belum ada riwayat transaksi store credit."
											: `Tidak ada transaksi dengan tipe ${filterType}.`}
									</div>
								) : (
									<div className="overflow-x-auto">
										<table className="min-w-full divide-y divide-slate-200 text-sm">
											<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
												<tr>
													<th className="px-4 py-3">Tanggal</th>
													<th className="px-4 py-3">Tipe</th>
													<th className="px-4 py-3">Sumber</th>
													<th className="px-4 py-3 text-right">Jumlah</th>
													<th className="px-4 py-3 text-right">Saldo Setelah</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-100">
												{filteredItems.map((item) => (
													<tr key={item.id} className="text-slate-700">
														<td className="px-4 py-3 whitespace-nowrap">
															{formatDate(item.createdAt)}
														</td>
														<td className="px-4 py-3">
															<span
																className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
																	item.type === "CREDIT"
																		? "bg-emerald-100 text-emerald-700"
																		: item.type === "DEBIT"
																			? "bg-red-100 text-red-700"
																			: "bg-slate-100 text-slate-700"
																}`}
															>
																{item.type}
															</span>
														</td>
														<td className="px-4 py-3">
															{item.sourceType ?? "-"}
														</td>
														<td
															className={`px-4 py-3 text-right whitespace-nowrap ${getAmountClassName(item.type)}`}
														>
															{getAmountDisplay(item.type, item.amount)}
														</td>
														<td className="px-4 py-3 text-right whitespace-nowrap">
															{item.balanceAfter != null
																? formatCurrency(item.balanceAfter)
																: "-"}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</section>
						</>
					)}
				</>
			)}
		</FeaturePage>
	);
}
