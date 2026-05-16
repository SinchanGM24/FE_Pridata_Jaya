"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle, UserRound } from "lucide-react";
import { authService, type TestingAccountOption } from "@/services/auth";
import type { UserRole } from "@/types";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
	{ value: "superowner", label: "Superowner" },
	{ value: "owner", label: "Owner" },
	{ value: "admin", label: "Admin" },
	{ value: "fakturis", label: "Fakturis" },
	{ value: "gudang", label: "Gudang" },
	{ value: "akuntan", label: "Akuntan" },
	{ value: "sales", label: "Sales" },
	{ value: "toko", label: "Toko" },
];

const toLoginRole = (role: UserRole): UserRole => {
	switch (role) {
		case "invoicist":
			return "fakturis";
		case "warehouse_staff":
			return "gudang";
		case "accountant":
			return "akuntan";
		case "store_customer":
			return "toko";
		default:
			return role;
	}
};

const getErrorMessage = (error: unknown) => {
	if (!error || typeof error !== "object") {
		return "Login gagal. Silakan coba lagi.";
	}

	const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
	if (typeof responseMessage === "string" && responseMessage.trim()) {
		return responseMessage;
	}

	const message = (error as { message?: string }).message;
	return typeof message === "string" && message.trim()
		? message
		: "Login gagal. Silakan coba lagi.";
};

export default function LoginPage() {
	const router = useRouter();
	const [form, setForm] = useState({
		username: "",
		password: "",
		role: "fakturis" as UserRole,
	});
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [accounts, setAccounts] = useState<TestingAccountOption[]>([]);
	const [selectedAccountId, setSelectedAccountId] = useState("");
	const [loadingAccounts, setLoadingAccounts] = useState(true);

	useEffect(() => {
		const loadAccounts = async () => {
			setLoadingAccounts(true);
			const rows = await authService.getTestingAccounts();
			setAccounts(rows);

			if (rows.length) {
				setSelectedAccountId(rows[0].id);
				setForm({
					username: rows[0].username || rows[0].email || "",
					password: rows[0].password,
					role: toLoginRole(rows[0].role),
				});
			}

			setLoadingAccounts(false);
		};

		void loadAccounts();
	}, []);

	const selectedAccount = useMemo(
		() => accounts.find((account) => account.id === selectedAccountId) ?? null,
		[accounts, selectedAccountId],
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const response = await authService.login(form);
			router.push(authService.getHomeRoute(response.user));
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
			<div className="w-full max-w-md">
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold text-blue-600 mb-2">SMD Pridata</h1>
					<p className="text-gray-600">Enterprise Management System</p>
				</div>

				<div className="bg-white rounded-2xl shadow-xl p-8">
					<h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
						Masuk
					</h2>

					{error && (
						<div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
							<AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
							<p className="text-sm text-red-700">{error}</p>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						<div>
							<label
								htmlFor="testing-account"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Akun Testing
							</label>
							<div className="relative">
								<UserRound className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
								<select
									id="testing-account"
									value={selectedAccountId}
									onChange={(e) => {
										const nextId = e.target.value;
										setSelectedAccountId(nextId);
										const account = accounts.find((item) => item.id === nextId);
										if (!account) return;
										setForm({
											username: account.username || account.email || "",
											password: account.password,
											role: toLoginRole(account.role),
										});
									}}
									disabled={loadingAccounts || accounts.length === 0}
									className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
								>
									{accounts.length === 0 ? (
										<option value="">
											{loadingAccounts ? "Memuat akun..." : "Tidak ada akun testing"}
										</option>
									) : (
										accounts.map((account) => (
											<option key={account.id} value={account.id}>
												{account.label}
											</option>
										))
									)}
								</select>
							</div>
							{selectedAccount ? (
								<p className="mt-2 text-xs text-gray-500">
									Role:{" "}
									{toLoginRole(
										(selectedAccount.organizationRole ?? selectedAccount.role) as UserRole,
									)}
									{selectedAccount.storeStatus ? ` | Toko: ${selectedAccount.storeStatus}` : ""}
								</p>
							) : null}
							<label className="space-y-2 text-sm text-slate-700">
								<span>Role Akun</span>
								<select
									value={form.role}
									onChange={(e) =>
										setForm((prev) => ({ ...prev, role: e.target.value as UserRole }))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2"
								>
									{ROLE_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</label>
							{(selectedAccount?.role === "toko" || selectedAccount?.role === "store_customer") &&
							selectedAccount.canCheckout === false ? (
								<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
									Akun toko ini belum diverifikasi. Akses checkout akan ditolak sampai status toko aktif.
								</div>
							) : null}
						</div>

						<div>
							<label
								htmlFor="username"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Email / Username
							</label>
							<div className="relative">
								<Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
								<input
									id="username"
									type="text"
									value={form.username}
									onChange={(e) =>
										setForm((prev) => ({ ...prev, username: e.target.value }))
									}
									placeholder="Masukkan email akun BE2"
									required
									className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
							<p className="mt-2 text-xs text-slate-500">
								Login BE2 memakai email akun yang terdaftar pada sistem.
							</p>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
								<input
									id="password"
									type="password"
									value={form.password}
									onChange={(e) =>
										setForm((prev) => ({ ...prev, password: e.target.value }))
									}
									placeholder="********"
									required
									className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
						>
							{isLoading ? "Memproses..." : "Masuk"}
						</button>
					</form>

					<div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
						<p className="text-xs text-blue-700">
							Dropdown testing hanya untuk mempermudah QA lokal dan bisa dihapus
							nanti setelah alur role selesai.
						</p>
					</div>
				</div>

				<p className="text-center text-sm text-gray-600 mt-6">
					© 2026 PT. Pridata Jaya. All rights reserved.
				</p>
			</div>
		</div>
	);
}
