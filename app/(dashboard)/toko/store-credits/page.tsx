"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/shared/Badge";
import { buttonClasses } from "@/components/shared/Button";
import Card, { CardHeader } from "@/components/shared/Card";
import ResponsiveTable, { type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import Skeleton from "@/components/shared/Skeleton";
import TokoFeatureLayout from "@/components/toko/TokoFeatureLayout";
import { useTokoCartCount } from "@/hooks/useTokoCartCount";
import { formatAppDateTime } from "@/lib/datetime";
import { formatRupiah } from "@/lib/format";
import { meService } from "@/services/me";
import {
	storeCreditsService,
	type StoreCreditBalance,
	type StoreCreditLedgerItem,
	type StoreCreditType,
} from "@/services/store-credits";

type FilterType = "ALL" | StoreCreditType;

const VALID_TYPES: StoreCreditType[] = ["CREDIT", "DEBIT", "ADJUSTMENT"];

const formatCurrency = formatRupiah;

const formatDate = (value?: string | null) => (value ? formatAppDateTime(value) : "-");

const TYPE_LABEL: Record<StoreCreditType, string> = {
	CREDIT: "Kredit",
	DEBIT: "Debit",
	ADJUSTMENT: "Penyesuaian",
};

function getAmountDisplay(type: StoreCreditType, amount: number): string {
	if (type === "CREDIT") {
		return `+${formatCurrency(amount)}`;
	}
	return `-${formatCurrency(amount)}`;
}

function getAmountClassName(type: StoreCreditType): string {
	if (type === "CREDIT") {
		return "font-semibold text-emerald-700";
	}
	if (type === "DEBIT") {
		return "font-semibold text-rose-700";
	}
	return "font-semibold text-slate-700";
}

export default function StoreCreditsPage() {
	const cartCount = useTokoCartCount();
	const [storeId, setStoreId] = useState<string | null>(null);
	const [balance, setBalance] = useState<StoreCreditBalance | null>(null);
	const [ledgerItems, setLedgerItems] = useState<StoreCreditLedgerItem[]>([]);
	const [loadingStore, setLoadingStore] = useState(true);
	const [loadingData, setLoadingData] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [filterType, setFilterType] = useState<FilterType>("ALL");

	// Load storeId from profile
	const loadStoreId = useCallback(async () => {
		setLoadingStore(true);
		setError(null);
		try {
			const profile = await meService.getProfile();
			const id = profile.store?.id ?? null;
			setStoreId(id);
			if (!id) {
				setError("Akun Anda tidak terhubung dengan toko manapun.");
			}
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Gagal memuat data profil toko.";
			setError(message);
		} finally {
			setLoadingStore(false);
		}
	}, []);

	// Load balance and ledger in parallel once storeId is available
	const loadData = useCallback(async () => {
		if (!storeId) return;

		setLoadingData(true);
		setError(null);
		try {
			const [balanceResult, ledgerResult] = await Promise.all([
				storeCreditsService.getTokoBalance(storeId),
				storeCreditsService.getTokoLedger({
					storeId,
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
	}, [storeId]);

	// Load storeId first
	useEffect(() => {
		void Promise.resolve().then(loadStoreId);
	}, [loadStoreId]);

	// Load data when storeId becomes available
	useEffect(() => {
		if (storeId) {
			void Promise.resolve().then(loadData);
		}
	}, [storeId, loadData]);

	const filteredItems =
		filterType === "ALL"
			? ledgerItems
			: ledgerItems.filter((item) => item.type === filterType);

	const columns: ResponsiveColumn<StoreCreditLedgerItem>[] = [
		{
			key: "createdAt",
			head: "Tanggal",
			role: "title",
			render: (item) => formatDate(item.createdAt),
		},
		{
			key: "type",
			head: "Tipe",
			role: "status",
			render: (item) => (
				<Badge
					tone={
						item.type === "CREDIT" ? "success" : item.type === "DEBIT" ? "danger" : "neutral"
					}
				>
					{TYPE_LABEL[item.type] ?? item.type}
				</Badge>
			),
		},
		{
			key: "amount",
			head: "Jumlah",
			role: "amount",
			align: "right",
			render: (item) => (
				<span className={getAmountClassName(item.type)}>
					{getAmountDisplay(item.type, item.amount)}
				</span>
			),
		},
		{
			key: "balanceAfter",
			head: "Saldo Setelah",
			align: "right",
			render: (item) =>
				item.balanceAfter != null ? formatCurrency(item.balanceAfter) : "-",
		},
		{ key: "sourceType", head: "Sumber", render: (item) => item.sourceType ?? "-" },
	];

	return (
		<TokoFeatureLayout title="Store Credit" cartCount={cartCount}>
			{loadingStore ? (
				<Card>
					<Skeleton className="h-4 w-40" />
					<Skeleton className="mt-3 h-8 w-56" />
				</Card>
			) : error && !storeId ? (
				<Card className="border-rose-200 bg-rose-50">
					<p className="type-body text-rose-700">{error}</p>
				</Card>
			) : (
				<>
					<Card>
						<p className="type-label text-slate-500">
							Saldo Store Credit Tersedia
						</p>
						{loadingData ? (
							<Skeleton className="mt-2 h-9 w-48" />
						) : (
							<p className="type-display mt-1.5 text-3xl text-slate-900">
								{formatCurrency(balance?.balance ?? 0)}
							</p>
						)}
						<p className="mt-2 text-sm text-slate-500">
							Saldo ini otomatis mengurangi tagihan pada invoice berikutnya.
						</p>
					</Card>

					{error ? (
						<Card className="border-rose-200 bg-rose-50">
							<p className="type-body text-rose-700">{error}</p>
						</Card>
					) : null}

					<section className="space-y-3">
						<CardHeader
							title="Riwayat Store Credit"
							description="Setiap penambahan dan pemakaian kredit toko."
						/>

						<div
							role="group"
							aria-label="Saring tipe transaksi"
							className="flex flex-wrap gap-2"
						>
							{(["ALL", ...VALID_TYPES] as const).map((type) => (
								<button
									key={type}
									type="button"
									aria-pressed={filterType === type}
									onClick={() => setFilterType(type)}
									/* min-h-10 (40px) di bawah lantai sentuh, dan rounded-full
									   menabrak jenjang radius — kontrol itu rounded-lg.
									   buttonClasses membawa keduanya sekaligus. */
									className={buttonClasses(
										filterType === type ? "primary" : "secondary",
										"sm",
									)}
								>
									{type === "ALL" ? "Semua" : TYPE_LABEL[type]}
								</button>
							))}
						</div>

						<ResponsiveTable
							columns={columns}
							data={filteredItems}
							getRowKey={(item) => item.id}
							loading={loadingData}
							emptyText={
								filterType === "ALL"
									? "Belum ada riwayat store credit"
									: `Tidak ada transaksi ${TYPE_LABEL[filterType]}`
							}
							emptyDescription={
								filterType === "ALL"
									? "Kredit toko muncul di sini setelah ada retur disetujui atau penyesuaian dari akuntan."
									: "Coba pilih tipe lain untuk melihat transaksi yang ada."
							}
						/>
					</section>
				</>
			)}
		</TokoFeatureLayout>
	);
}
