"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authService, type TestingAccountOption } from "@/services/auth";
import { Mail, Lock, AlertCircle, UserRound } from "lucide-react";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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
				setEmail(rows[0].email);
				setPassword(rows[0].password);
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
			const response = await authService.login({ email, password });

			router.push(authService.getHomeRoute(response.user));
		} catch (err: any) {
			const message =
				err?.response?.data?.message || "Login failed. Please try again.";
			setError(message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold text-blue-600 mb-2">SMD Pridata</h1>
					<p className="text-gray-600">Enterprise Management System</p>
				</div>

				{/* Login Card */}
				<div className="bg-white rounded-2xl shadow-xl p-8">
					<h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
						Sign In
					</h2>

					{/* Error Alert */}
					{error && (
						<div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
							<AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
							<p className="text-sm text-red-700">{error}</p>
						</div>
					)}

					{/* Form */}
					<form onSubmit={handleSubmit} className="space-y-5">
						{/* Testing Account Dropdown */}
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
										setEmail(account.email);
										setPassword(account.password);
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
									Role: {selectedAccount.organizationRole ?? selectedAccount.role}
									{selectedAccount.storeStatus ? ` | Toko: ${selectedAccount.storeStatus}` : ""}
								</p>
							) : null}
						</div>

						{/* Email Field */}
						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Email Address
							</label>
							<div className="relative">
								<Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
								<input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="your@email.com"
									required
									className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>

						{/* Password Field */}
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
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••"
									required
									className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>

						{/* Submit Button */}
						<button
							type="submit"
							disabled={isLoading}
							className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
						>
							{isLoading ? "Signing in..." : "Sign In"}
						</button>
					</form>

					<div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
						<p className="text-xs text-blue-700">
							Dropdown testing hanya untuk mempermudah QA lokal dan bisa dihapus
							nanti setelah alur role selesai.
						</p>
					</div>
				</div>

				{/* Footer */}
				<p className="text-center text-sm text-gray-600 mt-6">
					© 2026 PT. Pridata Jaya. All rights reserved.
				</p>
			</div>
		</div>
	);
}
